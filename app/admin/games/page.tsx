import type React from "react"
import { kv } from "@/lib/kv"
import type { GameData } from "@/lib/chess-data.types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import RelativeTimeDisplay from "@/components/relative-time-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

async function getGames(page = 1, limit = 10): Promise<{ games: GameData[]; totalCount: number }> {
  const offset = (page - 1) * limit
  try {
    // Fetch game IDs and total count from the sorted set
    const gameIds = await kv.zrange<string[]>("games_by_update_time", offset, offset + limit - 1, { rev: true })
    const totalCount = await kv.zcard("games_by_update_time")

    if (!gameIds || gameIds.length === 0) {
      return { games: [], totalCount: 0 }
    }

    // Fetch full game data for each ID
    const multi = kv.multi()
    gameIds.forEach((id) => {
      if (typeof id === "string") {
        multi.hgetall(`game:${id}`)
      }
    })
    const results = (await multi.exec()) as (GameData | null)[]
    const games = results.filter((game) => game !== null && Object.keys(game).length > 0 && game.id) as GameData[]

    return { games, totalCount }
  } catch (error) {
    console.error("Error fetching games from KV for admin:", error)
    return { games: [], totalCount: 0 }
  }
}

export default async function AdminGamesPage({ searchParams }: { searchParams?: { page?: string } }) {
  const currentPage = Number(searchParams?.page) || 1
  const { games, totalCount } = await getGames(currentPage)
  const totalPages = Math.ceil(totalCount / 10)

  const getStatusBadgeVariant = (status: string | null) => {
    if (!status) return "secondary"
    if (status.includes("wins")) return "default"
    if (status === "ongoing" || status === "pending") return "outline"
    if (status.includes("draw") || status === "stalemate") return "secondary"
    return "destructive"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-crimson">Games Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Games</CardTitle>
          <CardDescription>
            Showing {games.length} of {totalCount} games.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>White Player</TableHead>
                <TableHead>Black Player</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.map((game) => (
                <TableRow key={game.id}>
                  <TableCell className="font-medium truncate max-w-[100px] hover:max-w-none">
                    <Link href={`/admin/games/${game.id}`} className="hover:underline">
                      {game.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(game.status)}>{game.status || "N/A"}</Badge>
                  </TableCell>
                  <TableCell>{game.winner || "N/A"}</TableCell>
                  <TableCell className="truncate max-w-[100px]">{game.playerWhiteAddress || "N/A"}</TableCell>
                  <TableCell className="truncate max-w-[100px]">{game.playerBlackAddress || "N/A"}</TableCell>
                  <TableCell>
                    <RelativeTimeDisplay dateString={game.updatedAt} />
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/games/${game.id}`}>
                        <Eye className="mr-2 h-4 w-4" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" disabled={currentPage <= 1}>
              <Link href={`/admin/games?page=${currentPage - 1}`}>Previous</Link>
            </Button>
            <Button asChild variant="outline" disabled={currentPage >= totalPages}>
              <Link href={`/admin/games?page=${currentPage + 1}`}>Next</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}


