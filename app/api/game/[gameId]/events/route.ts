import { type NextRequest } from "next/server"
import { GameEventBroadcaster } from "@/lib/game-events"
import { getOrCreateSessionId } from "@/lib/session"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { mapIdentityToColor } from "@/lib/chess-logic/mappers"

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const { gameId } = await params
    const userId = await getOrCreateSessionId()

    console.log(`[SSE Events] New connection request for game ${gameId} from user ${userId}`)

    // Verify game exists and get game data
    let gameData: GameData | null = null
    try {
        gameData = await kv.hgetall(`game:${gameId}`) as GameData | null
        if (!gameData || !gameData.currentFen) {
            return new Response("Game not found", { status: 404 })
        }
    } catch (error) {
        console.error(`[SSE Events] Error checking game ${gameId}:`, error)
        return new Response("Internal server error", { status: 500 })
    }

    // Create SSE response stream
    const responseStream = new ReadableStream({
        start(controller) {
            console.log(`[SSE Events] Starting SSE stream for game ${gameId}, user ${userId}`)

            // Add connection to broadcaster
            const gameConnectionData = gameData ? {
                playerWhiteId: gameData.playerWhiteId || undefined,
                playerBlackId: gameData.playerBlackId || undefined,
                playerWhiteAddress: gameData.playerWhiteAddress || undefined,
                playerBlackAddress: gameData.playerBlackAddress || undefined
            } : undefined
            const connectionId = GameEventBroadcaster.addConnection(gameId, userId, controller, gameConnectionData)

            // Send initial connection confirmation
            const welcomeEvent = `event: connected\ndata: ${JSON.stringify({
                gameId,
                userId,
                timestamp: Date.now(),
                connectionId
            })}\n\n`

            try {
                controller.enqueue(welcomeEvent)
            } catch (error) {
                console.error(`[SSE Events] Failed to send welcome event:`, error)
                GameEventBroadcaster.removeConnection(connectionId)
                return
            }

            // Send initial game state
            kv.hgetall(`game:${gameId}`).then(gameData => {
                const typedGameData = gameData as GameData | null
                if (typedGameData && typedGameData.currentFen) {
                    const game = new ChessJsAdapter(typedGameData.currentFen)
                    const initialState = {
                        fen: typedGameData.currentFen,
                        turn: game.getTurn(),
                        status: typedGameData.status,
                        winner: mapIdentityToColor(typedGameData.winner),
                        playerWhiteId: typedGameData.playerWhiteId,
                        playerBlackId: typedGameData.playerBlackId,
                        playerWhiteAddress: typedGameData.playerWhiteAddress,
                        playerBlackAddress: typedGameData.playerBlackAddress,
                        connectionCount: GameEventBroadcaster.getConnectionCount(gameId)
                    }

                    GameEventBroadcaster.sendInitialState(connectionId, initialState)
                }
            }).catch(error => {
                console.error(`[SSE Events] Failed to send initial state:`, error)
            })

            // Handle connection cleanup on client disconnect
            request.signal?.addEventListener('abort', () => {
                console.log(`[SSE Events] Client disconnected from game ${gameId}, user ${userId}`)
                GameEventBroadcaster.removeConnection(connectionId)
            })
        },

        cancel() {
            console.log(`[SSE Events] Stream cancelled for game ${gameId}, user ${userId}`)
            // Connection cleanup handled by the broadcaster
        }
    })

    return new Response(responseStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET',
            // Disable compression for SSE
            'X-Accel-Buffering': 'no'
        }
    })
}

// Handle preflight requests
export async function OPTIONS() {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        }
    })
} 