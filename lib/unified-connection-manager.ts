import { kv } from '@vercel/kv'
import type { PlayerColor } from '@/lib/chess-logic/types'
import type { GameEvent } from '@/lib/game-events'
import type { GlobalEvent } from '@/lib/global-events'

// Unified event type that can be either global or game-specific
export type UnifiedEvent = GlobalEvent | (GameEvent & { gameId: string })

export interface Connection {
    connectionId: string
    userId: string
    userAddress?: string
    connectedAt: number
    lastHeartbeat: number
    gameSubscriptions: string[] // gameIds this connection is subscribed to
    role?: 'player' | 'spectator' // only set if in a game
    playerColor?: 'w' | 'b' // only set if role is player
}

export interface StoredEvent {
    id: string
    event: UnifiedEvent
    targetGameId?: string // if set, only send to connections subscribed to this game
    excludeUserId?: string
    createdAt: number
    expiresAt: number
}

export class UnifiedConnectionManager {
    private static readonly CONNECTIONS_KEY = 'unified_connections'
    private static readonly EVENTS_KEY = 'unified_events'
    private static readonly CONNECTION_TTL = 60 // seconds
    private static readonly EVENT_TTL = 30 // seconds

    // In-memory connection management for direct SSE
    private static connections = new Map<string, {
        controller: ReadableStreamDefaultController
        connection: Connection
    }>()

    // Add a new connection
    static async addConnection(
        connectionId: string,
        userId: string,
        controller: ReadableStreamDefaultController,
        userAddress?: string
    ): Promise<void> {
        console.log(`[UnifiedConnection] Adding connection ${connectionId} for user ${userId}`)

        const connection: Connection = {
            connectionId,
            userId,
            userAddress,
            connectedAt: Date.now(),
            lastHeartbeat: Date.now(),
            gameSubscriptions: []
        }

        // Store in memory for direct SSE
        this.connections.set(connectionId, { controller, connection })

        // Store in KV for persistence
        await kv.hset(this.CONNECTIONS_KEY, {
            [connectionId]: JSON.stringify(connection)
        })

        console.log(`[UnifiedConnection] Connection ${connectionId} added. Total: ${this.connections.size}`)

        // Broadcast updated stats
        await this.broadcastConnectionStats()
    }

    // Subscribe connection to a specific game
    static async subscribeToGame(
        connectionId: string,
        gameId: string,
        role: 'player' | 'spectator' = 'spectator',
        playerColor?: 'w' | 'b'
    ): Promise<void> {
        console.log(`[UnifiedConnection] Subscribing ${connectionId} to game ${gameId} as ${role}`)

        // Update in-memory connection
        const memConnection = this.connections.get(connectionId)
        if (memConnection) {
            if (!memConnection.connection.gameSubscriptions.includes(gameId)) {
                memConnection.connection.gameSubscriptions.push(gameId)
            }
            memConnection.connection.role = role
            memConnection.connection.playerColor = playerColor
        }

        // Update in KV
        const kvConnection = await kv.hget(this.CONNECTIONS_KEY, connectionId)
        if (kvConnection) {
            const connection: Connection = typeof kvConnection === 'string'
                ? JSON.parse(kvConnection)
                : kvConnection as Connection

            if (!connection.gameSubscriptions.includes(gameId)) {
                connection.gameSubscriptions.push(gameId)
            }
            connection.role = role
            connection.playerColor = playerColor
            connection.lastHeartbeat = Date.now()

            await kv.hset(this.CONNECTIONS_KEY, {
                [connectionId]: JSON.stringify(connection)
            })
        }

        console.log(`[UnifiedConnection] ${connectionId} subscribed to game ${gameId}`)
        await this.broadcastConnectionStats()
    }

    // Remove connection
    static async removeConnection(connectionId: string): Promise<void> {
        console.log(`[UnifiedConnection] Removing connection ${connectionId}`)

        this.connections.delete(connectionId)
        await kv.hdel(this.CONNECTIONS_KEY, connectionId)

        console.log(`[UnifiedConnection] Connection ${connectionId} removed. Total: ${this.connections.size}`)
        await this.broadcastConnectionStats()
    }

    // Update heartbeat
    static async updateHeartbeat(connectionId: string): Promise<void> {
        // Update in-memory
        const memConnection = this.connections.get(connectionId)
        if (memConnection) {
            memConnection.connection.lastHeartbeat = Date.now()
        }

        // Update in KV
        const kvConnection = await kv.hget(this.CONNECTIONS_KEY, connectionId)
        if (kvConnection) {
            const connection: Connection = typeof kvConnection === 'string'
                ? JSON.parse(kvConnection)
                : kvConnection as Connection
            connection.lastHeartbeat = Date.now()
            await kv.hset(this.CONNECTIONS_KEY, {
                [connectionId]: JSON.stringify(connection)
            })
        }
    }

