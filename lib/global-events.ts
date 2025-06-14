import type { PlayerColor } from "@/lib/chess-logic/types"
import { ConnectionStatsManager } from "@/lib/connection-stats"
import { KVConnectionManager } from "@/lib/kv-connection-manager"

export interface GlobalEventData {
    user_activity: {
        userId: string
        userAddress?: string
        action: 'connected' | 'disconnected'
        timestamp: string
    }
    game_activity: {
        gameId: string
        action: 'created' | 'joined' | 'ended'
        playerColor?: PlayerColor
        userId: string
        userAddress?: string
        gameStatus?: string
        winner?: PlayerColor
        timestamp: string
    }
    move_activity: {
        gameId: string
        userId: string
        userAddress?: string
        playerColor: PlayerColor
        move: string // SAN notation
        timestamp: string
    }
    connection_stats: {
        global: {
            totalConnections: number
            activePlayers: number
            totalSpectators: number
            connectedUsers: string[]
        }
        timestamp: string
    }
    challenge_request: {
        userId: string
        userAddress?: string
        message: string
        timestamp: string
    }
}

export type GlobalEventType = keyof GlobalEventData
export type GlobalEvent<T extends GlobalEventType = GlobalEventType> = {
    type: T
    data: GlobalEventData[T]
}

// Global variable to persist across serverless function invocations
declare global {
    var __globalEventBroadcaster: GlobalEventBroadcaster | undefined
}

export class GlobalEventBroadcaster {
    private static instance: GlobalEventBroadcaster
    private connections = new Map<string, WritableStreamDefaultWriter>()
    private eventQueue = new Map<string, GlobalEvent[]>()

    private constructor() { }

    public static getInstance(): GlobalEventBroadcaster {
        // In serverless environments, use global variable to persist across invocations
        if (typeof global !== 'undefined' && global.__globalEventBroadcaster) {
            GlobalEventBroadcaster.instance = global.__globalEventBroadcaster
        }

        if (!GlobalEventBroadcaster.instance) {
            GlobalEventBroadcaster.instance = new GlobalEventBroadcaster()

            // Store in global for serverless persistence
            if (typeof global !== 'undefined') {
                global.__globalEventBroadcaster = GlobalEventBroadcaster.instance
            }
        }
        return GlobalEventBroadcaster.instance
    }

    public addConnection(connectionId: string, writer: WritableStreamDefaultWriter, userId?: string, userAddress?: string): void {
        this.connections.set(connectionId, writer)
        console.log(`[GlobalEvents] Connection added: ${connectionId}. Total: ${this.connections.size}`)

        // Add to connection stats
        if (userId) {
            ConnectionStatsManager.getInstance().addGlobalConnection(connectionId, userId, userAddress)
            // Broadcast updated stats
            this.broadcastConnectionStats()
        }

        // Send any queued events to this new connection
        const queuedEvents = this.eventQueue.get(connectionId) || []
        queuedEvents.forEach(event => {
            this.sendToConnection(connectionId, event)
        })
        this.eventQueue.delete(connectionId)
    }

    public removeConnection(connectionId: string): void {
        const writer = this.connections.get(connectionId)
        if (writer) {
            try {
                writer.close().catch(() => {
                    // Connection might already be closed
                })
            } catch (error) {
                // Connection might already be closed
            }
        }
        this.connections.delete(connectionId)
        this.eventQueue.delete(connectionId)

        // Remove from connection stats
        ConnectionStatsManager.getInstance().removeGlobalConnection(connectionId)
        // Broadcast updated stats
        this.broadcastConnectionStats()

        console.log(`[GlobalEvents] Connection removed: ${connectionId}. Total: ${this.connections.size}`)
    }

