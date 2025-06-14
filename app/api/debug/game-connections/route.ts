import { NextRequest, NextResponse } from "next/server"
import { UnifiedConnectionManager } from "@/lib/unified-connection-manager"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const gameId = searchParams.get('gameId')

    // Get detailed debug info from unified system
    const debugInfo = await UnifiedConnectionManager.getDebugInfo(gameId || undefined)

    console.log(`[Debug] Unified connection info${gameId ? ` for game ${gameId}` : ' (all connections)'}:`, debugInfo)

    return NextResponse.json(debugInfo)
} 