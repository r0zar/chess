import { kv } from '@vercel/kv'
import type { GlobalEvent, GlobalEventType } from './global-events'

export interface ConnectionMetadata {
    connectionId: string
    userId: string
    userAddress?: string
    connectedAt: number
    lastHeartbeat: number
}

export interface PendingEvent {
    id: string
    event: GlobalEvent
    createdAt: number
    expiresAt: number
}

export class KVConnectionManager {
    private static readonly CONNECTIONS_KEY = 'global_connections'
    private static readonly PENDING_EVENTS_KEY = 'pending_events'
    private static readonly CONNECTION_TTL = 60 // 60 seconds
    private static readonly EVENT_TTL = 30 // 30 seconds

    // Store active connection metadata
    static async addConnection(connectionId: string, userId: string, userAddress?: string): Promise<void> {
        console.log(`[KV Connection Manager] *** Starting addConnection for ${connectionId}, user: ${userId}`)

        const connection: ConnectionMetadata = {
            connectionId,
            userId,
            userAddress,
            connectedAt: Date.now(),
            lastHeartbeat: Date.now()
        }

        console.log(`[KV Connection Manager] *** Connection object created:`, connection)

        try {
            console.log(`[KV Connection Manager] *** Calling kv.hset with key: ${this.CONNECTIONS_KEY}`)
            await kv.hset(this.CONNECTIONS_KEY, { [connectionId]: JSON.stringify(connection) })
            console.log(`[KV Connection Manager] *** hset successful. Connection ${connectionId} added to KV`)
            console.log(`[KV Connection Manager] *** Note: Individual connection expiry is handled by lastHeartbeat timestamp, not hash-level TTL`)
        } catch (error) {
            console.error(`[KV Connection Manager] *** Error in addConnection:`, error)
            throw error
        }
    }

    // Remove connection
    static async removeConnection(connectionId: string): Promise<void> {
        console.log(`[KV Connection Manager] Removing connection: ${connectionId}`)
        await kv.hdel(this.CONNECTIONS_KEY, connectionId)
    }

    // Update heartbeat
    static async updateHeartbeat(connectionId: string): Promise<void> {
        const connectionData = await kv.hget(this.CONNECTIONS_KEY, connectionId)
        if (connectionData) {
            // Handle both string and object data from KV
            let connection: ConnectionMetadata
            if (typeof connectionData === 'string') {
                try {
                    connection = JSON.parse(connectionData)
                } catch (parseError) {
                    console.error(`[KV Connection Manager] JSON parse error for connection ${connectionId}:`, parseError)
                    console.error(`[KV Connection Manager] Raw connection data:`, connectionData)
                    return
                }
            } else if (typeof connectionData === 'object' && connectionData !== null) {
                connection = connectionData as ConnectionMetadata
            } else {
                console.error(`[KV Connection Manager] Invalid data type for connection ${connectionId}: ${typeof connectionData}`)
                return
            }

            connection.lastHeartbeat = Date.now()
            await kv.hset(this.CONNECTIONS_KEY, { [connectionId]: JSON.stringify(connection) })
        }
    }

