"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Wifi,
    WifiOff,
    Users,
    Server,
    Database,
    Clock,
    AlertTriangle,
    RefreshCw,
    Trash2,
    Activity,
    Eye
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ConnectionData {
    timestamp: string
    direct: {
        count: number
        connections: any[]
    }
    kv: {
        count: number
        connections: Array<{
            connectionId: string
            userId: string
            userAddress?: string
            connectedAt: string
            lastHeartbeat: string
            isExpired: boolean
        }>
    }
    pending: {
        count: number
        events: Array<{
            eventId: string
            type: string
            createdAt: string
            expiresAt: string
            isExpired: boolean
            isCorrupted: boolean
            data: any
        }>
    }
    stats: {
        totalConnections: number
        activePlayers: number
        totalSpectators: number
        connectedUsers: string[]
    }
    summary: {
        totalConnections: number
        directConnections: number
        kvConnections: number
        isServerless: boolean
        hasConnections: boolean
    }
}

export default function ConnectionsDashboard() {
    const [data, setData] = useState<ConnectionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const { toast } = useToast()

    const fetchData = async () => {
        try {
            setError(null)
            const response = await fetch('/api/admin/connections')
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            const connectionData = await response.json()
            setData(connectionData)
        } catch (err) {
            setError((err as Error).message)
            console.error('Failed to fetch connection data:', err)
        } finally {
            setLoading(false)
        }
    }

    const clearData = async () => {
        try {
            const response = await fetch('/api/admin/connections', { method: 'DELETE' })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            toast({
                title: "Data Cleared",
                description: "All connection data has been cleared successfully.",
            })
            await fetchData() // Refresh data
        } catch (err) {
            toast({
                title: "Error",
                description: `Failed to clear data: ${(err as Error).message}`,
                variant: "destructive"
            })
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        if (!autoRefresh) return

        const interval = setInterval(fetchData, 3000) // Refresh every 3 seconds
        return () => clearInterval(interval)
    }, [autoRefresh])

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        Loading connection data...
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    Failed to load connection data: {error}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        className="ml-2"
                    >
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        )
    }

    if (!data) return null

    return (
        <div className="space-y-6">
            {/* Header with controls */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Connection Status</h2>
                    <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(data.timestamp).toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        <Activity className="w-4 h-4 mr-1" />
                        {autoRefresh ? 'Auto' : 'Manual'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                    >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Refresh
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={clearData}
                    >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Clear Data
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.totalConnections}</div>
                        <Badge variant={data.summary.hasConnections ? "default" : "secondary"}>
                            {data.summary.hasConnections ? "Active" : "No Connections"}
                        </Badge>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Direct Connections</CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.direct.count}</div>
                        <p className="text-xs text-muted-foreground">In-memory connections</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">KV Connections</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.kv.count}</div>
                        <p className="text-xs text-muted-foreground">Persistent connections</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Pending Events</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.pending.count}</div>
                        <Badge variant={data.pending.events.some(e => e.isCorrupted) ? "destructive" : "secondary"}>
                            {data.pending.events.some(e => e.isCorrupted) ? "Corrupted" : "Clean"}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {/* Architecture Alert */}
            {data.summary.isServerless && (
                <Alert>
                    <Database className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Serverless Mode Detected:</strong> Direct connections are 0, using KV persistence.
                        This is normal in serverless environments where API routes run in separate instances.
                    </AlertDescription>
                </Alert>
            )}

            {/* Detailed Tabs */}
            <Tabs defaultValue="connections" className="w-full">
                <TabsList>
                    <TabsTrigger value="connections">Active Connections</TabsTrigger>
                    <TabsTrigger value="events">Pending Events</TabsTrigger>
                    <TabsTrigger value="stats">Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="connections">
                    <Card>
                        <CardHeader>
                            <CardTitle>KV Persistent Connections</CardTitle>
                            <CardDescription>
                                Connections stored in Vercel KV for serverless persistence
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data.kv.connections.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No active connections</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.kv.connections.map((conn) => (
                                        <div key={conn.connectionId} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${conn.isExpired ? 'bg-red-500' : 'bg-green-500'}`} />
                                                <div>
                                                    <div className="font-mono text-sm">{conn.connectionId.substring(0, 8)}...</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        User: {conn.userId.substring(0, 8)}...
                                                        {conn.userAddress && ` (${conn.userAddress.substring(0, 6)}...)`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>Connected: {new Date(conn.connectedAt).toLocaleTimeString()}</div>
                                                <div>Last seen: {new Date(conn.lastHeartbeat).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="events">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Events Queue</CardTitle>
                            <CardDescription>
                                Events waiting to be delivered to SSE connections
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data.pending.events.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No pending events</p>
                            ) : (
                                <div className="space-y-3">
                                    {data.pending.events.map((event) => (
                                        <div key={event.eventId} className="p-3 border rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={event.isCorrupted ? "destructive" : event.isExpired ? "secondary" : "default"}>
                                                        {event.type}
                                                    </Badge>
                                                    {event.isCorrupted && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                                    {event.isExpired && <Clock className="w-4 h-4 text-gray-500" />}
                                                </div>
                                                <div className="text-xs font-mono text-muted-foreground">
                                                    {event.eventId.substring(0, 8)}...
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                <div>Created: {new Date(event.createdAt).toLocaleString()}</div>
                                                <div>Expires: {new Date(event.expiresAt).toLocaleString()}</div>
                                                {event.data && !event.isCorrupted && (
                                                    <details className="mt-2">
                                                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Data</summary>
                                                        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                                                            {JSON.stringify(event.data, null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Connection Statistics</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between">
                                    <span>Total Connections:</span>
                                    <span className="font-mono">{data.stats.totalConnections}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Active Players:</span>
                                    <span className="font-mono">{data.stats.activePlayers}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Spectators:</span>
                                    <span className="font-mono">{data.stats.totalSpectators}</span>
                                </div>
                                <Separator />
                                <div>
                                    <div className="text-sm font-medium mb-2">Connected Users:</div>
                                    {data.stats.connectedUsers.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No users connected</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {data.stats.connectedUsers.map((userId) => (
                                                <div key={userId} className="text-xs font-mono bg-gray-50 p-1 rounded">
                                                    {userId.substring(0, 8)}...
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>System Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2">
                                    {data.summary.hasConnections ? (
                                        <Wifi className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <WifiOff className="w-4 h-4 text-red-500" />
                                    )}
                                    <span>
                                        {data.summary.hasConnections ? 'Connected' : 'No Connections'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-blue-500" />
                                    <span>
                                        {data.summary.isServerless ? 'Serverless Mode' : 'Direct Mode'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span>
                                        {data.pending.count} events queued
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
} 