    // Broadcast event to all relevant connections
    static async broadcast(
        event: UnifiedEvent,
        targetGameId?: string,
        excludeUserId?: string
    ): Promise<void> {
        console.log(`[UnifiedConnection] Broadcasting ${event.type}${targetGameId ? ` to game ${targetGameId}` : ' globally'}`)

        // Send to direct connections
        let directCount = 0
        const failedConnections: string[] = []

        for (const [connectionId, { controller, connection }] of this.connections) {
            // Check if this connection should receive the event
            if (excludeUserId && connection.userId === excludeUserId) {
                continue
            }

            if (targetGameId && !connection.gameSubscriptions.includes(targetGameId)) {
                continue
            }

            try {
                const eventData = `data: ${JSON.stringify(event)}\n\n`
                controller.enqueue(eventData)
                directCount++
            } catch (error) {
                console.error(`[UnifiedConnection] Failed to send to ${connectionId}:`, error)
                failedConnections.push(connectionId)
            }
        }

        // Clean up failed connections
        for (const connectionId of failedConnections) {
            await this.removeConnection(connectionId)
        }

        // Store in KV for connections that might pick it up later
        await this.storeEvent(event, targetGameId, excludeUserId)

        console.log(`[UnifiedConnection] Broadcast complete. Direct: ${directCount}, Failed: ${failedConnections.length}`)
    }

    // Store event in KV for persistent delivery
    private static async storeEvent(
        event: UnifiedEvent,
        targetGameId?: string,
        excludeUserId?: string
    ): Promise<void> {
        const eventId = crypto.randomUUID()
        const storedEvent: StoredEvent = {
            id: eventId,
            event,
            targetGameId,
            excludeUserId,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.EVENT_TTL * 1000)
        }

        await kv.hset(this.EVENTS_KEY, {
            [eventId]: JSON.stringify(storedEvent)
        })
        await kv.expire(this.EVENTS_KEY, this.EVENT_TTL)
    }

    // Get and consume pending events for a connection
    static async consumePendingEvents(connectionId: string): Promise<UnifiedEvent[]> {
        const connection = await this.getConnection(connectionId)
        if (!connection) return []

        const events = await kv.hgetall(this.EVENTS_KEY)
        if (!events) return []

        const relevantEvents: UnifiedEvent[] = []
        const consumedEventIds: string[] = []

        for (const [eventId, data] of Object.entries(events)) {
            try {
                const storedEvent: StoredEvent = typeof data === 'string'
                    ? JSON.parse(data)
                    : data as StoredEvent

                // Check if event is expired
                if (Date.now() > storedEvent.expiresAt) {
                    consumedEventIds.push(eventId)
                    continue
                }

                // Check if this connection should receive the event
                if (storedEvent.excludeUserId === connection.userId) {
                    continue
                }

                if (storedEvent.targetGameId && !connection.gameSubscriptions.includes(storedEvent.targetGameId)) {
                    continue
                }

                relevantEvents.push(storedEvent.event)
                consumedEventIds.push(eventId)

            } catch (error) {
                console.error(`[UnifiedConnection] Error parsing event ${eventId}:`, error)
                consumedEventIds.push(eventId) // Remove corrupted events
            }
        }

        // Remove consumed/expired events
        if (consumedEventIds.length > 0) {
            await kv.hdel(this.EVENTS_KEY, ...consumedEventIds)
        }

        return relevantEvents
    }

    // Get connection from KV
    private static async getConnection(connectionId: string): Promise<Connection | null> {
        const data = await kv.hget(this.CONNECTIONS_KEY, connectionId)
        if (!data) return null

        return typeof data === 'string' ? JSON.parse(data) : data as Connection
    }

    // Get all active connections
    static async getActiveConnections(): Promise<Connection[]> {
        const connections = await kv.hgetall(this.CONNECTIONS_KEY)
        if (!connections) return []

        const now = Date.now()
        const activeConnections: Connection[] = []
        const expiredIds: string[] = []

        for (const [connectionId, data] of Object.entries(connections)) {
            try {
                const connection: Connection = typeof data === 'string'
                    ? JSON.parse(data)
                    : data as Connection

                if (now - connection.lastHeartbeat > this.CONNECTION_TTL * 1000) {
                    expiredIds.push(connectionId)
                } else {
                    activeConnections.push(connection)
                }
            } catch (error) {
                console.error(`[UnifiedConnection] Error parsing connection ${connectionId}:`, error)
                expiredIds.push(connectionId)
            }
        }

        // Clean up expired connections
        if (expiredIds.length > 0) {
            await kv.hdel(this.CONNECTIONS_KEY, ...expiredIds)
        }

        return activeConnections
    }

    // Get connection stats
    static async getConnectionStats() {
        const connections = await this.getActiveConnections()
        const uniqueUsers = new Set<string>()
        let activePlayers = 0
        let totalSpectators = 0

        for (const connection of connections) {
            uniqueUsers.add(connection.userId)
            if (connection.role === 'player') {
                activePlayers++
            } else if (connection.role === 'spectator') {
                totalSpectators++
            }
        }

        return {
            totalConnections: connections.length,
            activePlayers,
            totalSpectators,
            connectedUsers: Array.from(uniqueUsers)
        }
    }

    // Broadcast connection stats
    static async broadcastConnectionStats(): Promise<void> {
        const stats = await this.getConnectionStats()
        await this.broadcast({
            type: 'connection_stats',
            data: {
                global: stats,
                timestamp: new Date().toISOString()
            }
        })
    }

    // Debug methods
    static getDirectConnectionCount(): number {
        return this.connections.size
    }

    static async getDebugInfo(gameId?: string) {
        const kvConnections = await this.getActiveConnections()
        const directConnections = Array.from(this.connections.values()).map(c => c.connection)

        return {
            direct: {
                count: directConnections.length,
                connections: directConnections
            },
            kv: {
                count: kvConnections.length,
                connections: kvConnections
            },
            gameFilter: gameId,
            timestamp: new Date().toISOString()
        }
    }
} 