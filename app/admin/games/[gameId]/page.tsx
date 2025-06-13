import { kv } from "@/lib/kv"
import type { GameData, MoveData } from "@/lib/chess-data.types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import ChessBoard from "@/components/chess-board"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

async function getGameDetails(gameId: string): Promise<{ game: GameData; moves: MoveData[] } | null> {
  try {
    const gameData = await kv.hgetall(`game:${gameId}`) as any
    if (!gameData || Object.keys(gameData).length === 0) {
      return null
    }
    // Normalize to ensure all expected fields are present for the UI
    const normalizedGameData: GameData = {
      id: gameData.id,
      createdAt: gameData.createdAt,
      updatedAt: gameData.updatedAt,
      playerWhiteId: gameData.playerWhiteId || null,
      playerBlackId: gameData.playerBlackId || null,
      playerWhiteAddress: gameData.playerWhiteAddress || null,
      playerBlackAddress: gameData.playerBlackAddress || null,
      currentFen: gameData.currentFen,
      initialFen: gameData.initialFen,
      status: gameData.status,
      winner: gameData.winner || null,
    }

    const movesJson = await kv.lrange<string>(`moves:${gameId}`, 0, -1)
    const moves = movesJson.map((json) => JSON.parse(json) as MoveData)

    return { game: normalizedGameData, moves }
  } catch (error) {
    console.error(`Error fetching game details from KV for admin (game: ${gameId}):`, error)
    return null
  }
}

export default async function AdminGameDetailsPage({ params }: { params: { gameId: string } }) {
  const gameDetails = await getGameDetails(params.gameId)

  if (!gameDetails) {
    return <p>Game not found or error loading details.</p>
  }

  const { game, moves } = gameDetails
  const chess = new ChessJsAdapter(game.currentFen)

  const getStatusBadgeVariant = (status: string | null) => {
    if (!status) return "secondary"
    if (status.includes("wins")) return "default"
    if (status === "ongoing" || status === "pending") return "outline"
    if (status.includes("draw") || status === "stalemate") return "secondary"
    return "destructive"
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-crimson">
        Game Details: <span className="font-mono text-2xl">{game.id}</span>
      </h1>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="moves">Move History</TabsTrigger>
          <TabsTrigger value="board">Current Board</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Game Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <strong>Status:</strong> <Badge variant={getStatusBadgeVariant(game.status)}>{game.status}</Badge>
                </div>
                <div>
                  <strong>Winner:</strong> {game.winner || "N/A"}
                </div>
                <div>
                  <strong>White Player:</strong>{" "}
                  <span className="font-mono text-xs break-all">
                    {game.playerWhiteAddress || game.playerWhiteId || "N/A"}
                  </span>
                </div>
                <div>
                  <strong>Black Player:</strong>{" "}
                  <span className="font-mono text-xs break-all">
                    {game.playerBlackAddress || game.playerBlackId || "N/A"}
                  </span>
                </div>
                <div>
                  <strong>Created:</strong> {format(new Date(game.createdAt), "PPP p")}
                </div>
                <div>
                  <strong>Last Updated:</strong> {format(new Date(game.updatedAt), "PPP p")}
                </div>
                <div>
                  <strong>Total Moves:</strong> {moves.length}
                </div>
              </div>
              <div className="mt-4">
                <strong>Initial FEN:</strong>
                <p className="font-mono text-sm break-all">{game.initialFen}</p>
              </div>
              <div className="mt-2">
                <strong>Current FEN:</strong>
                <p className="font-mono text-sm break-all">{game.currentFen}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moves">
          <Card>
            <CardHeader>
              <CardTitle>Move History</CardTitle>
              <CardDescription>Total {moves.length} moves recorded.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Player ID</TableHead>
                    <TableHead>Piece</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>SAN</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moves.map((move) => (
                    <TableRow key={move.moveNumber}>
                      <TableCell>{move.moveNumber}</TableCell>
                      <TableCell>{move.playerColor}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[100px]" title={move.playerId}>
                        {move.playerId}
                      </TableCell>
                      <TableCell>{move.piece}</TableCell>
                      <TableCell>{move.fromSquare}</TableCell>
                      <TableCell>{move.toSquare}</TableCell>
                      <TableCell>{move.san || "N/A"}</TableCell>
                      <TableCell>
                        {move.isCapture && <Badge variant="outline">Capture</Badge>}
                        {move.isCheck && <Badge variant="destructive">Check</Badge>}
                        {move.isCheckmate && <Badge variant="default">Checkmate</Badge>}
                      </TableCell>
                      <TableCell>{format(new Date(move.timestamp), "p")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board">
          <Card>
            <CardHeader>
              <CardTitle>Current Board State</CardTitle>
              <CardDescription>Visual representation of the current FEN.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ChessBoard
                position={chess.getFen()}
                boardOrientation="white" // Admin view, so pick a perspective
                arePiecesDraggable={false} // No moves from admin view
                boardWidth={500}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
