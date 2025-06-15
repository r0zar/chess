// New API route to fetch games list for the client-side index page
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const gameIds = await kv.zrange<string[]>("games_by_update_time", 0, 19, { rev: true })

    if (!gameIds || gameIds.length === 0) {
      return NextResponse.json([])
    }

    const multi = kv.multi()
    gameIds.forEach((id) => {
      if (typeof id === "string") {
        // Ensure we fetch all necessary fields, including player IDs and addresses
        multi.hgetall(`game:${id}`)
      }
    })
    const results = (await multi.exec()) as (GameData | null)[]

    const games = results
      .filter((game) => game !== null && Object.keys(game).length > 0 && game.id)
      .map((game) => {
        // Ensure all relevant fields are present, even if null, for consistent client-side handling
        return {
          id: game!.id,
          createdAt: game!.createdAt,
          updatedAt: game!.updatedAt,
          currentFen: game!.currentFen,
          initialFen: game!.initialFen,
          status: game!.status,
          playerWhiteId: game!.playerWhiteId || null,
          playerBlackId: game!.playerBlackId || null,
          playerWhiteAddress: game!.playerWhiteAddress || null,
          playerBlackAddress: game!.playerBlackAddress || null,
          winner: game!.winner || null,
        }
      }) as GameData[] // Type assertion after mapping

    return NextResponse.json(games)
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error fetching games list"
    console.error("API Error in GET /api/games:", e)
    return NextResponse.json({ message: `Failed to fetch games list: ${errorMessage}` }, { status: 500 })
  }
}

// Ensure this route is not cached aggressively if real-time updates are desired,
// or implement polling/SWR on the client. For now, default caching behavior applies.
export const dynamic = "force-dynamic" // Opt out of caching for this dynamic route
