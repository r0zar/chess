import Link from "next/link"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import RelativeTimeDisplay from "@/components/relative-time-display"
import { Button } from "@/components/ui/button"
import type { GameData } from "@/lib/chess-data.types"
import { ReactNode } from "react"

interface GameCardProps {
    game: GameData
    userUuid: string | null
    getStatusBadgeVariant: (status: string | null) => "default" | "secondary" | "outline" | "destructive"
    getPlayerDisplay: (id: string | null | undefined) => string
    yourTurn?: boolean
    footer?: ReactNode
}

export default function GameCard({
    game,
    userUuid,
    getStatusBadgeVariant,
    getPlayerDisplay,
    yourTurn = false,
    footer
}: GameCardProps) {
    return (
        <Card
            className="group relative bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 backdrop-blur-sm border border-neutral-800/60 hover:border-amber-400/50 transition-all duration-300 rounded-xl overflow-hidden min-h-0"
        >
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 via-transparent to-amber-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            {/* Your turn indicator */}
            {yourTurn && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
            )}
            <CardHeader className="pb-2 p-3">
                <div className="flex items-start justify-between mb-1">
                    <div className="space-y-0.5">
                        <div className="text-[10px] font-mono text-amber-400/80 group-hover:text-amber-400 transition-colors">
                            #{game.id.substring(0, 8)}
                        </div>
                        {yourTurn && (
                            <div className="flex items-center space-x-1">
                                <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                                <span className="text-[10px] font-medium text-green-400">Your move</span>
                            </div>
                        )}
                    </div>
                    <Badge
                        variant={getStatusBadgeVariant(game.status)}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    >
                        {game.status.replace(/_/g, " ")}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-2">
                <div className="space-y-2">
                    {/* Players section */}
                    <div className="bg-neutral-800/50 rounded-lg p-2 space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <div className="w-4 h-4 bg-white rounded-full border-2 border-neutral-600 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-neutral-800 rounded-full" />
                                </div>
                                <span className="text-neutral-400 text-xs font-medium">White</span>
                            </div>
                            <span className="font-mono text-neutral-200 text-[10px] bg-neutral-700/50 px-1.5 py-0.5 rounded-md">
                                {getPlayerDisplay(game.playerWhiteId)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <div className="w-4 h-4 bg-neutral-800 rounded-full border-2 border-neutral-500 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                </div>
                                <span className="text-neutral-400 text-xs font-medium">Black</span>
                            </div>
                            <span className="font-mono text-neutral-200 text-[10px] bg-neutral-700/50 px-1.5 py-0.5 rounded-md">
                                {getPlayerDisplay(game.playerBlackId)}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-3 pt-0">
                {footer}
            </CardFooter>
        </Card>
    )
} 