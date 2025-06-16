import { NextRequest, NextResponse } from 'next/server'
import { broadcastPartyKitEvent } from "@/lib/partykit"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { message, userUuid } = body

        if (!userUuid || typeof userUuid !== 'string' || userUuid.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'userUuid is required' },
                { status: 400 }
            )
        }

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

        console.log(`[Challenge API] Broadcasting challenge request from user ${userUuid}: "${message}"`)

        // Broadcast the challenge request event via PartyKit
        await broadcastPartyKitEvent({
            event: {
                type: 'challenge_request',
                data: {
                    userId: userUuid,
                    userAddress,
                    message
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Challenge API] Error:', error)
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
    }
} 