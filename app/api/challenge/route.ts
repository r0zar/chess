import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateSessionId } from '@/lib/session'

// Helper to broadcast global events via PartyKit
async function broadcastGlobalEvent(event: any) {
    try {
        const isProduction = process.env.NODE_ENV === 'production'
        const partyKitHost = isProduction
            ? process.env.PARTYKIT_HOST || 'chess-game.r0zar.partykit.dev'
            : 'localhost:1999'
        const protocol = isProduction ? 'https' : 'http'
        const url = `${protocol}://${partyKitHost}/party/global-events`
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        })
    } catch (err) {
        console.error('[PartyKit] Failed to broadcast global event:', err)
    }
}

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

        // Broadcast the challenge request event via PartyKit
        await broadcastGlobalEvent({
            type: 'challenge_request',
            data: {
                userId,
                userAddress,
                message
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Challenge API] Error:', error)
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
    }
} 