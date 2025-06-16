"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export default function SimpleConnectionsDashboard() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    if (loading) return <div className="text-slate-300">Loading...</div>
    if (!data) return <div className="text-slate-300">No data</div>

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-100">Connection Debug</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-slate-800/70 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-200">Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">{data.summary?.totalConnections || 0}</div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/70 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-200">Direct</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">{data.direct?.count || 0}</div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/70 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-200">KV</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">{data.kv?.count || 0}</div>
                        <div className="text-xs mt-1">
                            {data.kv?.available ? (
                                <span className="text-green-400">✓ Available</span>
                            ) : (
                                <span className="text-red-400">✗ Unavailable</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-800/70 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-sm text-slate-200">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">{data.pending?.count || 0}</div>
                    </CardContent>
                </Card>
            </div>

            {/* KV Status Alert */}
            {data.kv && !data.kv.available && (
                <Card className="bg-red-900/20 border-red-700">
                    <CardHeader>
                        <CardTitle className="text-sm text-red-400">⚠️ KV Database Unavailable</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-red-300">
                            Vercel KV is not available: {data.kv.error || 'Unknown error'}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                            This is normal in local development. Challenge notifications will not work until KV is configured.
                        </p>
                    </CardContent>
                </Card>
            )}

            <Card className="bg-slate-800/70 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-slate-200">Raw Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-slate-900/80 text-slate-300 p-4 rounded overflow-auto max-h-96 border border-slate-600">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    )
} 