export interface UserConnection {
    userId: string
    connectionId: string
    userAddress?: string
    connectedAt: number
    lastActivity: number
}

export interface GameConnection extends UserConnection {
    gameId: string
    role: 'player' | 'spectator'
    playerColor?: 'w' | 'b' // Only for players
}

export interface ConnectionStats {
    global: {
        totalConnections: number
        activePlayers: number // people currently in games as players
        totalSpectators: number
        connectedUsers: string[] // unique user IDs
    }
    gameSpecific?: {
        gameId: string
        players: {
            white: { userId?: string; connected: boolean; address?: string; lastSeen?: number }
            black: { userId?: string; connected: boolean; address?: string; lastSeen?: number }
        }
        spectators: number
        totalConnections: number
        connectedUserIds: string[]
    }
}

export class ConnectionStatsManager {
    private static instance: ConnectionStatsManager
    private globalConnections = new Map<string, UserConnection>() // connectionId -> UserConnection
    private gameConnections = new Map<string, Map<string, GameConnection>>() // gameId -> Map<connectionId, GameConnection>
    private userToConnections = new Map<string, Set<string>>() // userId -> Set<connectionId>

    private constructor() { }

    public static getInstance(): ConnectionStatsManager {
        if (!ConnectionStatsManager.instance) {
            ConnectionStatsManager.instance = new ConnectionStatsManager()
        }
        return ConnectionStatsManager.instance
    }

    // Global connection management
    public addGlobalConnection(connectionId: string, userId: string, userAddress?: string): void {
        const connection: UserConnection = {
            userId,
            connectionId,
            userAddress,
            connectedAt: Date.now(),
            lastActivity: Date.now()
        }

        this.globalConnections.set(connectionId, connection)

        if (!this.userToConnections.has(userId)) {
            this.userToConnections.set(userId, new Set())
        }
        this.userToConnections.get(userId)!.add(connectionId)

        console.log(`[ConnectionStats] Global connection added: ${connectionId} for user ${userId}. Total global: ${this.globalConnections.size}`)
    }

    public removeGlobalConnection(connectionId: string): void {
        const connection = this.globalConnections.get(connectionId)
        if (connection) {
            this.globalConnections.delete(connectionId)

            const userConnections = this.userToConnections.get(connection.userId)
            if (userConnections) {
                userConnections.delete(connectionId)
                if (userConnections.size === 0) {
                    this.userToConnections.delete(connection.userId)
                }
            }

            console.log(`[ConnectionStats] Global connection removed: ${connectionId}. Total global: ${this.globalConnections.size}`)
        }
    }

    // Game connection management
    public addGameConnection(
        gameId: string,
        connectionId: string,
        userId: string,
        role: 'player' | 'spectator',
        playerColor?: 'w' | 'b',
        userAddress?: string
    ): void {
        if (!this.gameConnections.has(gameId)) {
            this.gameConnections.set(gameId, new Map())
        }

        const gameConnection: GameConnection = {
            gameId,
            userId,
            connectionId,
            userAddress,
            role,
            playerColor,
            connectedAt: Date.now(),
            lastActivity: Date.now()
        }

        this.gameConnections.get(gameId)!.set(connectionId, gameConnection)

        console.log(`[ConnectionStats] Game connection added: ${connectionId} to game ${gameId} as ${role}${playerColor ? ` (${playerColor})` : ''}`)
    }

    public removeGameConnection(gameId: string, connectionId: string): void {
        const gameMap = this.gameConnections.get(gameId)
        if (gameMap) {
            gameMap.delete(connectionId)
            if (gameMap.size === 0) {
                this.gameConnections.delete(gameId)
            }
            console.log(`[ConnectionStats] Game connection removed: ${connectionId} from game ${gameId}`)
        }
    }

    // Stats calculation
    public getGlobalStats(): ConnectionStats['global'] {
        const allConnectedUsers = new Set<string>()
        let activePlayers = 0
        let totalSpectators = 0

        // Get all connected users from global connections
        for (const connection of this.globalConnections.values()) {
            allConnectedUsers.add(connection.userId)
        }

        // Count players and spectators from game connections
        for (const gameMap of this.gameConnections.values()) {
            for (const connection of gameMap.values()) {
                if (connection.role === 'player') {
                    activePlayers++
                } else {
                    totalSpectators++
                }
            }
        }

        return {
            totalConnections: this.globalConnections.size,
            activePlayers,
            totalSpectators,
            connectedUsers: Array.from(allConnectedUsers)
        }
    }

    public getGameStats(gameId: string, gameData?: { playerWhiteId?: string; playerBlackId?: string; playerWhiteAddress?: string; playerBlackAddress?: string }): ConnectionStats['gameSpecific'] | undefined {
        const gameMap = this.gameConnections.get(gameId)
        if (!gameMap) return undefined

        const connections = Array.from(gameMap.values())
        const spectators = connections.filter(c => c.role === 'spectator').length
        const connectedUserIds = connections.map(c => c.userId)

        // Determine player connection status
        const players = {
            white: { connected: false as boolean, userId: undefined as string | undefined, address: undefined as string | undefined, lastSeen: undefined as number | undefined },
            black: { connected: false as boolean, userId: undefined as string | undefined, address: undefined as string | undefined, lastSeen: undefined as number | undefined }
        }

        if (gameData) {
            // Set player info from game data
            if (gameData.playerWhiteId) {
                players.white.userId = gameData.playerWhiteId
                players.white.address = gameData.playerWhiteAddress || undefined
            }
            if (gameData.playerBlackId) {
                players.black.userId = gameData.playerBlackId
                players.black.address = gameData.playerBlackAddress || undefined
            }

            // Check if players are connected
            for (const connection of connections) {
                if (connection.role === 'player') {
                    if (connection.userId === gameData.playerWhiteId && connection.playerColor === 'w') {
                        players.white.connected = true
                        players.white.lastSeen = connection.lastActivity
                    } else if (connection.userId === gameData.playerBlackId && connection.playerColor === 'b') {
                        players.black.connected = true
                        players.black.lastSeen = connection.lastActivity
                    }
                }
            }
        }

        return {
            gameId,
            players,
            spectators,
            totalConnections: connections.length,
            connectedUserIds
        }
    }

    public updateLastActivity(connectionId: string): void {
        const globalConnection = this.globalConnections.get(connectionId)
        if (globalConnection) {
            globalConnection.lastActivity = Date.now()
        }

        // Update in game connections too
        for (const gameMap of this.gameConnections.values()) {
            const gameConnection = gameMap.get(connectionId)
            if (gameConnection) {
                gameConnection.lastActivity = Date.now()
                break
            }
        }
    }

    public getAllGameIds(): string[] {
        return Array.from(this.gameConnections.keys())
    }

    public getConnectionCount(gameId?: string): number {
        if (gameId) {
            return this.gameConnections.get(gameId)?.size || 0
        }
        return this.globalConnections.size
    }
} 