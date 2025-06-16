import { listAllSessions, aggregateSessionsByWallet } from '@/lib/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export default async function AdminSessionsPage() {
    const sessions = await listAllSessions()
    const walletGroups = await aggregateSessionsByWallet()

    return (
        <div className="space-y-8">
            <Card className="bg-slate-800/70 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-slate-200">Sessions & Wallets</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="sessions">
                        <TabsList>
                            <TabsTrigger value="sessions">Sessions</TabsTrigger>
                            <TabsTrigger value="wallets">Group by Wallet</TabsTrigger>
                        </TabsList>
                        <TabsContent value="sessions">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-slate-200">
                                    <thead>
                                        <tr>
                                            <th className="px-2 py-1 text-left">Session UUID</th>
                                            <th className="px-2 py-1 text-left">Created</th>
                                            <th className="px-2 py-1 text-left">Last Seen</th>
                                            <th className="px-2 py-1 text-left">Wallet</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((s) => (
                                            <tr key={`session-${s.id}`} className="border-b border-slate-700">
                                                <td className="px-2 py-1 font-mono">{typeof s.id === 'string' || typeof s.id === 'number' ? s.id : JSON.stringify(s.id)}</td>
                                                <td className="px-2 py-1">{typeof s.createdAt === 'number' ? new Date(s.createdAt).toLocaleString() : ''}</td>
                                                <td className="px-2 py-1">{typeof s.lastSeenAt === 'number' ? new Date(s.lastSeenAt).toLocaleString() : ''}</td>
                                                <td className="px-2 py-1">
                                                    {s.stxAddress ? (
                                                        <Badge variant="default">{s.stxAddress}</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">No Wallet</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>
                        <TabsContent value="wallets">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-slate-200">
                                    <thead>
                                        <tr>
                                            <th className="px-2 py-1 text-left">Wallet</th>
                                            <th className="px-2 py-1 text-left"># Sessions</th>
                                            <th className="px-2 py-1 text-left">Session UUIDs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(walletGroups).map(([wallet, users]) => (
                                            <tr key={`wallet-${wallet}`} className="border-b border-slate-700">
                                                <td className="px-2 py-1">
                                                    {wallet === 'No Wallet' ? (
                                                        <Badge variant="secondary">No Wallet</Badge>
                                                    ) : (
                                                        <Badge variant="default">{wallet}</Badge>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1">{users.length}</td>
                                                <td className="px-2 py-1 font-mono">
                                                    {users.map((u) => typeof u.id === 'string' || typeof u.id === 'number' ? u.id : JSON.stringify(u.id)).join(', ')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
} 