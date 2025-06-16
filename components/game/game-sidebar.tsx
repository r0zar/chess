"use client"
import { Badge } from "@/components/ui/badge"
import type React from "react"
import { useEffect, useState } from "react"
import { getUserById } from "@/lib/user"

import type { PlayerColor, Move, PieceSymbol } from "@/lib/chess-logic/types"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Trophy,
  Info,
  Users,
  Swords,
  ArrowUpCircle,
  Crown,
  Gem,
  Castle,
  Church,
  Shield,
  UserCircle,
  MoveRight,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react"
import { useGameEvents } from "../game-events-provider"
import { useGlobalEvents } from "@/components/global-events-provider"

const getPieceName = (pieceSymbol: PieceSymbol): string => {
  const names: Record<PieceSymbol, string> = {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King",
  }
  return names[pieceSymbol]
}

// Helper component to render a piece icon
const PieceIcon = ({ piece, className }: { piece: PieceSymbol; className?: string }) => {
  const iconMap: Record<PieceSymbol, React.ElementType> = {
    k: Crown,
    q: Gem,
    r: Castle,
    b: Church,
    n: Shield,
    p: UserCircle,
  }
  const IconComponent = iconMap[piece]
  if (!IconComponent) {
    return <span className={`font-bold ${className}`}>{piece.toUpperCase()}</span>
  }
  return <IconComponent className={`h-4 w-4 ${className}`} />
}

