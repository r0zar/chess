import type { PlayerColor } from "@/lib/chess-logic/types"

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
}

export type GlobalEventType = keyof GlobalEventData
export type GlobalEvent<T extends GlobalEventType = GlobalEventType> = {
    type: T
    data: GlobalEventData[T]
}

export class GlobalEventBroadcaster {
    private static instance: GlobalEventBroadcaster
    private connections = new Map<string, WritableStreamDefaultWriter>()
    private eventQueue = new Map<string, GlobalEvent[]>()

    private constructor() { }

    public static getInstance(): GlobalEventBroadcaster {
        if (!GlobalEventBroadcaster.instance) {
            GlobalEventBroadcaster.instance = new GlobalEventBroadcaster()
        }
        return GlobalEventBroadcaster.instance
    }

    public addConnection(connectionId: string, writer: WritableStreamDefaultWriter): void {
        this.connections.set(connectionId, writer)
        console.log(`[GlobalEvents] Connection added: ${connectionId}. Total: ${this.connections.size}`)

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
                writer.close()
            } catch (error) {
                // Connection might already be closed
            }
        }
        this.connections.delete(connectionId)
        this.eventQueue.delete(connectionId)
        console.log(`[GlobalEvents] Connection removed: ${connectionId}. Total: ${this.connections.size}`)
    }

    public broadcast<T extends GlobalEventType>(event: GlobalEvent<T>): void {
        console.log(`[GlobalEvents] Broadcasting ${event.type} to ${this.connections.size} connections:`, event.data)

        const deadConnections: string[] = []

        for (const [connectionId] of this.connections) {
            try {
                this.sendToConnection(connectionId, event)
            } catch (error) {
                console.error(`[GlobalEvents] Failed to send to connection ${connectionId}:`, error)
                deadConnections.push(connectionId)
            }
        }

        // Clean up dead connections
        deadConnections.forEach(connectionId => {
            this.removeConnection(connectionId)
        })
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

    // Helper methods for common events
    public broadcastUserActivity(userId: string, userAddress: string | undefined, action: 'connected' | 'disconnected'): void {
        this.broadcast({
            type: 'user_activity',
            data: {
                userId,
                userAddress,
                action,
                timestamp: new Date().toISOString()
            }
        })
    }

    public broadcastGameActivity(
        gameId: string,
        action: 'created' | 'joined' | 'ended',
        userId: string,
        userAddress?: string,
        playerColor?: PlayerColor,
        gameStatus?: string,
        winner?: PlayerColor
    ): void {
        this.broadcast({
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
    }

    public broadcastMoveActivity(
        gameId: string,
        userId: string,
        userAddress: string | undefined,
        playerColor: PlayerColor,
        move: string
    ): void {
        this.broadcast({
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
    }
} 