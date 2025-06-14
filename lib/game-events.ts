import type { Move, PlayerColor, GameState } from "./chess-logic/types"
import type { GameStatus } from "./chess-data.types"
import { ConnectionStatsManager } from "./connection-stats"
import { GlobalEventBroadcaster } from "./global-events"

export type GameEvent =
    | { type: 'move'; data: { move: Move; gameState: { fen: string; status: GameStatus; winner?: PlayerColor; turn: PlayerColor }; playerId: string } }
    | { type: 'player_joined'; data: { playerColor: PlayerColor; playerId: string; playerAddress?: string } }
    | { type: 'player_disconnected'; data: { playerColor: PlayerColor; playerId: string } }
    | { type: 'game_ended'; data: { winner?: PlayerColor; reason: string; status: GameStatus } }
    | { type: 'sync_required'; data: { reason: string } }
    | { type: 'heartbeat'; data: { timestamp: number } }

interface SSEConnection {
    controller: ReadableStreamDefaultController
    userId: string
    gameId: string
    connectedAt: number
    lastHeartbeat: number
}

export class GameEventBroadcaster {
    private static connections = new Map<string, SSEConnection>()
    private static gameSubscriptions = new Map<string, Set<string>>()
    private static heartbeatIntervals = new Map<string, NodeJS.Timeout>()

    static addConnection(gameId: string, userId: string, controller: ReadableStreamDefaultController, gameData?: { playerWhiteId?: string; playerBlackId?: string; playerWhiteAddress?: string; playerBlackAddress?: string }): string {
        const connectionId = `${gameId}:${userId}:${Date.now()}`

        console.log(`[GameEventBroadcaster] *** ADDING CONNECTION ***`)
        console.log(`[GameEventBroadcaster] GameID: ${gameId}`)
        console.log(`[GameEventBroadcaster] UserID: ${userId}`)
        console.log(`[GameEventBroadcaster] ConnectionID: ${connectionId}`)
        console.log(`[GameEventBroadcaster] Game data:`, gameData)

        // Store connection
        this.connections.set(connectionId, {
            controller,
            userId,
            gameId,
            connectedAt: Date.now(),
            lastHeartbeat: Date.now()
        })

        // Add to game subscriptions
        if (!this.gameSubscriptions.has(gameId)) {
            this.gameSubscriptions.set(gameId, new Set())
            console.log(`[GameEventBroadcaster] Created new subscription set for game ${gameId}`)
        }
        this.gameSubscriptions.get(gameId)!.add(connectionId)

        const currentGameConnections = this.gameSubscriptions.get(gameId)!.size
        console.log(`[GameEventBroadcaster] Game ${gameId} now has ${currentGameConnections} connections`)
        console.log(`[GameEventBroadcaster] All connections for game ${gameId}:`, Array.from(this.gameSubscriptions.get(gameId)!))

        // Determine if user is a player or spectator
        let role: 'player' | 'spectator' = 'spectator'
        let playerColor: 'w' | 'b' | undefined = undefined
        let userAddress: string | undefined = undefined

        if (gameData) {
            if (gameData.playerWhiteId === userId) {
                role = 'player'
                playerColor = 'w'
                userAddress = gameData.playerWhiteAddress || undefined
            } else if (gameData.playerBlackId === userId) {
                role = 'player'
                playerColor = 'b'
                userAddress = gameData.playerBlackAddress || undefined
            }
        }

        console.log(`[GameEventBroadcaster] User ${userId} role: ${role}${playerColor ? ` (${playerColor})` : ''}`)

        // Add to connection stats
        ConnectionStatsManager.getInstance().addGameConnection(
            gameId,
            connectionId,
            userId,
            role,
            playerColor,
            userAddress
        )

        // Start heartbeat
        this.startHeartbeat(connectionId)

        // Broadcast updated global stats
        GlobalEventBroadcaster.getInstance().broadcastConnectionStats()

        console.log(`[GameEventBroadcaster] Added connection ${connectionId} for game ${gameId} as ${role}${playerColor ? ` (${playerColor})` : ''}`)
        console.log(`[GameEventBroadcaster] Total connections in system: ${this.connections.size}`)

        return connectionId
    }

    static removeConnection(connectionId: string) {
        const connection = this.connections.get(connectionId)
        if (!connection) return

        const { gameId } = connection

        // Remove from connections
        this.connections.delete(connectionId)

        // Remove from game subscriptions
        const gameConnections = this.gameSubscriptions.get(gameId)
        if (gameConnections) {
            gameConnections.delete(connectionId)
            if (gameConnections.size === 0) {
                this.gameSubscriptions.delete(gameId)
            }
        }

        // Remove from connection stats
        ConnectionStatsManager.getInstance().removeGameConnection(gameId, connectionId)

        // Clear heartbeat
        const heartbeatInterval = this.heartbeatIntervals.get(connectionId)
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            this.heartbeatIntervals.delete(connectionId)
        }

        // Broadcast updated global stats
        GlobalEventBroadcaster.getInstance().broadcastConnectionStats()