// Helper component to render the details of a single move
const MoveDetail = ({ move }: { move?: Move }) => {
  if (!move) {
    return <div className="h-6" /> // Empty placeholder for alignment
  }

  const pieceName = getPieceName(move.piece)

  return (
    <div
      className="flex flex-col items-start text-xs p-2 rounded-lg bg-neutral-800/30 hover:bg-neutral-800/50 transition-colors border border-neutral-700/30"
      title={`Move: ${move.san} (${pieceName} from ${move.from} to ${move.to})`}
    >
      <div className="flex items-center gap-1.5 w-full">
        <PieceIcon piece={move.piece} className="text-neutral-300 shrink-0" />
        <span className="font-medium text-neutral-200 text-xs">{pieceName}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="font-mono text-neutral-400 text-xs">{move.from}</span>
          <MoveRight className="h-3 w-3 text-neutral-500 shrink-0" />
          <span className="font-mono text-neutral-400 text-xs">{move.to}</span>
        </div>
      </div>
      <div className="flex items-center justify-between w-full mt-1">
        <span className="font-mono text-blue-300 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">{move.san}</span>
        <div className="flex items-center gap-1">
          {move.captured && (
            <div className="flex items-center gap-0.5 text-red-400/80 bg-red-500/10 px-1.5 py-0.5 rounded" title={`Captured ${getPieceName(move.captured)}`}>
              <Swords className="h-3 w-3 shrink-0" />
              <PieceIcon piece={move.captured} className="opacity-80 h-3 w-3" />
            </div>
          )}
          {move.promotion && (
            <div
              className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded"
              title={`Promoted to ${getPieceName(move.promotion)}`}
            >
              <ArrowUpCircle className="h-3 w-3 shrink-0" />
              <PieceIcon piece={move.promotion} className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface GameSidebarProps {
  onToggleDebug: () => void
  isRefreshing: boolean
  connectionState: 'disconnected' | 'connecting' | 'connected'
}

export default function GameSidebar({
  onToggleDebug,
  isRefreshing,
  connectionState,
}: GameSidebarProps) {

  const {
    assignedWhiteId,
    assignedBlackId,
    gameStatus,
    currentTurn,
    winner,
    moveHistory,
    clientPlayerColor,
  } = useGameEvents()
  const { userUuid } = useGlobalEvents()

  console.log(`[GameSidebar] assignedWhiteId: ${assignedWhiteId}, assignedBlackId: ${assignedBlackId}`)

  const yourRole = clientPlayerColor ? `Playing as ${clientPlayerColor === "w" ? "White" : "Black"}` : "Spectating"
  const isYourTurn = gameStatus === "ongoing" && currentTurn === clientPlayerColor && !!clientPlayerColor

  const formatPlayer = (id: string | null | undefined) => {
    if (id) {
      return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`
    }
    return "Open Slot"
  }

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "outline" | "destructive" => {
    if (!status) return "secondary"
    if (status.toLowerCase().includes("wins")) return "default"
    if (status === "ongoing") return "default"
    if (status === "pending") return "secondary"
    if (status.toLowerCase().includes("draw") || status === "stalemate") return "outline"
    return "destructive"
  }

  const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-neutral-800/30 border border-neutral-700/30">
      <span className="text-neutral-400 font-medium">{label}</span>
      <span className="font-medium text-neutral-200 text-right truncate max-w-[60%]">{children}</span>
    </div>
  )

  const groupedMoves: { moveNumber: number; white?: Move; black?: Move }[] = []
  if (moveHistory && Array.isArray(moveHistory)) {
    for (let i = 0; i < moveHistory.length; i++) {
      const move = moveHistory[i]
      if (!move || typeof move !== "object") {
        console.warn(`[GameSidebar ${assignedWhiteId || assignedBlackId}] Invalid move object at index ${i}:`, move)
        continue
      }
      const moveNumber = Math.floor(i / 2) + 1

      if (i % 2 === 0) {
        // White's move
        groupedMoves.push({ moveNumber, white: move })
      } else {
        // Black's move
        if (groupedMoves[groupedMoves.length - 1]?.moveNumber === moveNumber) {
          groupedMoves[groupedMoves.length - 1].black = move
        } else {
          console.warn(
            `[GameSidebar ${assignedWhiteId || assignedBlackId}] Mismatched move number for black move at index ${i}. History might be corrupted or incomplete. Creating new entry.`,
            move,
          )
          groupedMoves.push({ moveNumber, black: move })
        }
      }
    }
  } else if (moveHistory) {
    console.warn(`[GameSidebar ${assignedWhiteId || assignedBlackId}] moveHistory is not an array:`, moveHistory)
  }

  const getConnectionIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <Wifi className="h-3 w-3 text-green-400" />
      case 'connecting':
        return <Loader2 className="h-3 w-3 text-yellow-400 animate-spin" />
      default:
        return <WifiOff className="h-3 w-3 text-red-400" />
    }
  }

  const getConnectionStatus = () => {
    switch (connectionState) {
      case 'connected':
        return { text: 'Live', color: 'text-green-400' }
      case 'connecting':
        return { text: 'Connecting', color: 'text-yellow-400' }
      default:
        return { text: 'Offline', color: 'text-red-400' }
    }
  }

  const connectionStatus = getConnectionStatus()

  return (
    <aside className="w-[350px] bg-neutral-900/60 backdrop-blur-xl border-l border-neutral-800/60 h-full">
      <div className="h-full flex flex-col">
        {/* Modern Header */}
        <div className="flex-shrink-0 bg-neutral-950/80 backdrop-blur-xl">
          <div className="p-6 border-b border-neutral-800/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center">
                  <Info className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Game Info</h2>
              </div>
              <button
                onClick={onToggleDebug}
                className="w-8 h-8 rounded-xl bg-neutral-800/60 hover:bg-neutral-700/60 transition-colors flex items-center justify-center group"
                title="Toggle Debug View"
              >
                <Info className="h-4 w-4 text-neutral-400 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Connection Status */}
            <div className="flex items-center justify-between bg-neutral-800/40 rounded-xl p-3 border border-neutral-700/40">
              <div className="flex items-center gap-2">
                {getConnectionIcon()}
                <span className={`text-sm font-medium ${connectionStatus.color}`}>
                  {isRefreshing ? 'Syncing...' : connectionStatus.text}
                </span>
              </div>
              <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-400' :
                  connectionState === 'connecting' ? 'bg-yellow-400' :
                    'bg-red-400'
                } ${connectionState === 'connected' ? 'animate-pulse' : ''}`} />
            </div>
          </div>

          {/* Game Details */}
          <div className="p-6 space-y-6">
            {/* Status Section */}
            <div>
              <h3 className="text-xs uppercase text-neutral-500 font-semibold mb-3 flex items-center">
                <Trophy className="h-3 w-3 mr-2" />
                Game Status
              </h3>
              <div className="space-y-2">
                <InfoRow label="Status">
                  <Badge variant={getStatusBadgeVariant(gameStatus)} className="font-medium">
                    {gameStatus.replace(/_/g, " ")}
                  </Badge>
                </InfoRow>
                {currentTurn && gameStatus === "ongoing" && (
                  <InfoRow label="Turn">
                    <Badge variant={isYourTurn ? "default" : "secondary"} className="font-medium">
                      {currentTurn === "w" ? "White" : "Black"}
                      {isYourTurn && " (You)"}
                    </Badge>
                  </InfoRow>
                )}
                {winner && (
                  <InfoRow label="Winner">
                    <Badge variant="default" className="font-medium">
                      <Trophy className="inline h-3 w-3 mr-1" />
                      {winner === "w" ? "White" : "Black"}
                    </Badge>
                  </InfoRow>
                )}
                <InfoRow label="Your Role">
                  <span className="text-amber-400 font-medium">{yourRole}</span>
                </InfoRow>
              </div>
            </div>

            {/* Players Section */}
            <div>
              <h3 className="text-xs uppercase text-neutral-500 font-semibold mb-3 flex items-center">
                <Users className="h-3 w-3 mr-2" />
                Players
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white rounded-full border-2 border-neutral-600 flex items-center justify-center">
                      <div className="w-2 h-2 bg-neutral-800 rounded-full" />
                    </div>
                    <span className="text-neutral-300 font-medium">White</span>
                  </div>
                  <span className="font-mono text-xs bg-neutral-700/50 px-2 py-1 rounded-md text-neutral-200" title={assignedWhiteId || undefined}>
                    {formatPlayer(assignedWhiteId)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 border border-neutral-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-neutral-800 rounded-full border-2 border-neutral-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <span className="text-neutral-300 font-medium">Black</span>
                  </div>
                  <span className="font-mono text-xs bg-neutral-700/50 px-2 py-1 rounded-md text-neutral-200" title={assignedBlackId || undefined}>
                    {formatPlayer(assignedBlackId)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Move History Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 p-6 border-b border-neutral-800/60 bg-neutral-950/60">
            <h3 className="text-xs uppercase text-neutral-500 font-semibold flex items-center">
              <Swords className="h-3 w-3 mr-2" />
              Move History ({moveHistory?.length || 0} moves)
            </h3>
          </div>

          <div className="flex-1 relative">
            <div className="absolute inset-0">
              <ScrollArea className="h-full w-full">
                <div className="p-6 pb-24">
                  {groupedMoves.length === 0 ? (
                    <div className="text-center py-8">
                      <Swords className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
                      <p className="text-neutral-500 text-sm">No moves yet</p>
                      <p className="text-neutral-600 text-xs mt-1">Game will start soon</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupedMoves.map(({ moveNumber, white, black }) => (
                        <div key={moveNumber} className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-neutral-400 font-mono text-xs bg-neutral-800/40 px-2 py-1 rounded-md min-w-[2rem] text-center">
                              {moveNumber}.
                            </span>
                            <div className="h-px bg-neutral-800/40 flex-1" />
                          </div>
                          <div className="grid grid-cols-1 gap-2 pl-2">
                            {white && (
                              <div>
                                <div className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                  White
                                </div>
                                <MoveDetail move={white} />
                              </div>
                            )}
                            {black && (
                              <div>
                                <div className="text-[10px] text-neutral-500 mb-1 flex items-center gap-1">
                                  <div className="w-2 h-2 bg-neutral-800 border border-neutral-500 rounded-full" />
                                  Black
                                </div>
                                <MoveDetail move={black} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}