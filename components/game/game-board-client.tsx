"use client"

import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import Auth from "@/components/auth"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import GameSidebar from "@/components/game/game-sidebar"
import { useGameEvents } from "@/components/game-events-provider"

const Chessboard = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard), {
  ssr: false,
  loading: () => (
    <div className="w-full bg-slate-700 animate-pulse rounded-md shadow-lg"></div>
  ),
})

export default function GameBoardClient({ gameId }: { gameId: string }) {
  const {
    assignedBlackId,
    assignedWhiteId,
    connectionState,
    chessGame,
    currentFen,
    clientPlayerColor,
    currentTurn,
    gameStatus,
    winner,
    moveHistory,
    possibleMoves,
    isRefreshing,
    showDebug,
    setShowDebug,
    onPieceDrop,
    onSquareClick
  } = useGameEvents()

  const [boardWidth, setBoardWidth] = useState(500)
  const mainContentRef = useRef<HTMLDivElement>(null)

  const updateBoardWidth = () => {
    if (mainContentRef.current) {
      const { width, height } = mainContentRef.current.getBoundingClientRect()
      const size = Math.min(width * 0.9, height * 0.8)
      setBoardWidth(Math.max(280, size))
    }
  }

  useEffect(() => {
    updateBoardWidth()
    window.addEventListener("resize", updateBoardWidth)
    return () => window.removeEventListener("resize", updateBoardWidth)
  }, [])

  const isMyTurn = gameStatus === "ongoing" && currentTurn === clientPlayerColor && !!clientPlayerColor && !chessGame?.isGameOver() && !isRefreshing

  return (
    <div className="grid grid-cols-[1fr_300px] h-screen bg-slate-900 text-slate-50">
      <div className="flex flex-col h-full">
        <header className="py-3 px-4 sm:px-6 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-300 hover:text-sky-400 transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lobby
            </Link>
            <div className="flex items-center gap-2">
              <Auth />
            </div>
          </div>
        </header>

        <main ref={mainContentRef} className="flex-grow flex items-center justify-center p-4 relative">
          {showDebug && (
            <div className="absolute top-2 left-2 bg-black/80 text-white p-4 z-50 rounded-lg shadow-2xl max-w-sm max-h-[90%] overflow-auto border border-slate-600">
              <h3 className="font-bold text-lg mb-2 border-b border-slate-600 pb-1">Client State Debug</h3>
              <h4 className="font-semibold mt-2 text-sky-400">Move History ({moveHistory.length} moves)</h4>
              <pre className="text-xs bg-slate-800 p-2 rounded mt-1">{JSON.stringify(moveHistory, null, 2)}</pre>
              <h4 className="font-semibold mt-3 text-sky-400">Game State</h4>
              <pre className="text-xs bg-slate-800 p-2 rounded mt-1">
                {JSON.stringify(
                  {
                    gameId,
                    gameStatus,
                    currentTurn,
                    winner,
                    clientPlayerColor,
                    isMyTurn,
                    isRefreshing,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}

          {chessGame && (
            <div className="relative" style={{ width: boardWidth, height: boardWidth }}>
              <Chessboard
                position={currentFen ?? undefined}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                arePiecesDraggable={isMyTurn}
                boardOrientation={clientPlayerColor === "b" ? "black" : "white"}
                customBoardStyle={{
                  borderRadius: "8px",
                  boxShadow: "0 5px 15px rgba(0, 0, 0, 0.3)",
                }}
                customSquareStyles={possibleMoves}
                boardWidth={boardWidth}
              />
              {isRefreshing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg z-10">
                  <div className="text-white text-lg font-semibold p-4 bg-slate-700 rounded-md">Syncing...</div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <GameSidebar
        onToggleDebug={() => setShowDebug((prev) => !prev)}
        isRefreshing={isRefreshing}
        connectionState={connectionState}
      />
    </div>
  )
}