        console.log(`[GameEventBroadcaster] Removed connection ${connectionId} from game ${gameId}`)
    }

    static broadcast(gameId: string, event: GameEvent, excludeUserId?: string) {
        const gameConnections = this.gameSubscriptions.get(gameId)
        console.log(`[GameEventBroadcaster] *** BROADCAST DEBUG for game ${gameId} ***`)
        console.log(`[GameEventBroadcaster] Event type: ${event.type}`)
        console.log(`[GameEventBroadcaster] Exclude userId: ${excludeUserId}`)
        console.log(`[GameEventBroadcaster] Game connections set:`, gameConnections ? Array.from(gameConnections) : 'none')
        console.log(`[GameEventBroadcaster] Total connections in memory:`, this.connections.size)

        if (!gameConnections || gameConnections.size === 0) {
            console.log(`[GameEventBroadcaster] No connections for game ${gameId}, skipping broadcast`)
            return
        }

        const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        let broadcastCount = 0
        let failedConnections: string[] = []
        let excludedCount = 0

        for (const connectionId of gameConnections) {
            const connection = this.connections.get(connectionId)
            console.log(`[GameEventBroadcaster] Checking connection ${connectionId}:`, connection ? `userId: ${connection.userId}` : 'CONNECTION NOT FOUND')

            if (!connection) {
                console.log(`[GameEventBroadcaster] Connection ${connectionId} not found in memory`)
                continue
            }

            // Skip if this is the user who triggered the event
            if (excludeUserId && connection.userId === excludeUserId) {
                console.log(`[GameEventBroadcaster] Skipping connection ${connectionId} - matches excluded userId ${excludeUserId}`)
                excludedCount++
                continue
            }

            try {
                console.log(`[GameEventBroadcaster] Sending event to connection ${connectionId} (user: ${connection.userId})`)
                connection.controller.enqueue(eventData)
                broadcastCount++
                console.log(`[GameEventBroadcaster] Successfully sent event to connection ${connectionId}`)
            } catch (error) {
                console.error(`[GameEventBroadcaster] Failed to send event to ${connectionId}:`, error)
                failedConnections.push(connectionId)
            }
        }

        // Clean up failed connections
        failedConnections.forEach(connectionId => this.removeConnection(connectionId))

        console.log(`[GameEventBroadcaster] *** BROADCAST SUMMARY for game ${gameId} ***`)
        console.log(`[GameEventBroadcaster] Event type: ${event.type}`)
        console.log(`[GameEventBroadcaster] Total connections checked: ${gameConnections.size}`)
        console.log(`[GameEventBroadcaster] Excluded connections: ${excludedCount}`)
        console.log(`[GameEventBroadcaster] Failed connections: ${failedConnections.length}`)
        console.log(`[GameEventBroadcaster] Successful broadcasts: ${broadcastCount}`)
        console.log(`[GameEventBroadcaster] Broadcasted ${event.type} to ${broadcastCount} connections for game ${gameId}`)
    }

    static getConnectionCount(gameId: string): number {
        const gameConnections = this.gameSubscriptions.get(gameId)
        return gameConnections ? gameConnections.size : 0
    }

    static getUserConnections(gameId: string, userId: string): string[] {
        const gameConnections = this.gameSubscriptions.get(gameId)
        if (!gameConnections) return []

        return Array.from(gameConnections).filter(connectionId => {
            const connection = this.connections.get(connectionId)
            return connection && connection.userId === userId
        })
    }

    static getDebugInfo(gameId?: string) {
        const debugInfo: any = {
            totalConnections: this.connections.size,
            totalGameSubscriptions: this.gameSubscriptions.size,
            timestamp: new Date().toISOString()
        }

        if (gameId) {
            const gameConnections = this.gameSubscriptions.get(gameId)
            debugInfo.gameId = gameId
            debugInfo.gameConnections = gameConnections ? Array.from(gameConnections) : []
            debugInfo.gameConnectionDetails = []

            if (gameConnections) {
                for (const connectionId of gameConnections) {
                    const connection = this.connections.get(connectionId)
                    debugInfo.gameConnectionDetails.push({
                        connectionId,
                        userId: connection?.userId || 'MISSING',
                        connected: !!connection,
                        connectedAt: connection?.connectedAt,
                        lastHeartbeat: connection?.lastHeartbeat
                    })
                }
            }
        } else {
            // Get all games
            debugInfo.allGames = {}
            for (const [gId, connections] of this.gameSubscriptions) {
                debugInfo.allGames[gId] = {
                    connectionCount: connections.size,
                    connectionIds: Array.from(connections)
                }
            }
        }

        return debugInfo
    }

    private static startHeartbeat(connectionId: string) {
        const interval = setInterval(() => {
            const connection = this.connections.get(connectionId)
            if (!connection) {
                clearInterval(interval)
                this.heartbeatIntervals.delete(connectionId)
                return
            }

            try {
                const heartbeatEvent: GameEvent = {
                    type: 'heartbeat',
                    data: { timestamp: Date.now() }
                }
                const eventData = `event: heartbeat\ndata: ${JSON.stringify(heartbeatEvent.data)}\n\n`
                connection.controller.enqueue(eventData)
                connection.lastHeartbeat = Date.now()
            } catch (error) {
                console.error(`[GameEventBroadcaster] Heartbeat failed for ${connectionId}:`, error)
                this.removeConnection(connectionId)
            }
        }, 30000) // 30 second heartbeat

        this.heartbeatIntervals.set(connectionId, interval)
    }

    // Utility method to send initial game state to a new connection
    static sendInitialState(connectionId: string, gameState: any) {
        const connection = this.connections.get(connectionId)
        if (!connection) return

        try {
            const eventData = `event: initial_state\ndata: ${JSON.stringify(gameState)}\n\n`
            connection.controller.enqueue(eventData)
        } catch (error) {
            console.error(`[GameEventBroadcaster] Failed to send initial state to ${connectionId}:`, error)
            this.removeConnection(connectionId)
        }
    }
} 