    // Get all active connections
    static async getActiveConnections(): Promise<ConnectionMetadata[]> {
        const connections = await kv.hgetall(this.CONNECTIONS_KEY)
        if (!connections) return []

        console.log(`[KV Connection Manager] Retrieved ${Object.keys(connections).length} raw connections from KV`)

        const now = Date.now()
        const activeConnections: ConnectionMetadata[] = []
        const expiredConnections: string[] = []

        for (const [connectionId, data] of Object.entries(connections)) {
            console.log(`[KV Connection Manager] Processing connection ${connectionId}, data type: ${typeof data}`)

            try {
                // Handle both string and object data from KV
                let connection: ConnectionMetadata
                if (typeof data === 'string') {
                    try {
                        connection = JSON.parse(data)
                    } catch (parseError) {
                        console.error(`[KV Connection Manager] JSON parse error for connection ${connectionId}:`, parseError)
                        console.error(`[KV Connection Manager] Raw connection data:`, data)
                        throw new Error(`Failed to parse connection data: ${parseError}`)
                    }
                } else if (typeof data === 'object' && data !== null) {
                    connection = data as ConnectionMetadata
                } else {
                    throw new Error(`Invalid data type: ${typeof data}`)
                }

                // Validate connection structure
                if (!connection.connectionId || !connection.userId || typeof connection.lastHeartbeat !== 'number') {
                    throw new Error(`Invalid connection structure`)
                }

                // Check if connection is expired (no heartbeat for CONNECTION_TTL seconds)
                if (now - connection.lastHeartbeat > this.CONNECTION_TTL * 1000) {
                    console.log(`[KV Connection Manager] Connection ${connectionId} expired (last heartbeat: ${now - connection.lastHeartbeat}ms ago)`)
                    expiredConnections.push(connectionId)
                } else {
                    console.log(`[KV Connection Manager] Connection ${connectionId} is active`)
                    activeConnections.push(connection)
                }
            } catch (error) {
                console.error(`[KV Connection Manager] Error parsing connection ${connectionId}:`, error)
                console.error(`[KV Connection Manager] Raw data for ${connectionId}:`, JSON.stringify(data))
                expiredConnections.push(connectionId)
            }
        }

        // Clean up expired/corrupted connections
        if (expiredConnections.length > 0) {
            console.log(`[KV Connection Manager] Cleaning up ${expiredConnections.length} expired/corrupted connections`)
            await kv.hdel(this.CONNECTIONS_KEY, ...expiredConnections)
        }

        console.log(`[KV Connection Manager] Returning ${activeConnections.length} active connections`)
        return activeConnections
    }

    // Get connection count
    static async getConnectionCount(): Promise<number> {
        const connections = await this.getActiveConnections()
        return connections.length
    }

    // Store a pending event that connections should pick up
    static async addPendingEvent(event: GlobalEvent): Promise<void> {
        const eventId = crypto.randomUUID()
        const pendingEvent: PendingEvent = {
            id: eventId,
            event,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.EVENT_TTL * 1000)
        }

        console.log(`[KV Connection Manager] Adding pending event: ${event.type}`)
        console.log(`[KV Connection Manager] Event data being stored:`, JSON.stringify(pendingEvent))

