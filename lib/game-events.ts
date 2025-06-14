import type { Move, PlayerColor, GameState } from "./chess-logic/types"
import type { GameStatus } from "./chess-data.types"
import { ConnectionStatsManager } from "./connection-stats"

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
        }
        this.gameSubscriptions.get(gameId)!.add(connectionId)

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

        console.log(`[GameEventBroadcaster] Added connection ${connectionId} for game ${gameId} as ${role}${playerColor ? ` (${playerColor})` : ''}`)
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

        console.log(`[GameEventBroadcaster] Removed connection ${connectionId} from game ${gameId}`)
    }

    static broadcast(gameId: string, event: GameEvent, excludeUserId?: string) {
        const gameConnections = this.gameSubscriptions.get(gameId)
        if (!gameConnections || gameConnections.size === 0) {
            console.log(`[GameEventBroadcaster] No connections for game ${gameId}, skipping broadcast`)
            return
        }

        const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        let broadcastCount = 0
        let failedConnections: string[] = []

        for (const connectionId of gameConnections) {
            const connection = this.connections.get(connectionId)
            if (!connection) continue

            // Skip if this is the user who triggered the event
            if (excludeUserId && connection.userId === excludeUserId) continue

            try {
                connection.controller.enqueue(eventData)
                broadcastCount++
            } catch (error) {
                console.error(`[GameEventBroadcaster] Failed to send event to ${connectionId}:`, error)
                failedConnections.push(connectionId)
            }
        }

        // Clean up failed connections
        failedConnections.forEach(connectionId => this.removeConnection(connectionId))

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