import { kv } from "@/lib/kv"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

async function getExpRewardsLog(limit = 100) {
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

export default async function AdminRewardsPage() {
    const expRewards = await getExpRewardsLog(100)
    return (
        <div className="max-w-6xl mx-auto py-8">
            <Card className="bg-slate-800/70 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-slate-200">EXP Rewards Log</CardTitle>
                    <CardDescription className="text-slate-400">Last 100 EXP rewards sent to wallets.</CardDescription>
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
                                                href={`https://explorer.stacks.co/txid/${r.txid}`}
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
    )
} 