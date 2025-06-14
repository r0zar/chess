import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { kv } from "@/lib/kv"
import { Activity, Users, Gamepad2, BarChart3 } from "lucide-react"
import SimpleConnectionsDashboard from "@/components/admin/simple-connections"

async function getDashboardStats() {
  // Fetch all stats in parallel for efficiency
  const [totalGames, rawTotalUsers, allGameIds] = await Promise.all([
    kv.zcard("games_by_update_time"),
    kv.get<number>("user_count"), // Get the raw value first
    kv.zrange<string[]>("games_by_update_time", 0, -1),
  ])

  const totalUsers = rawTotalUsers || 0 // Default to 0 if null
  console.log(`[Admin Dashboard] Fetched user_count from KV: ${rawTotalUsers}, using: ${totalUsers}`)

  let ongoingGamesCount = 0
  let totalMoves = 0

  // NOTE: The following operations scan through all games and moves.
  // This can be slow and expensive on large datasets. For a production app,
  // consider maintaining dedicated counters or sets in KV for these metrics
  // (e.g., incrementing an 'ongoing_games' counter when a game status changes).
  if (allGameIds.length > 0) {
    const multi = kv.multi()
    allGameIds.forEach((id) => {
      multi.hget(`game:${id}`, "status")
      multi.llen(`moves:${id}`)
    })
    const results = (await multi.exec()) as (string | number)[]

    for (let i = 0; i < results.length; i += 2) {
      const status = results[i] as string
      const movesCount = results[i + 1] as number
      if (status === "ongoing") {
        ongoingGamesCount++
      }
      totalMoves += movesCount
    }
  }

  const avgMoves = totalGames > 0 ? Math.round(totalMoves / totalGames) : 0

  return {
    activeGames: ongoingGamesCount,
    totalGames: totalGames || 0,
    registeredUsers: totalUsers, // Already defaulted
    avgMoves,
  }
}

export default async function AdminDashboardPage() {
  const { activeGames, totalGames, registeredUsers, avgMoves } = await getDashboardStats()

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/70 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-200">Data Source Notice</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300">
            This dashboard is now populated with <span className="text-sky-400 font-semibold">live data</span> from the
            Vercel KV database. Some metrics like 'Active Games' and 'Avg. Moves' require scanning all game records,
            which may be slow on a large scale. The 'Total Users' count reflects users created since this tracking was
            implemented.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Active Games</CardTitle>
            <Gamepad2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{activeGames}</div>
            <p className="text-xs text-slate-400">Games with status 'ongoing'</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Games</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{totalGames}</div>
            <p className="text-xs text-slate-400">Completed or ongoing</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Users</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{registeredUsers}</div>
            <p className="text-xs text-slate-400">Unique sessions created (since tracking)</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Avg. Moves/Game</CardTitle>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{avgMoves}</div>
            <p className="text-xs text-slate-400">Average across all games</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-200">Recent Game Activity</CardTitle>
            <CardDescription className="text-slate-400">A list of recently updated games can be found on the 'Games' page.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">Live game list is available in the side navigation.</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-200">System Health</CardTitle>
            <CardDescription className="text-slate-400">Overview of system status.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-green-400 font-semibold">All systems operational.</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Connection Debug Panel */}
      <div className="mt-8">
        <SimpleConnectionsDashboard />
      </div>
    </div>
  )
}
