import { NextRequest, NextResponse } from 'next/server'
import { GlobalEventBroadcaster } from '@/lib/global-events'
import { KVConnectionManager } from '@/lib/kv-connection-manager'
import { getOrCreateSessionId } from '@/lib/session'

export async function POST(request: NextRequest) {
    try {
        const userId = await getOrCreateSessionId()
        const body = await request.json()

        const { message } = body

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Message is required' },
                { status: 400 }
            )
        }

        if (message.length > 100) {
            return NextResponse.json(
                { success: false, message: 'Message must be 100 characters or less' },
                { status: 400 }
            )
        }

        // Get user address from headers if available (from wallet connection)
        const userAddress = request.headers.get('x-user-address') || undefined

        console.log(`[Challenge API] Broadcasting challenge request from user ${userId}: "${message}"`)

        // Debug: Check current connection count
        const broadcaster = GlobalEventBroadcaster.getInstance()
        console.log(`[Challenge API] *** Direct connection count:`, broadcaster.getConnectionCount())

        // Check KV connection count separately
        let kvConnectionCount = 0
        try {
            const kvConnections = await KVConnectionManager.getActiveConnections()
            kvConnectionCount = kvConnections.length
            console.log(`[Challenge API] *** KV connection count:`, kvConnectionCount)
        } catch (error) {
            console.log(`[Challenge API] *** KV not available (development):`, (error as Error).message)
        }

        console.log(`[Challenge API] *** Broadcaster instance ID:`, broadcaster.constructor.name)

        // Broadcast the challenge request
        await broadcaster.broadcastChallengeRequest(
            userId,
            userAddress,
            message.trim()
        )

        return NextResponse.json({
            success: true,
            message: 'Challenge request sent!'
        })

    } catch (error) {
        console.error('[Challenge API] Error broadcasting challenge request:', error)
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        )
    }
} 