        try {
            // Store the stringified event data using correct hset syntax
            const serializedEvent = JSON.stringify(pendingEvent)
            await kv.hset(this.PENDING_EVENTS_KEY, { [eventId]: serializedEvent })
            await kv.expire(this.PENDING_EVENTS_KEY, this.EVENT_TTL)
            console.log(`[KV Connection Manager] Event stored successfully with ID: ${eventId}`)
        } catch (error) {
            console.error(`[KV Connection Manager] Failed to store event:`, error)
            throw error
        }
    }

    // Get and consume pending events (removes them after retrieving)
    static async consumePendingEvents(): Promise<GlobalEvent[]> {
        const pendingEvents = await kv.hgetall(this.PENDING_EVENTS_KEY)
        if (!pendingEvents) return []

        console.log(`[KV Connection Manager] Retrieved ${Object.keys(pendingEvents).length} pending events from KV`)

        const now = Date.now()
        const events: GlobalEvent[] = []
        const expiredEventIds: string[] = []
        const validEventIds: string[] = []

        for (const [eventId, data] of Object.entries(pendingEvents)) {
            console.log(`[KV Connection Manager] Processing event ${eventId}, data type: ${typeof data}, data:`, data)

            try {
                // Check if data is already an object or needs parsing
                let pendingEvent: PendingEvent
                if (typeof data === 'string') {
                    try {
                        pendingEvent = JSON.parse(data)
                    } catch (parseError) {
                        console.error(`[KV Connection Manager] JSON parse error for event ${eventId}:`, parseError)
                        console.error(`[KV Connection Manager] Raw event data:`, data)
                        throw new Error(`Failed to parse event data: ${parseError}`)
                    }
                } else if (typeof data === 'object' && data !== null) {
                    pendingEvent = data as PendingEvent
                } else {
                    throw new Error(`Invalid data type: ${typeof data}`)
                }

                if (now > pendingEvent.expiresAt) {
                    expiredEventIds.push(eventId)
                } else {
                    events.push(pendingEvent.event)
                    validEventIds.push(eventId)
                }
            } catch (error) {
                console.error(`[KV Connection Manager] Error parsing pending event ${eventId}:`, error)
                console.error(`[KV Connection Manager] Raw data for ${eventId}:`, JSON.stringify(data))
                expiredEventIds.push(eventId)
            }
        }

        // Remove all events (both expired and consumed)
        const allEventIds = [...expiredEventIds, ...validEventIds]
        if (allEventIds.length > 0) {
            console.log(`[KV Connection Manager] Consuming ${validEventIds.length} events, cleaning up ${expiredEventIds.length} expired`)
            await kv.hdel(this.PENDING_EVENTS_KEY, ...allEventIds)
        }

        return events
    }

    // Peek at pending events without consuming them (for admin debugging)
    static async peekPendingEvents(): Promise<{ eventId: string, event: GlobalEvent | null, createdAt: number, expiresAt: number, isCorrupted: boolean }[]> {
        const pendingEvents = await kv.hgetall(this.PENDING_EVENTS_KEY)
        if (!pendingEvents) return []

        const now = Date.now()
        const eventDetails: { eventId: string, event: GlobalEvent | null, createdAt: number, expiresAt: number, isCorrupted: boolean }[] = []

        for (const [eventId, data] of Object.entries(pendingEvents)) {
            try {
                let pendingEvent: PendingEvent
                if (typeof data === 'string') {
                    try {
                        pendingEvent = JSON.parse(data)
                    } catch (parseError) {
                        throw new Error(`JSON parse failed: ${parseError}`)
                    }
                } else if (typeof data === 'object' && data !== null) {
                    pendingEvent = data as PendingEvent
                } else {
                    throw new Error(`Invalid data type: ${typeof data}`)
                }

                eventDetails.push({
                    eventId,
                    event: pendingEvent.event,
                    createdAt: pendingEvent.createdAt,
                    expiresAt: pendingEvent.expiresAt,
                    isCorrupted: false
                })
            } catch (error) {
                eventDetails.push({
                    eventId,
                    event: null,
                    createdAt: 0,
                    expiresAt: 0,
                    isCorrupted: true
                })
            }
        }

        return eventDetails
    }

    // Clean up all pending events (for debugging corrupted data)
    static async clearAllPendingEvents(): Promise<void> {
        console.log(`[KV Connection Manager] Clearing all pending events`)
        try {
            await kv.del(this.PENDING_EVENTS_KEY)
            console.log(`[KV Connection Manager] All pending events cleared`)
        } catch (error) {
            console.error(`[KV Connection Manager] Failed to clear pending events:`, error)
        }
    }

    // Clean up expired data
    static async cleanup(): Promise<void> {
        await this.getActiveConnections() // This automatically cleans up expired connections

        // Clean up expired events
        const pendingEvents = await kv.hgetall(this.PENDING_EVENTS_KEY)
        if (!pendingEvents) return

        const now = Date.now()
        const expiredEventIds: string[] = []

        for (const [eventId, data] of Object.entries(pendingEvents)) {
            try {
                // Handle both string and object data from KV
                let pendingEvent: PendingEvent
                if (typeof data === 'string') {
                    try {
                        pendingEvent = JSON.parse(data)
                    } catch (parseError) {
                        console.error(`[KV Connection Manager] JSON parse error in cleanup for event ${eventId}:`, parseError)
                        console.error(`[KV Connection Manager] Raw event data in cleanup:`, data)
                        throw new Error(`Failed to parse event data in cleanup: ${parseError}`)
                    }
                } else if (typeof data === 'object' && data !== null) {
                    pendingEvent = data as PendingEvent
                } else {
                    throw new Error(`Invalid data type: ${typeof data}`)
                }

                if (now > pendingEvent.expiresAt) {
                    expiredEventIds.push(eventId)
                }
            } catch (error) {
                console.error(`[KV Connection Manager] Corrupted event ${eventId}, adding to cleanup:`, error)
                expiredEventIds.push(eventId)
            }
        }

        if (expiredEventIds.length > 0) {
            console.log(`[KV Connection Manager] Cleaning up ${expiredEventIds.length} expired/corrupted events`)
            await kv.hdel(this.PENDING_EVENTS_KEY, ...expiredEventIds)
        }
    }
} 