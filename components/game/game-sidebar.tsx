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
      className="flex flex-col items-start text-xs"
      title={`Move: ${move.san} (${pieceName} from ${move.from} to ${move.to})`}
    >
      <div className="flex items-center gap-1.5">
        <PieceIcon piece={move.piece} className="text-slate-300 shrink-0" />
        <span className="font-medium text-slate-200">{pieceName}</span>
        <span className="font-mono text-slate-400">{move.from}</span>
        <MoveRight className="h-3 w-3 text-slate-500 shrink-0" />
        <span className="font-mono text-slate-400">{move.to}</span>
      </div>
      <div className="flex items-center gap-1.5 pl-[calc(1rem+0.375rem)]">
        {" "}
        {/* Indent to align with piece name */}
        <span className="font-mono text-sky-300 text-[11px]">({move.san})</span>
        {move.captured && (
          <div className="flex items-center gap-0.5 text-red-400/80" title={`Captured ${getPieceName(move.captured)}`}>
            <Swords className="h-3 w-3 shrink-0" />
            <PieceIcon piece={move.captured} className="opacity-80 h-3 w-3" />
          </div>
        )}
        {move.promotion && (
          <div
            className="flex items-center gap-0.5 text-teal-400"
            title={`Promoted to ${getPieceName(move.promotion)}`}
          >
            <ArrowUpCircle className="h-3 w-3 shrink-0" />
            <PieceIcon piece={move.promotion} className="h-3 w-3" />
          </div>
        )}
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

  const formatPlayerDisplay = (display: string | null | undefined) => {
    if (!display) return "Open Slot"
    // show first 6 and last 4 characters if longer than 10
    if (display.length > 10) {
      return `${display.substring(0, 6)}...${display.substring(display.length - 4)}`
    }
    return display
  }

  const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-200 text-right truncate">{children}</span>
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
          // This case implies a black move starting a new number, which is unusual unless history is partial.
          console.warn(
            `[GameSidebar ${assignedWhiteId || assignedBlackId}] Mismatched move number for black move at index ${i}. History might be corrupted or incomplete. Creating new entry.`,
            move,
          )
          groupedMoves.push({ moveNumber, black: move }) // Or handle as an error / placeholder
        }
      }
    }
  } else if (moveHistory) {
    console.warn(`[GameSidebar ${assignedWhiteId || assignedBlackId}] moveHistory is not an array:`, moveHistory)
  }

  return (
    <aside className="w-[300px] bg-slate-800/50 border-l border-slate-700 h-full">
      <div className="h-full flex flex-col">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-100">Game Info</h2>
              <button
                onClick={onToggleDebug}
                className="w-5 h-5 rounded-full bg-slate-600/50 hover:bg-slate-600 transition-colors flex items-center justify-center"
                title="Toggle Debug View"
              >
                <Info className="h-3 w-3 text-slate-400" />
              </button>
            </div>
            <button
              // onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-slate-700/50 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Click to refresh game state"
            >
              <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-400' :
                connectionState === 'connecting' ? 'bg-yellow-400' :
                  'bg-red-400'
                }`} />
              <span className="text-slate-300">
                {isRefreshing ? 'Syncing...' :
                  connectionState === 'connected' ? 'Live' :
                    connectionState === 'connecting' ? 'Connecting' :
                      'Offline'}
              </span>
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1.5 flex items-center">
                <Info className="h-3 w-3 mr-1.5" />
                Details
              </h3>
              <div className="space-y-1">
                <InfoRow label="Status">
                  <Badge variant={getStatusBadgeVariant(gameStatus)}>
                    {gameStatus.replace(/_/g, " ")}
                  </Badge>
                </InfoRow>
                {currentTurn && gameStatus === "ongoing" && (
                  <InfoRow label="Turn">
                    <Badge variant={isYourTurn ? "default" : "secondary"}>
                      {currentTurn === "w" ? "White" : "Black"}
                      {isYourTurn && " (You)"}
                    </Badge>
                  </InfoRow>
                )}
                {winner && (
                  <InfoRow label="Winner">
                    <Badge variant="default">
                      <Trophy className="inline h-3 w-3 mr-1" />
                      {winner === "w" ? "White" : "Black"}
                    </Badge>
                  </InfoRow>
                )}
                <InfoRow label="Your Role">{yourRole}</InfoRow>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1.5 flex items-center">
                <Users className="h-3 w-3 mr-1.5" />
                Players
              </h3>
              <div className="space-y-1">
                <InfoRow label="White">
                  <span className="font-mono text-xs" title={assignedWhiteId || undefined}>
                    {formatPlayer(assignedWhiteId)}
                  </span>
                </InfoRow>
                <InfoRow label="Black">
                  <span className="font-mono text-xs" title={assignedBlackId || undefined}>
                    {formatPlayer(assignedBlackId)}
                  </span>
                </InfoRow>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Move History Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 p-4 border-t border-b border-slate-700">
            <h3 className="text-xs uppercase text-slate-500 font-semibold flex items-center">
              <Swords className="h-3 w-3 mr-1.5" />
              Move History ({moveHistory?.length || 0} ply)
            </h3>
          </div>

          <div className="flex-1 relative">
            <div className="absolute inset-0">
              <ScrollArea className="h-full w-full">
                <div className="p-4 text-sm mb-24">
                  {groupedMoves.length === 0 ? (
                    <p className="text-slate-500 text-center text-xs py-4">No moves yet.</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {groupedMoves.map(({ moveNumber, white, black }) => (
                        <li key={moveNumber} className="grid grid-cols-[20px_1fr_1fr] items-start gap-x-1.5 text-slate-300">
                          <span className="text-slate-500 text-right tabular-nums pr-1 text-xs pt-1">{moveNumber}.</span>
                          <MoveDetail move={white} />
                          <MoveDetail move={black} />
                        </li>
                      ))}
                    </ol>
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