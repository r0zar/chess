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

export default async function AdminGamesPage({ searchParams }: { searchParams?: Promise<{ page?: string }> }) {
  const resolvedSearchParams = await searchParams
  const currentPage = Number(resolvedSearchParams?.page) || 1
  const { games, totalCount } = await getGames(currentPage)
  const totalPages = Math.ceil(totalCount / 10)

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "outline" | "destructive" => {
    if (!status) return "secondary"
    if (status.includes("wins")) return "default"
    if (status === "ongoing") return "default" // Green for ongoing games
    if (status === "pending") return "outline" // Outlined for pending
    if (status.includes("draw") || status === "stalemate") return "secondary"
    return "destructive"
  }

  return (
    <div className="space-y-6 mx-auto py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-crimson text-slate-100">Games Management</h1>
      </div>

      <Card className="bg-slate-800/70 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-200">All Games</CardTitle>
          <CardDescription className="text-slate-400">
            Showing {games.length} of {totalCount} games.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800/50">
                  <TableHead className="text-slate-300 min-w-[120px]">Game ID</TableHead>
                  <TableHead className="text-slate-300 min-w-[90px]">Status</TableHead>
                  <TableHead className="text-slate-300 min-w-[80px]">Winner</TableHead>
                  <TableHead className="text-slate-300 min-w-[180px]">White Player</TableHead>
                  <TableHead className="text-slate-300 min-w-[180px]">Black Player</TableHead>
                  <TableHead className="text-slate-300 min-w-[120px]">Last Updated</TableHead>
                  <TableHead className="text-slate-300 min-w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                      No games found.
                    </TableCell>
                  </TableRow>
                ) : (
                  games.map((game) => {
                    const whiteId = game.playerWhiteId;
                    const blackId = game.playerBlackId;
                    return (
                      <TableRow key={game.id} className="border-slate-700 hover:bg-slate-800/30">
                        <TableCell className="font-medium text-slate-200" title={game.id}>
                          <Link href={`/play/${game.id}`} className="hover:underline text-sky-400 hover:text-sky-300">
                            <span className="block md:hidden lowercase">{game.id.length > 10 ? `${game.id.slice(0, 6)}...${game.id.slice(-4)}` : game.id}</span>
                            <span className="hidden md:block lowercase">{game.id}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(game.status)}>{game.status || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">{game.winner || "N/A"}</TableCell>
                        <TableCell className="text-slate-300">
                          {whiteId ? (
                            <Badge variant="secondary" title={whiteId} className="lowercase">
                              <span className="block md:hidden lowercase">{whiteId.length > 10 ? `${whiteId.slice(0, 6)}...${whiteId.slice(-4)}` : whiteId}</span>
                              <span className="hidden md:block lowercase">{whiteId}</span>
                            </Badge>
                          ) : "N/A"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {blackId ? (
                            <Badge variant="secondary" title={blackId} className="lowercase">
                              <span className="block md:hidden lowercase">{blackId.length > 10 ? `${blackId.slice(0, 6)}...${blackId.slice(-4)}` : blackId}</span>
                              <span className="hidden md:block lowercase">{blackId}</span>
                            </Badge>
                          ) : "N/A"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          <RelativeTimeDisplay dateString={game.updatedAt} />
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="outline" size="sm" className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                            <Link href={`/play/${game.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center border-t border-slate-700">
          <p className="text-sm text-slate-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" disabled={currentPage <= 1} className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed">
              <Link href={`/admin/games?page=${currentPage - 1}`}>Previous</Link>
            </Button>
            <Button asChild variant="outline" disabled={currentPage >= totalPages} className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed">
              <Link href={`/admin/games?page=${currentPage + 1}`}>Next</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}