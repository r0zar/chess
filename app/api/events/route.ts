import { NextRequest } from 'next/server'
import { GlobalEventBroadcaster } from '@/lib/global-events'
import { KVConnectionManager } from '@/lib/kv-connection-manager'
import { getOrCreateSessionId } from '@/lib/session'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    console.log('='.repeat(60))
    console.log('[Global Events API] *** NEW CONNECTION REQUEST RECEIVED ***')
    console.log('[Global Events API] *** Request URL:', request.url)
    console.log('[Global Events API] *** Request headers:', Object.fromEntries(request.headers.entries()))
    console.log('[Global Events API] *** Current broadcaster connection count before adding:', GlobalEventBroadcaster.getInstance().getConnectionCount())

    // Get user session information
    const userId = await getOrCreateSessionId()
    console.log('[Global Events API] *** User ID:', userId)

    const encoder = new TextEncoder()
    const connectionId = crypto.randomUUID()
    console.log('[Global Events API] *** Generated connection ID:', connectionId)

    const stream = new ReadableStream({
        async start(controller) {
            console.log(`[Global Events API] Starting stream for connection ${connectionId}`)

            // Set up the connection
            const writer = new WritableStream({
                write(chunk) {
                    try {
                        controller.enqueue(chunk)
                    } catch (error) {
                        console.error(`[Global Events API] Error enqueueing chunk for ${connectionId}:`, error)
                    }
                },
                close() {
                    console.log(`[Global Events API] Stream closed for ${connectionId}`)
                    GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
                    KVConnectionManager.removeConnection(connectionId).catch(console.error)
                },
                abort() {
                    console.log(`[Global Events API] Stream aborted for ${connectionId}`)
                    GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
                    KVConnectionManager.removeConnection(connectionId).catch(console.error)
                }
            }).getWriter()

            // Add this connection to the broadcaster and KV
            console.log(`[Global Events API] *** Adding connection ${connectionId} for user ${userId}`)
            const broadcaster = GlobalEventBroadcaster.getInstance()
            console.log(`[Global Events API] *** Broadcaster instance ID:`, broadcaster.constructor.name)
            broadcaster.addConnection(connectionId, writer, userId)

            // Also register in KV for serverless persistence
            try {
                console.log(`[Global Events API] *** Attempting to register connection ${connectionId} for user ${userId} in KV...`)
                await KVConnectionManager.addConnection(connectionId, userId)
                console.log(`[Global Events API] *** Connection successfully registered in KV`)

                // Verify registration
                const kvConnections = await KVConnectionManager.getActiveConnections()
                console.log(`[Global Events API] *** KV now has ${kvConnections.length} total connections`)
            } catch (error) {
                console.error(`[Global Events API] *** Failed to register connection in KV:`, error)
                console.error(`[Global Events API] *** Error details:`, (error as Error).message)
            }

            console.log(`[Global Events API] *** Connection added. New total count:`, broadcaster.getConnectionCount())

            // Send initial connection message
            const welcomeMessage = encoder.encode(`data: ${JSON.stringify({
                type: 'connection',
                data: { connectionId, message: 'Global events connected' }
            })}\n\n`)

            try {
                controller.enqueue(welcomeMessage)
            } catch (error) {
                console.error(`[Global Events API] Error sending welcome message for ${connectionId}:`, error)
            }

            // Force broadcast initial connection stats after a brief delay to ensure connection is registered
            setTimeout(async () => {
                await GlobalEventBroadcaster.getInstance().broadcastConnectionStats()
            }, 100)

            // Poll for pending events from KV
            const pollPendingEvents = async () => {
                try {
                    const pendingEvents = await KVConnectionManager.consumePendingEvents()
                    for (const event of pendingEvents) {
                        console.log(`[Global Events API] *** Sending pending ${event.type} event to ${connectionId}`)
                        const eventData = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                        try {
                            controller.enqueue(eventData)
                        } catch (error) {
                            console.error(`[Global Events API] *** Error sending pending event to ${connectionId}:`, error)
                            break
                        }
                    }

                    // Update heartbeat in KV
                    await KVConnectionManager.updateHeartbeat(connectionId)
                } catch (error) {
                    console.error(`[Global Events API] *** Error polling pending events for ${connectionId}:`, error)

                    // If we get corrupted data errors, try to clean up
                    if (error instanceof Error && 'message' in error && error.message.includes('not valid JSON')) {
                        console.log(`[Global Events API] *** Detected corrupted KV data, running cleanup...`)
                        try {
                            await KVConnectionManager.cleanup()
                        } catch (cleanupError) {
                            console.error(`[Global Events API] *** Cleanup failed:`, cleanupError)
                        }
                    }
                }
            }

            // Poll every 2 seconds for pending events
            const pollInterval = setInterval(pollPendingEvents, 2000)

            // Set up heartbeat
            const heartbeatInterval = setInterval(() => {
                try {
                    const heartbeat = encoder.encode(`data: ${JSON.stringify({
                        type: 'heartbeat',
                        data: { timestamp: new Date().toISOString() }
                    })}\n\n`)
                    controller.enqueue(heartbeat)
                } catch (error) {
                    console.error(`[Global Events API] Heartbeat failed for ${connectionId}:`, error)
                    clearInterval(heartbeatInterval)
                    clearInterval(pollInterval)
                    GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
                    KVConnectionManager.removeConnection(connectionId).catch(console.error)
                }
            }, 30000) // 30 seconds

            // Clean up on disconnect
            request.signal.addEventListener('abort', () => {
                console.log(`[Global Events API] Request aborted for ${connectionId}`)
                clearInterval(heartbeatInterval)
                clearInterval(pollInterval)
                GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
                KVConnectionManager.removeConnection(connectionId).catch(console.error)
                try {
                    controller.close()
                } catch (error) {
                    // Controller might already be closed
                }
            })
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Cache-Control',
        },
    })
} 