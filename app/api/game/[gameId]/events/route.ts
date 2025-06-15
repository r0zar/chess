import { type NextRequest } from "next/server"
// import { GameEventBroadcaster } from "@/lib/game-events" // Removed: legacy SSE
import { getOrCreateSessionId } from "@/lib/session"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { mapIdentityToColor } from "@/lib/chess-logic/mappers"

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

// SSE endpoint is deprecated. Use PartyKit for real-time events.
export async function GET(request: NextRequest) {
    return new Response("SSE endpoint is no longer supported. Use PartyKit for real-time events.", { status: 410 })
}

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