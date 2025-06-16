import { kv } from "@/lib/kv"
import type { UserData } from "./chess-data.types"
import { cleanKVData } from "./chess-logic/mappers"

/**
 * Retrieves a user by their ID (UUID from client).
 * @param userId - The unique ID of the user (UUID from client).
 * @returns The UserData object or null if not found.
 */
export async function getUserById(userId: string): Promise<UserData | null> {
  return kv.hgetall(`user:${userId}`) as unknown as UserData | null
}

/**
 * Retrieves or creates a user based on their UUID.
 * If an STX address is provided, it will be associated with the user.
 * @param uuid - The UUID from the client (localStorage).
 * @param stxAddress - An optional STX address to associate.
 * @returns The existing or newly created UserData object.
 */
export async function getOrCreateUser(uuid: string, stxAddress?: string | null): Promise<UserData> {
  let user = await getUserById(uuid)
  const now = Date.now()
  let needsUpdate = false

  if (!user) {
    // User does not exist, create a new one.
    user = {
      id: uuid,
      stxAddress: stxAddress || null,
      createdAt: now,
      lastSeenAt: now,
    }
    needsUpdate = true
    // Atomically increment the total user count when a new user is created.
    const newCount = await kv.incr("user_count")
    console.log(`[lib/user.ts] New user created (ID: ${uuid}). Incremented user_count. New total: ${newCount}`)
  } else {
    // User exists, update last seen time and check for STX address update.
    user.lastSeenAt = now
    needsUpdate = true // Always update lastSeenAt

    if (stxAddress && user.stxAddress !== stxAddress) {
      user.stxAddress = stxAddress
    }
  }

  if (needsUpdate) {
    await kv.hset(`user:${uuid}`, cleanKVData(user) as unknown as Record<string, unknown>)
  }

  return user
}

/**
 * Lists all sessions (user UUIDs) and their UserData.
 */
export async function listAllSessions(): Promise<UserData[]> {
  // Use Redis-compatible keys command for all user keys
  const userKeys: string[] = await kv.keys('user:*');
  if (userKeys.length === 0) return [];
  const multi = kv.multi();
  userKeys.forEach((key: string) => multi.hgetall(key));
  const users = (await multi.exec()) as UserData[];
  return users.filter(Boolean);
}

/**
 * Aggregates sessions by wallet address.
 * Returns a map: { [wallet: string]: UserData[] }
 */
export async function aggregateSessionsByWallet(): Promise<Record<string, UserData[]>> {
  const all = await listAllSessions();
  const grouped: Record<string, UserData[]> = {};
  for (const user of all) {
    const wallet = user.stxAddress || 'No Wallet';
    if (!grouped[wallet]) grouped[wallet] = [];
    grouped[wallet].push(user);
  }
  return grouped;
}