    public async broadcast<T extends GlobalEventType>(event: GlobalEvent<T>): Promise<void> {
        console.log(`[GlobalEvents] *** Broadcasting ${event.type} to ${this.connections.size} direct connections:`, event.data)
        console.log(`[GlobalEvents] *** Direct connection IDs:`, Array.from(this.connections.keys()))

        const deadConnections: string[] = []

        // Send to direct connections first
        for (const [connectionId] of this.connections) {
            try {
                console.log(`[GlobalEvents] *** Sending ${event.type} to direct connection ${connectionId}`)
                this.sendToConnection(connectionId, event)
                console.log(`[GlobalEvents] *** Successfully sent ${event.type} to direct connection ${connectionId}`)
            } catch (error) {
                console.error(`[GlobalEvents] Failed to send to direct connection ${connectionId}:`, error)
                deadConnections.push(connectionId)
            }
        }

        // Clean up dead connections
        deadConnections.forEach(connectionId => {
            this.removeConnection(connectionId)
        })

        // Check KV connections for serverless compatibility
        let kvConnectionCount = 0
        try {
            const kvConnections = await KVConnectionManager.getActiveConnections()
            kvConnectionCount = kvConnections.length
            console.log(`[GlobalEvents] *** Found ${kvConnectionCount} active connections in KV`)
        } catch (error) {
            console.log(`[GlobalEvents] *** KV check failed (development):`, (error as Error).message)
        }

        // Always store in KV for serverless pickup, regardless of direct connections
        console.log(`[GlobalEvents] *** Storing event in KV for serverless pickup (KV connections: ${kvConnectionCount})`)
        try {
            await KVConnectionManager.addPendingEvent(event)
            console.log(`[GlobalEvents] *** Event stored in KV successfully`)
        } catch (error) {
            console.error(`[GlobalEvents] *** Failed to store event in KV:`, error)
        }

        const totalConnections = this.connections.size + kvConnectionCount
        console.log(`[GlobalEvents] *** Broadcast complete. Total reachable connections: ${totalConnections} (Direct: ${this.connections.size}, KV: ${kvConnectionCount})`)
    }

    private sendToConnection(connectionId: string, event: GlobalEvent): void {
        const writer = this.connections.get(connectionId)
        if (!writer) return

        try {
            const encoder = new TextEncoder()
            const data = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)

            writer.write(data).catch(() => {
                // Connection is dead, will be cleaned up
                this.removeConnection(connectionId)
            })
        } catch (error) {
            console.error(`[GlobalEvents] Error sending to connection ${connectionId}:`, error)
            this.removeConnection(connectionId)
        }
    }

    public getConnectionCount(): number {
        return this.connections.size
    }

    public async getTotalConnectionCount(): Promise<number> {
        const kvCount = await KVConnectionManager.getConnectionCount()
        const directCount = this.connections.size
        console.log(`[GlobalEvents] *** Connection count - Direct: ${directCount}, KV: ${kvCount}`)
        return Math.max(directCount, kvCount) // Use the higher count to avoid double counting
    }

    // Helper methods for common events
    public async broadcastUserActivity(userId: string, userAddress: string | undefined, action: 'connected' | 'disconnected'): Promise<void> {
        await this.broadcast({
            type: 'user_activity',
            data: {
                userId,
                userAddress,
                action,
                timestamp: new Date().toISOString()
            }
        })
    }

    public async broadcastGameActivity(
        gameId: string,
        action: 'created' | 'joined' | 'ended',
        userId: string,
        userAddress?: string,
        playerColor?: PlayerColor,
        gameStatus?: string,
        winner?: PlayerColor
    ): Promise<void> {
        console.log('[GlobalEventBroadcaster] broadcastGameActivity called:', {
            gameId, action, userId, userAddress, playerColor, gameStatus, winner
        })

        await this.broadcast({
            type: 'game_activity',
            data: {
                gameId,
                action,
                playerColor,
                userId,
                userAddress,
                gameStatus,
                winner,
                timestamp: new Date().toISOString()
            }
        })

        console.log('[GlobalEventBroadcaster] broadcastGameActivity completed')
    }

    public async broadcastMoveActivity(
        gameId: string,
        userId: string,
        userAddress: string | undefined,
        playerColor: PlayerColor,
        move: string
    ): Promise<void> {
        console.log('[GlobalEventBroadcaster] *** broadcastMoveActivity called:', {
            gameId, userId, userAddress, playerColor, move
        })

        await this.broadcast({
            type: 'move_activity',
            data: {
                gameId,
                userId,
                userAddress,
                playerColor,
                move,
                timestamp: new Date().toISOString()
            }
        })

        console.log('[GlobalEventBroadcaster] *** broadcastMoveActivity completed')
    }

    public async broadcastConnectionStats(): Promise<void> {
        const stats = ConnectionStatsManager.getInstance().getGlobalStats()

        console.log('[GlobalEventBroadcaster] *** Broadcasting connection stats:', stats)

        await this.broadcast({
            type: 'connection_stats',
            data: {
                global: stats,
                timestamp: new Date().toISOString()
            }
        })
    }

    public async broadcastChallengeRequest(
        userId: string,
        userAddress: string | undefined,
        message: string
    ): Promise<void> {
        console.log('[GlobalEventBroadcaster] *** Broadcasting challenge request from:', userId)

        await this.broadcast({
            type: 'challenge_request',
            data: {
                userId,
                userAddress,
                message,
                timestamp: new Date().toISOString()
            }
        })
    }
}  