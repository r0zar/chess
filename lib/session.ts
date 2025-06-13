import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"
import type { NextRequest, NextResponse } from "next/server"

const SESSION_COOKIE_NAME = "player-session-id"

/**
 * Gets the session ID from cookies. If not present, creates a new one and sets the cookie.
 * This function is for use in API Routes and Server Components where `next/headers` is available.
 * @returns The session ID string.
 */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionId) {
    sessionId = uuidv4()
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }
  return sessionId
}

/**
 * Gets the session ID from a NextRequest object (used in Middleware or API Routes).
 * This is an alternative for contexts where the async `cookies()` from `next/headers` is not ideal.
 * @param request - The NextRequest object.
 * @returns The session ID string, or null if not found.
 */
export function getSessionIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null
}

/**
 * Sets the session ID cookie on a NextResponse object.
 * @param response - The NextResponse object.
 * @param sessionId - The session ID to set.
 */
export function setSessionIdOnResponse(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}
