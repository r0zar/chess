import GameBoardClient from "@/components/game/game-board-client"

interface GamePageParams {
  params: {
    gameId: string
  }
}

export default async function GamePage({ params }: GamePageParams) {
  const { gameId } = await params

  return <GameBoardClient gameId={gameId} />
}
