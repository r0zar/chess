import { ChessJsAdapter } from "@/lib/chess-logic/game"
import type {
  PieceSymbol as ChessPieceSymbol,
  Square,
  PlayerColor as ChessJsPlayerColor,
} from "@/lib/chess-logic/types"
import { kv } from "@/lib/kv"
import type { GameData, MoveData, GameStatus } from "@/lib/chess-data.types"
import { type NextRequest, NextResponse } from "next/server"
import { cleanKVData, mapColorToIdentity, pieceSymbolToIdentity } from "@/lib/chess-logic/mappers"
import { getOrCreateSessionId } from "@/lib/session"
import { UnifiedConnectionManager } from "@/lib/unified-connection-manager"

export async function POST(request: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params
  const userId = await getOrCreateSessionId() // This is the persistent User ID

  let moveInput: { from: Square; to: Square; promotion?: ChessPieceSymbol }
  try {
    moveInput = await request.json()
  } catch (e) {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 })
  }

  const { from, to, promotion } = moveInput
  if (!from || !to) {
    return NextResponse.json({ success: false, message: "Missing 'from' or 'to' square." }, { status: 400 })
  }

  try {
    const gameRecord = await kv.hgetall(`game:${gameId}`) as GameData | null
    if (!gameRecord || !gameRecord.currentFen) {
      return NextResponse.json({ success: false, message: "Game not found or data incomplete." }, { status: 404 })
    }

    const game = new ChessJsAdapter(gameRecord.currentFen)
    const currentTurnColor = game.getTurn()

    // Authorize move based on the persistent user ID
    const expectedUserId = currentTurnColor === "w" ? gameRecord.playerWhiteId : gameRecord.playerBlackId

    if (!expectedUserId || expectedUserId !== userId) {
      return NextResponse.json(
        { success: false, message: "Not your turn or you are not a player in this game." },
        { status: 403 },
      )
    }

    const nonActiveStatuses: GameStatus[] = [
      "checkmate_white_wins",
      "checkmate_black_wins",
      "stalemate",
      "draw_repetition",
      "draw_50_moves",
      "draw_insufficient_material",
      "aborted",
      "resigned_black",
      "resigned_white",
    ]
    if (nonActiveStatuses.includes(gameRecord.status)) {
      return NextResponse.json(
        { success: false, message: `Game is not active (status: ${gameRecord.status}).` },
        { status: 400 },
      )
    }

    const fenBeforeMove = gameRecord.currentFen
    const moveResult = game.makeMove({ from, to, promotion })

    if (!moveResult) {
      return NextResponse.json({ success: false, message: "Invalid move according to game rules." }, { status: 400 })
    }

    const fenAfterMove = game.getFen()
    const newStatusFromEngine = game.getStatus()
    const gameWinnerFromEngine = game.getWinner()

    let newGameStatus: GameStatus = "ongoing"
    if (gameRecord.status === "pending" && gameRecord.playerWhiteId && gameRecord.playerBlackId) {
      newGameStatus = "ongoing"
    }

    if (newStatusFromEngine === "checkmate") {
      newGameStatus = gameWinnerFromEngine === "w" ? "checkmate_white_wins" : "checkmate_black_wins"
    } else if (newStatusFromEngine === "stalemate") {
      newGameStatus = "stalemate"
    } else if (newStatusFromEngine.startsWith("draw_")) {
      newGameStatus = newStatusFromEngine as GameStatus
    }

    const now = Date.now()
    const updatedGameFields: Partial<GameData> = {
      currentFen: fenAfterMove,
      status: newGameStatus,
      winner: mapColorToIdentity(gameWinnerFromEngine),
      updatedAt: now,
    }

    await kv.hset(`game:${gameId}`, cleanKVData(updatedGameFields))
    await kv.zadd("games_by_update_time", { score: now, member: gameId })

    const movesListKey = `moves:${gameId}`
    const currentMoveCount = await kv.llen(movesListKey)
    const moveNumber = currentMoveCount + 1

    const moveData: MoveData = {
      gameId,
      moveNumber,
      playerId: userId, // Capture the user's session ID with the move
      playerColor: mapColorToIdentity(moveResult.color as ChessJsPlayerColor)!,
      piece: pieceSymbolToIdentity(moveResult.piece)!,
      fromSquare: moveResult.from,
      toSquare: moveResult.to,
      promotion: pieceSymbolToIdentity(moveResult.promotion),
      isCapture: moveResult.flags.includes("c"),
      capturedPiece: pieceSymbolToIdentity(moveResult.captured), // Store captured piece type
      moveFlags: moveResult.flags, // Store original chess.js flags
      isCheck: game.isCheck(), // isCheck() after the move
      isCheckmate: newGameStatus.includes("checkmate"),
      isStalemate: newGameStatus === "stalemate",
      san: moveResult.san,
      fenBeforeMove,
      fenAfterMove,
      timestamp: now,
    }

    // Log the moveData object before stringifying for diagnostics
    console.log(`[Move Route Game: ${gameId}] Preparing to save moveData:`, JSON.stringify(moveData, null, 2))

    let moveDataString: string
    try {
      moveDataString = JSON.stringify(moveData)
      // Check if stringification itself produced a problematic string (highly unlikely for JSON.stringify but good for sanity)
      if (moveDataString === '"[object Object]"' || moveDataString === "[object Object]") {
        console.error(
          `[Move Route Game: ${gameId}] CRITICAL: JSON.stringify(moveData) resulted in problematic string: ${moveDataString}. Original moveData:`,
          moveData,
        )
        throw new Error("Failed to properly serialize move data due to [object Object] stringification.")
      }
    } catch (stringifyError) {
      console.error(
        `[Move Route Game: ${gameId}] Error stringifying moveData:`,
        stringifyError,
        "Original moveData:",
        moveData,
      )
      // Re-throw to be caught by the main catch block or handle specifically
      throw stringifyError
    }

    await kv.rpush(movesListKey, moveDataString)

    // *** UNIFIED EVENT BROADCASTING ***
    console.log(`[Move Route Game: ${gameId}] *** BROADCASTING MOVE VIA UNIFIED SYSTEM ***`)
    console.log(`[Move Route Game: ${gameId}] Player who made move: ${userId}`)

    // Broadcast move event to game subscribers (exclude the player who made the move)
    await UnifiedConnectionManager.broadcast({
      type: 'move',
      gameId,
      data: {
        move: moveResult,
        gameState: {
          fen: fenAfterMove,
          status: newGameStatus,
          winner: gameWinnerFromEngine,
          turn: game.getTurn()
        },
        playerId: userId
      }
    }, gameId, userId) // Target game, exclude moving player

    console.log(`[Move Route Game: ${gameId}] Move event broadcast completed`)

    // Broadcast move activity globally
    const playerAddress = currentTurnColor === "w" ? gameRecord.playerWhiteAddress : gameRecord.playerBlackAddress
    await UnifiedConnectionManager.broadcast({
      type: 'move_activity',
      data: {
        gameId,
        userId,
        userAddress: playerAddress || undefined,
        playerColor: currentTurnColor,
        move: moveResult.san,
        timestamp: new Date().toISOString()
      }
    }) // Global broadcast (no gameId filter)

    // Broadcast game end event if the game is over
    if (newGameStatus !== "ongoing" && newGameStatus !== "pending") {
      let endReason = "Game ended"
      if (newGameStatus.includes("checkmate")) {
        endReason = `Checkmate! ${gameWinnerFromEngine === "w" ? "White" : "Black"} wins`
      } else if (newGameStatus === "stalemate") {
        endReason = "Stalemate - Draw"
      } else if (newGameStatus.startsWith("draw_")) {
        endReason = "Draw"
      }

      // Broadcast to game subscribers
      await UnifiedConnectionManager.broadcast({
        type: 'game_ended',
        gameId,
        data: {
          winner: gameWinnerFromEngine,
          reason: endReason,
          status: newGameStatus
        }
      }, gameId) // Target game only

      // Broadcast globally
      await UnifiedConnectionManager.broadcast({
        type: 'game_activity',
        data: {
          gameId,
          action: 'ended',
          userId,
          userAddress: playerAddress || undefined,
          gameStatus: newGameStatus,
          winner: gameWinnerFromEngine,
          timestamp: new Date().toISOString()
        }
      }) // Global broadcast
    }

    return NextResponse.json({
      success: true,
      newFen: fenAfterMove,
      move: moveResult, // This is the chess.js move object, which is rich in detail
      gameStatus: newGameStatus,
      winner: gameWinnerFromEngine,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown server error"
    console.error(`Server error making move for game ${gameId}: ${errorMessage}`, err)
    return NextResponse.json({ success: false, message: `Internal server error: ${errorMessage}` }, { status: 500 })
  }
}
