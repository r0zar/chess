import { notFound } from "next/navigation"
import GameBoardClient from "./game-board-client"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { mapIdentityToColor } from "@/lib/chess-logic/mappers"
import type { PlayerColor } from "@/lib/chess-logic/types"

async function getPublicInitialGameState(gameId: string): Promise<{
  fen: string
  gameStatus: GameData["status"]
  winner?: PlayerColor
  playerWhiteId?: string | null
  playerBlackId?: string | null
  playerWhiteAddress?: string | null
  playerBlackAddress?: string | null
} | null> {
  try {
    const gameData = await kv.hgetall<GameData>(`game:${gameId}`)

    if (!gameData || Object.keys(gameData).length === 0 || !gameData.currentFen) {
      return null
    }

    return {
      fen: gameData.currentFen,
      gameStatus: gameData.status,
      winner: mapIdentityToColor(gameData.winner),
      playerWhiteId: gameData.playerWhiteId,
      playerBlackId: gameData.playerBlackId,
      playerWhiteAddress: gameData.playerWhiteAddress,
      playerBlackAddress: gameData.playerBlackAddress,
    }
  } catch (error) {
    console.error(`[Server Page] Error fetching public initial game state for ${gameId}:`, error)
    return null
  }
}

interface GamePageParams {
  params: {
    gameId: string
  }
}

export default async function GamePage({ params }: GamePageParams) {
  const { gameId } = params
  const publicInitialGameState = await getPublicInitialGameState(gameId)

  if (!publicInitialGameState) {
    notFound()
  }

  return <GameBoardClient gameId={gameId} publicInitialGameState={publicInitialGameState} />
}
