"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, GamepadIcon, Eye, Wifi, ChevronUp, ChevronDown } from "lucide-react"
import { useConnectionStats } from "@/hooks/useConnectionStats"

export default function GlobalStatsPanel() {
    const [isExpanded, setIsExpanded] = useState(false)
    const { globalStats, isLoading, isConnected } = useConnectionStats()

    // Show loading only if we're not connected or if we're connected but have no stats yet
    const shouldShowLoading = isLoading && (!isConnected || globalStats.totalConnections === 0)

    if (shouldShowLoading) {
        return (
            <div className="fixed bottom-4 right-4 z-50">
                <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            <span className="text-xs text-slate-300">Loading...</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <Card className="bg-slate-800/90 border-slate-700 backdrop-blur-sm shadow-lg min-w-[200px]">
                {isExpanded ? (
                    <>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                                    <Wifi className={`w-3 h-3 ${isConnected ? 'text-green-400' : 'text-red-400'}`} />
                                    Live Stats
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsExpanded(false)}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                                >
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                            {/* Active Players */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <GamepadIcon className="w-3 h-3 text-blue-400" />
                                    <span className="text-xs text-slate-300">Playing</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                    {globalStats.activePlayers}
                                </Badge>
                            </div>

                            {/* Spectators */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-3 h-3 text-purple-400" />
                                    <span className="text-xs text-slate-300">Watching</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                    {globalStats.totalSpectators}
                                </Badge>
                            </div>

                            {/* Total Online */}
                            <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                                <div className="flex items-center gap-2">
                                    <Users className="w-3 h-3 text-green-400" />
                                    <span className="text-xs text-slate-300">Total Online</span>
                                </div>
                                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                                    {globalStats.totalConnections}
                                </Badge>
                            </div>

                            {/* Connection Status */}
                            <div className="text-center pt-1">
                                <div className={`inline-flex items-center gap-1 text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} ${isConnected ? 'animate-pulse' : ''}`} />
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </div>
                            </div>
                        </CardContent>
                    </>
                ) : (
                    <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                <span className="text-xs text-slate-300">
                                    {globalStats.totalConnections} online
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsExpanded(true)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                            >
                                <ChevronUp className="w-3 h-3" />
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    )
} 