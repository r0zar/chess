import { NextRequest } from "next/server"
import { getOrCreateSessionId } from "@/lib/session"
import { UnifiedConnectionManager } from "@/lib/unified-connection-manager"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"

export async function GET(request: NextRequest) {
    console.log('='.repeat(60))
    console.log('[Unified Events API] *** NEW CONNECTION REQUEST ***')

    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')
    const userId = await getOrCreateSessionId()

    console.log('[Unified Events API] User ID:', userId)
    console.log('[Unified Events API] Game ID:', gameId)

    const encoder = new TextEncoder()
    const connectionId = crypto.randomUUID()
    console.log('[Unified Events API] Connection ID:', connectionId)

    const stream = new ReadableStream({
        async start(controller) {
            console.log(`[Unified Events API] Starting unified stream for ${connectionId}`)

            try {
                // Add unified connection
                await UnifiedConnectionManager.addConnection(connectionId, userId, controller)

                // If gameId provided, subscribe to that game
                if (gameId) {
                    console.log(`[Unified Events API] Subscribing to game ${gameId}`)

                    // Get game data to determine role
                    const gameData = await kv.hgetall(`game:${gameId}`) as GameData | null
                    let role: 'player' | 'spectator' = 'spectator'
                    let playerColor: 'w' | 'b' | undefined = undefined

                    if (gameData) {
                        if (gameData.playerWhiteId === userId) {
                            role = 'player'
                            playerColor = 'w'
                        } else if (gameData.playerBlackId === userId) {
                            role = 'player'
                            playerColor = 'b'
                        }
                    }

                    await UnifiedConnectionManager.subscribeToGame(connectionId, gameId, role, playerColor)
                }

                // Send welcome message
                const welcomeMessage = encoder.encode(`data: ${JSON.stringify({
                    type: 'connected',
                    data: {
                        connectionId,
                        userId,
                        gameId,
                        message: 'Unified events connected'
                    }
                })}\n\n`)

                controller.enqueue(welcomeMessage)

                // Set up event polling for KV-stored events
                const pollInterval = setInterval(async () => {
                    try {
                        const pendingEvents = await UnifiedConnectionManager.consumePendingEvents(connectionId)
                        for (const event of pendingEvents) {
                            const eventData = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                            controller.enqueue(eventData)
                        }

                        // Update heartbeat
                        await UnifiedConnectionManager.updateHeartbeat(connectionId)
                    } catch (error) {
                        console.error(`[Unified Events API] Error polling events for ${connectionId}:`, error)
                    }
                }, 2000) // Poll every 2 seconds

                // Set up heartbeat
                const heartbeatInterval = setInterval(() => {
                    try {
                        const heartbeat = encoder.encode(`data: ${JSON.stringify({
                            type: 'heartbeat',
                            data: { timestamp: new Date().toISOString() }
                        })}\n\n`)
                        controller.enqueue(heartbeat)
                    } catch (error) {
                        console.error(`[Unified Events API] Heartbeat failed for ${connectionId}:`, error)
                        clearInterval(heartbeatInterval)
                        clearInterval(pollInterval)
                        UnifiedConnectionManager.removeConnection(connectionId)
                    }
                }, 30000) // 30 seconds

                // Handle client disconnect
                request.signal.addEventListener('abort', async () => {
                    console.log(`[Unified Events API] Client disconnected: ${connectionId}`)
                    clearInterval(heartbeatInterval)
                    clearInterval(pollInterval)
                    await UnifiedConnectionManager.removeConnection(connectionId)
                    try {
                        controller.close()
                    } catch (error) {
                        // Controller might already be closed
                    }
                })

            } catch (error) {
                console.error(`[Unified Events API] Error setting up connection ${connectionId}:`, error)
                try {
                    controller.close()
                } catch (closeError) {
                    // Ignore close errors
                }
            }
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'X-Accel-Buffering': 'no' // Disable compression for SSE
        },
    })
} 