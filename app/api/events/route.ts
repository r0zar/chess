import { NextRequest } from 'next/server'
import { GlobalEventBroadcaster } from '@/lib/global-events'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    console.log('[Global Events API] New connection request')

    const encoder = new TextEncoder()
    const connectionId = crypto.randomUUID()

    const stream = new ReadableStream({
        start(controller) {
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
                },
                abort() {
                    console.log(`[Global Events API] Stream aborted for ${connectionId}`)
                    GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
                }
            }).getWriter()

            // Add this connection to the broadcaster
            GlobalEventBroadcaster.getInstance().addConnection(connectionId, writer)

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
                    GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
                }
            }, 30000) // 30 seconds

            // Clean up on disconnect
            request.signal.addEventListener('abort', () => {
                console.log(`[Global Events API] Request aborted for ${connectionId}`)
                clearInterval(heartbeatInterval)
                GlobalEventBroadcaster.getInstance().removeConnection(connectionId)
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