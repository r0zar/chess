"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { v4 as uuidv4 } from "uuid"
import { cleanKVData } from "@/lib/chess-logic/mappers"
import { getOrCreateUser } from '@/lib/user'
import { getPartyKitHost } from '@/lib/config'

const INITIAL_FEN = new ChessJsAdapter().getFen()

// Add PartyKit global event broadcast helper
async function broadcastGlobalEvent(event: any) {
  try {
    const partyKitHost = getPartyKitHost()
    const protocol = partyKitHost.startsWith('localhost') ? 'http' : 'https'
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
    const cleanedGameData = cleanKVData(newGameData as any)

    // Perform KV operations
    await kv.hset(`game:${gameId}`, cleanedGameData)
    await kv.zadd("games_by_update_time", { score: now, member: gameId })
  } catch (kvError) {
    // This catch block is specifically for errors during KV operations
    console.error("Vercel KV Action: Error during KV operations in createAndNavigateToGame:", kvError)
    // Provide a more specific error message if possible, or re-throw a custom one
    throw new Error("Failed to save game data. Please try again.")
  }

  // *** BROADCAST GLOBAL EVENT: GAME CREATED ***
  await broadcastGlobalEvent({
    type: 'game_activity',
    data: {
      gameId,
      userId: null, // You can enhance this to include the creator's user/session ID if available
      action: 'created'
    }
  })

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

export async function associateWalletWithUser(userUuid: string, stxAddress: string) {
  if (!userUuid || !stxAddress) throw new Error('Missing userUuid or stxAddress')
  const user = await getOrCreateUser(userUuid, stxAddress)
  return user
}
