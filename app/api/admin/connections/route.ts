import { NextResponse } from 'next/server'
import { GlobalEventBroadcaster } from '@/lib/global-events'
import { KVConnectionManager } from '@/lib/kv-connection-manager'
import { ConnectionStatsManager } from '@/lib/connection-stats'
import { kv } from '@vercel/kv'

export async function GET() {
    try {
        const broadcaster = GlobalEventBroadcaster.getInstance()

        // Get direct connections
        const directConnectionCount = broadcaster.getConnectionCount()

        // Test KV availability first
        let kvAvailable = false
        let kvError = null
        try {
            console.log('[Admin Connections API] *** Testing KV availability...')
            // Simple KV test
            await kv.set('test_key', 'test_value')
            await kv.get('test_key')
            await kv.del('test_key')
            kvAvailable = true
            console.log('[Admin Connections API] *** KV is available and working')
        } catch (error) {
            kvAvailable = false
            kvError = (error as Error).message
            console.error('[Admin Connections API] *** KV is NOT available:', error)
        }

        // Get KV connections
        let kvConnections: any[] = []
        let kvConnectionCount = 0
        if (kvAvailable) {
            try {
                kvConnections = await KVConnectionManager.getActiveConnections()
                kvConnectionCount = kvConnections.length
                console.log('[Admin Connections API] *** KV connections retrieved:', kvConnectionCount)
            } catch (error) {
                console.error('[Admin Connections API] *** KV connection retrieval error:', error)
            }
        }

        // Get pending events
        let pendingEvents: any[] = []
        let pendingEventCount = 0
        try {
            const pendingData = await KVConnectionManager.peekPendingEvents()
            pendingEvents = pendingData.map(event => ({
                eventId: event.eventId,
                type: event.event?.type || 'corrupted',
                createdAt: new Date(event.createdAt).toISOString(),
                expiresAt: new Date(event.expiresAt).toISOString(),
                isExpired: Date.now() > event.expiresAt,
                isCorrupted: event.isCorrupted,
                data: event.event?.data || null
            }))
            pendingEventCount = pendingEvents.length
        } catch (error) {
            console.error('[Admin Connections API] Pending events error:', error)
        }

        // Get connection stats from ConnectionStatsManager
        const statsManager = ConnectionStatsManager.getInstance()
        const globalStats = statsManager.getGlobalStats()

        const connectionData = {
            timestamp: new Date().toISOString(),
            kv: {
                available: kvAvailable,
                error: kvError,
                count: kvConnectionCount,
                connections: kvConnections.map(conn => ({
                    connectionId: conn.connectionId,
                    userId: conn.userId,
                    userAddress: conn.userAddress,
                    connectedAt: new Date(conn.connectedAt).toISOString(),
                    lastHeartbeat: new Date(conn.lastHeartbeat).toISOString(),
                    isExpired: Date.now() - conn.lastHeartbeat > 60000,
                })),
            },
            direct: {
                count: directConnectionCount,
                connections: [], // We can't easily expose the actual Map entries for security
            },
            pending: {
                count: pendingEventCount,
                events: pendingEvents,
            },
            stats: globalStats,
            summary: {
                totalConnections: Math.max(directConnectionCount, kvConnectionCount),
                directConnections: directConnectionCount,
                kvConnections: kvConnectionCount,
                isServerless: directConnectionCount === 0 && kvConnectionCount > 0,
                hasConnections: directConnectionCount > 0 || kvConnectionCount > 0,
                kvAvailable: kvAvailable,
                kvError: kvError,
            }
        }

        return NextResponse.json(connectionData)

    } catch (error) {
        console.error('[Admin Connections API] Error:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch connection data',
                message: (error as Error).message
            },
            { status: 500 }
        )
    }
}

export async function DELETE() {
    try {
        console.log('[Admin Connections API] Clearing all connection data...')

        // Clear KV data
        await KVConnectionManager.clearAllPendingEvents()
        await KVConnectionManager.cleanup()

        return NextResponse.json({
            success: true,
            message: 'Connection data cleared successfully',
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('[Admin Connections API] Error clearing data:', error)
        return NextResponse.json(
            {
                error: 'Failed to clear connection data',
                message: (error as Error).message
            },
            { status: 500 }
        )
    }
} 