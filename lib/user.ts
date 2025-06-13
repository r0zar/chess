import { kv } from "@/lib/kv"
import type { UserData } from "./chess-data.types"
import { cleanKVData } from "./chess-logic/mappers"

/**
 * Retrieves a user by their ID (session ID).
 * @param userId - The unique ID of the user.
 * @returns The UserData object or null if not found.
 */
export async function getUserById(userId: string): Promise<UserData | null> {
  return kv.hgetall<UserData>(`user:${userId}`)
}

/**
 * Retrieves or creates a user based on their session ID.
 * If an STX address is provided, it will be associated with the user.
 * @param sessionId - The session ID from the user's cookie.
 * @param stxAddress - An optional STX address to associate.
 * @returns The existing or newly created UserData object.
 */
export async function getOrCreateUser(sessionId: string, stxAddress?: string | null): Promise<UserData> {
  let user = await getUserById(sessionId)
  const now = Date.now()
  let needsUpdate = false

  if (!user) {
    // User does not exist, create a new one.
    user = {
      id: sessionId,
      stxAddress: stxAddress || null,
      createdAt: now,
      lastSeenAt: now,
    }
    needsUpdate = true
    // Atomically increment the total user count when a new user is created.
    const newCount = await kv.incr("user_count")
    console.log(`[lib/user.ts] New user created (ID: ${sessionId}). Incremented user_count. New total: ${newCount}`)
  } else {
    // User exists, update last seen time and check for STX address update.
    user.lastSeenAt = now
    needsUpdate = true // Always update lastSeenAt

    if (stxAddress && user.stxAddress !== stxAddress) {
      user.stxAddress = stxAddress
    }
  }

  if (needsUpdate) {
    await kv.hset(`user:${sessionId}`, cleanKVData(user))
    // Optional: Create a reverse lookup for STX address to user ID
    if (stxAddress) {
      await kv.set(`stx_to_user_id:${stxAddress}`, sessionId)
    }
  }

  return user
}
