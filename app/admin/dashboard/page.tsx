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

async function getExpRewardsLog(limit = 20) {
  const raw = await kv.lrange<string>("exp_rewards_log", -limit, -1)
  return raw
    .map((entry) => {
      try {
        return JSON.parse(entry)
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .reverse() // Most recent first
}

export default async function AdminDashboardPage() {
  const { activeGames, totalGames, registeredUsers, avgMoves } = await getDashboardStats()
  const expRewards = await getExpRewardsLog(20)

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-8">
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
            <CardTitle className="text-sm font-medium text-slate-200">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{registeredUsers}</div>
            <p className="text-xs text-slate-400">Unique session UUIDs (since tracking)</p>
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

      {/* EXP Rewards Log */}
      <div className="mt-8">
        <Card className="bg-slate-800/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-200">Recent EXP Rewards Issued</CardTitle>
            <CardDescription className="text-slate-400">Last 20 EXP rewards sent to wallets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-200">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">Wallet</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                    <th className="px-2 py-1 text-left">Reason</th>
                    <th className="px-2 py-1 text-left">TXID</th>
                  </tr>
                </thead>
                <tbody>
                  {expRewards.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-4">No EXP rewards issued yet.</td>
                    </tr>
                  )}
                  {expRewards.map((r, i) => (
                    <tr key={i} className="border-b border-slate-700 hover:bg-slate-700/20">
                      <td className="px-2 py-1 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="px-2 py-1 font-mono">{r.stxAddress.slice(0, 6)}...{r.stxAddress.slice(-4)}</td>
                      <td className="px-2 py-1 text-right">{r.amount}</td>
                      <td className="px-2 py-1 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                      <td className="px-2 py-1">
                        <a
                          href={`https://explorer.hiro.co/txid/${r.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 underline"
                        >
                          {r.txid?.slice(0, 8)}...{r.txid?.slice(-4)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
