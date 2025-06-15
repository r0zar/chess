import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { kv } from "@/lib/kv" // Changed import
import type { GameData } from "@/lib/chess-data.types"
import { type NextRequest, NextResponse } from "next/server"
import { mapIdentityToColor } from "@/lib/chess-logic/mappers"

export async function GET(request: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params

  try {
    let gameData = await kv.hgetall(`game:${gameId}`) as GameData | null

    if (!gameData || Object.keys(gameData).length === 0) {
      // hgetall returns null or empty object if not found
      console.warn(`Game state for ${gameId}: Not found in Vercel KV or empty object returned.`)
      // Check if it's truly null (key doesn't exist) vs empty object (key exists but no fields)
      const keyExists = await kv.exists(`game:${gameId}`)
      if (!keyExists) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 })
      }
      // If key exists but gameData is empty, it might be an issue or an uninitialized game
      // For now, treat as not found if critical fields like currentFen are missing.
      if (!gameData || !gameData.currentFen) {
        return NextResponse.json({ message: "Game data incomplete or not found." }, { status: 404 })
      }
    }

    // Defensive: gameData is not null here
    if (gameData && gameData.status === "pending") {
      console.log(`Game ${gameId} is pending, attempting to set to ongoing.`)
      const updatedAt = Date.now()
      const updatedFields: Partial<GameData> = { status: "ongoing", updatedAt }
      await kv.hset(`game:${gameId}`, updatedFields) // Use kv.hset
      await kv.zadd("games_by_update_time", { score: updatedAt, member: gameId }) // Use kv.zadd

      // Ensure id is always a string
      gameData = { ...gameData, ...updatedFields, id: gameData.id ?? gameId } as GameData
      console.log(`Game ${gameId} successfully updated to ongoing.`)
    }

    if (!gameData || !gameData.currentFen) {
      console.error(`Game ${gameId} has an invalid FEN:`, gameData ? gameData.currentFen : null)
      return NextResponse.json({ message: "Game data is corrupted (invalid FEN)." }, { status: 500 })
    }

    const game = new ChessJsAdapter(gameData.currentFen)

    return NextResponse.json({
      fen: gameData.currentFen,
      playerColor: game.getTurn(),
      gameStatus: gameData.status,
      winner: mapIdentityToColor(gameData.winner), // Apply mapping here
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown server error"
    console.error(`Server error fetching game state for ${gameId} (Vercel KV): ${errorMessage}`, err)
    return NextResponse.json({ message: `Internal server error: ${errorMessage}` }, { status: 500 })
  }
}
