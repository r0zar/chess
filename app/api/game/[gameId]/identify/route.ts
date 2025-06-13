import { kv } from "@/lib/kv"
import type { GameData, PlayerColorIdentity, MoveData, PieceTypeIdentity } from "@/lib/chess-data.types"
import type { Move, Square, PieceSymbol, PlayerColor } from "@/lib/chess-logic/types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { type NextRequest, NextResponse } from "next/server"
import { cleanKVData, mapIdentityToColor, identityToPieceSymbol } from "@/lib/chess-logic/mappers"
import { getOrCreateSessionId } from "@/lib/session"
import { getOrCreateUser } from "@/lib/user"
import { GameEventBroadcaster } from "@/lib/game-events"

export async function POST(request: NextRequest, { params }: { params: { gameId: string } }) {
  const { gameId } = params
  console.log(`[Identify Route Game: ${gameId}] Received request.`)
  const sessionId = getOrCreateSessionId()

  let payload: { stxAddress?: string } = {}
  try {
    const text = await request.text()
    if (text) payload = JSON.parse(text)
  } catch (e) {
    // Ignore parsing errors for payload, default to empty object
  }
  const { stxAddress } = payload

  const user = await getOrCreateUser(sessionId, stxAddress)
  const userId = user.id
  console.log(`[Identify Route Game: ${gameId}] Identified User ID: ${userId}, STX Address: ${user.stxAddress}`)
  const userStxAddress = user.stxAddress

  try {
    const gameData = await kv.hgetall(`game:${gameId}`) as GameData | null
    if (!gameData || !gameData.currentFen) {
      console.error(`[Identify Route Game: ${gameId}] Game not found or FEN missing.`)
      return NextResponse.json({ message: "Game not found or data incomplete." }, { status: 404 })
    }
    console.log(`[Identify Route Game: ${gameId}] Found game data. Status: ${gameData.status}`)

    let clientPlayerColorIdentity: PlayerColorIdentity | null = null
    const updatePayload: Partial<GameData> = {}

    // 1. Determine player assignment and if an address update is needed
    if (gameData.playerWhiteId === userId) {
      clientPlayerColorIdentity = "white"
      if (gameData.playerWhiteAddress !== userStxAddress) {
        updatePayload.playerWhiteAddress = userStxAddress
      }
    } else if (gameData.playerBlackId === userId) {
      clientPlayerColorIdentity = "black"
      if (gameData.playerBlackAddress !== userStxAddress) {
        updatePayload.playerBlackAddress = userStxAddress
      }
    } else {
      // 2. Assign player to an open slot
      if (!gameData.playerWhiteId) {
        updatePayload.playerWhiteId = userId
        updatePayload.playerWhiteAddress = userStxAddress
        clientPlayerColorIdentity = "white"
        console.log(`[Identify Route Game: ${gameId}] Assigning new white player: ${userId}`)
      } else if (!gameData.playerBlackId) {
        updatePayload.playerBlackId = userId
        updatePayload.playerBlackAddress = userStxAddress
        clientPlayerColorIdentity = "black"
        console.log(`[Identify Route Game: ${gameId}] Assigning new black player: ${userId}`)
      }
    }

    // 3. Determine if game status needs to change from pending to ongoing
    const wasPending = gameData.status === "pending"
    const isNowFull =
      (gameData.playerWhiteId || updatePayload.playerWhiteId) && (gameData.playerBlackId || updatePayload.playerBlackId)
    if (wasPending && isNowFull) {
      updatePayload.status = "ongoing"
    }

    // 4. If any updates are identified, perform a single database transaction
    if (Object.keys(updatePayload).length > 0) {
      console.log(`[Identify Route Game: ${gameId}] Updating game data:`, updatePayload)
      updatePayload.updatedAt = Date.now()

      // Perform the database update
      await kv.hset(`game:${gameId}`, cleanKVData(updatePayload))
      await kv.zadd("games_by_update_time", { score: updatePayload.updatedAt, member: gameId })

      // IMPORTANT: Manually merge the updates into the local gameData object.
      // This ensures the rest of the function uses the absolute latest data without another DB read.
      Object.assign(gameData, updatePayload)

      // Broadcast player join events if a new player was assigned
      if (updatePayload.playerWhiteId && updatePayload.playerWhiteId === userId) {
        GameEventBroadcaster.broadcast(gameId, {
          type: 'player_joined',
          data: {
            playerColor: 'w',
            playerId: userId,
            playerAddress: userStxAddress || undefined
          }
        })
      } else if (updatePayload.playerBlackId && updatePayload.playerBlackId === userId) {
        GameEventBroadcaster.broadcast(gameId, {
          type: 'player_joined',
          data: {
            playerColor: 'b',
            playerId: userId,
            playerAddress: userStxAddress || undefined
          }
        })
      }
    }

    const gameLogic = new ChessJsAdapter(gameData.currentFen)
    const movesListKey = `moves:${gameId}`
    // kv.lrange might return strings or already parsed objects if they were valid JSON.
    const rawMovesData = await kv.lrange<string | MoveData>(movesListKey, 0, -1)

    console.log(
      `[Identify Route Game: ${gameId}] Fetched ${rawMovesData.length} raw move items from KV key '${movesListKey}'.`,
    )
    if (rawMovesData.length > 0) {
      console.log(
        `[Identify Route Game: ${gameId}] First raw move item type: ${typeof rawMovesData[0]}, item:`,
        rawMovesData[0],
      )
    }

    const clientMoveHistory: Move[] = rawMovesData
      .map((item, index) => {
        let dbMove: MoveData
        if (typeof item === "string") {
          try {
            dbMove = JSON.parse(item)
          } catch (parseError) {
            console.error(
              `[Identify Route Game: ${gameId}] Failed to parse move JSON string at index ${index}. Raw string: '${item}'`,
              parseError,
            )
            return null
          }
        } else if (typeof item === "object" && item !== null) {
          dbMove = item as MoveData // Assume it's already the correct MoveData structure
        } else {
          console.warn(`[Identify Route Game: ${gameId}] Move data at index ${index} is not a string or object:`, item)
          return null
        }

        if (
          !dbMove ||
          typeof dbMove.fromSquare !== "string" ||
          typeof dbMove.toSquare !== "string" ||
          typeof dbMove.playerColor !== "string" ||
          dbMove.playerColor.trim() === "" ||
          typeof dbMove.piece !== "string" ||
          dbMove.piece.trim() === ""
        ) {
          console.warn(
            `[Identify Route Game: ${gameId}] Parsed/obtained move data at index ${index} is incomplete or has invalid types:`,
            dbMove,
          )
          return null
        }

        let moveColor: PlayerColor | undefined = mapIdentityToColor(dbMove.playerColor as PlayerColorIdentity)
        if (!moveColor && (dbMove.playerColor.toLowerCase() === "w" || dbMove.playerColor.toLowerCase() === "b")) {
          moveColor = dbMove.playerColor.toLowerCase() as PlayerColor
        }

        let movePiece: PieceSymbol | undefined = identityToPieceSymbol(dbMove.piece as PieceTypeIdentity)
        if (!movePiece && dbMove.piece.length === 1) {
          const potentialPieceSymbol = dbMove.piece.toLowerCase() as PieceSymbol
          if (["p", "n", "b", "r", "q", "k"].includes(potentialPieceSymbol)) {
            movePiece = potentialPieceSymbol
          }
        }

        if (!moveColor || !movePiece) {
          console.warn(
            `[Identify Route Game: ${gameId}] Failed to determine color/piece for move at index ${index}:`,
            dbMove,
          )
          return null
        }

        // Use stored chess.js flags if available, otherwise fall back to basic SAN parsing for flags
        const flags =
          dbMove.moveFlags ||
          (() => {
            let f = ""
            if (dbMove.isCapture) f += "c" // Basic capture flag
            if (dbMove.promotion) f += "p" // Basic promotion flag
            if (dbMove.san) {
              if (dbMove.san.includes("x") && !f.includes("c")) f += "c"
              if (dbMove.san.includes("=") && !f.includes("p")) f += "p"
              if (dbMove.san === "O-O") return "k"
              if (dbMove.san === "O-O-O") return "q"
            }
            return f || "n" // Default to normal if no other flags apply
          })()

        return {
          from: dbMove.fromSquare as Square,
          to: dbMove.toSquare as Square,
          color: moveColor,
          piece: movePiece,
          promotion: dbMove.promotion ? identityToPieceSymbol(dbMove.promotion as PieceTypeIdentity) : undefined,
          captured: dbMove.capturedPiece ? identityToPieceSymbol(dbMove.capturedPiece) : undefined,
          san: dbMove.san || "N/A", // Ensure SAN is always a string
          flags: flags,
        }
      })
      .filter((move) => move !== null) as Move[]

    console.log(
      `[Identify Route Game: ${gameId}] Processed clientMoveHistory. Final length: ${clientMoveHistory.length}.`,
    )
    if (clientMoveHistory.length > 0) {
      console.log(`[Identify Route Game: ${gameId}] First processed move object:`, clientMoveHistory[0])
    }
    console.log(`[Identify Route Game: ${gameId}] Sending final JSON response.`)

    return NextResponse.json({
      gameId: gameData.id,
      fen: gameData.currentFen,
      clientPlayerColor: mapIdentityToColor(clientPlayerColorIdentity),
      assignedWhiteId: gameData.playerWhiteId,
      assignedBlackId: gameData.playerBlackId,
      assignedWhiteAddress: gameData.playerWhiteAddress,
      assignedBlackAddress: gameData.playerBlackAddress,
      currentTurn: gameLogic.getTurn(),
      gameStatus: gameData.status,
      winner: mapIdentityToColor(gameData.winner),
      moveHistory: clientMoveHistory,
    })
  } catch (error: unknown) {
    let errorMessage = "An unknown error occurred."
    let errorName = "UnknownError"

    if (error instanceof Error) {
      errorMessage = error.message || "Error object did not contain a message."
      errorName = error.name || "Error"
      console.error(
        `Error in identify route for game ${gameId} (Instance of Error):`,
        error.name,
        error.message,
        error.stack,
      )
    } else if (typeof error === "string") {
      errorMessage = error
      console.error(`Error in identify route for game ${gameId} (String Error):`, error)
    } else if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      errorMessage = error.message
      errorName = "name" in error && typeof error.name === "string" ? error.name : "ObjectError"
      console.error(`Error in identify route for game ${gameId} (Object with Message):`, error)
    } else {
      try {
        const errorString = JSON.stringify(error)
        errorMessage = errorString === "{}" ? "[object Object]" : errorString
      } catch (stringifyError) {
        errorMessage = "Failed to stringify error object."
      }
      console.error(`Error in identify route for game ${gameId} (Unserializable/Unknown Error):`, error)
    }

    if (errorMessage === "[object Object]") {
      errorMessage = "An unspecified object error occurred."
    }

    return NextResponse.json(
      {
        message: "Internal server error during player identification.",
        error: errorMessage,
        errorName: errorName,
      },
      { status: 500 },
    )
  }
}
