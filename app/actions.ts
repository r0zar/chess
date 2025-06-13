"use server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { v4 as uuidv4 } from "uuid"
import { cleanKVData } from "@/lib/chess-logic/mappers"

const INITIAL_FEN = new ChessJsAdapter().getFen()

export async function createAndNavigateToGame() {
  const gameId = uuidv4()
  const now = Date.now()

  const newGameData: GameData = {
    id: gameId,
    createdAt: now,
    updatedAt: now,
    currentFen: INITIAL_FEN,
    initialFen: INITIAL_FEN,
    status: "pending",
    playerWhiteId: null, // Will be removed by cleanKVData if null
    playerBlackId: null, // Will be removed by cleanKVData if null
    winner: null, // Will be removed by cleanKVData if null
  }

  try {
    const cleanedGameData = cleanKVData(newGameData)

    // Perform KV operations
    await kv.hset(`game:${gameId}`, cleanedGameData)
    await kv.zadd("games_by_update_time", { score: now, member: gameId })
  } catch (kvError) {
    // This catch block is specifically for errors during KV operations
    console.error("Vercel KV Action: Error during KV operations in createAndNavigateToGame:", kvError)
    // Provide a more specific error message if possible, or re-throw a custom one
    throw new Error("Failed to save game data. Please try again.")
  }

  // If KV operations were successful, proceed with revalidation and redirect.
  // These are outside the primary try...catch for KV errors to let NEXT_REDIRECT propagate.
  try {
    revalidatePath("/")
  } catch (revalidateError) {
    // Log revalidation errors but don't necessarily stop the redirect,
    // as the game was successfully created. The lobby might just be stale for a bit.
    console.warn("Vercel KV Action: Error during revalidatePath in createAndNavigateToGame:", revalidateError)
  }

  // redirect() will throw NEXT_REDIRECT, which is handled by Next.js
  // and should not be caught by a general try...catch.
  redirect(`/play/${gameId}`)
}
