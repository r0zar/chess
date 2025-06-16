"use client"

import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import Auth from "@/components/auth"
import Link from "next/link"
import { ArrowLeft, Crown } from "lucide-react"
import GameSidebar from "@/components/game/game-sidebar"
import { useGameEvents } from "@/components/game-events-provider"

const Chessboard = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard), {
  ssr: false,
  loading: () => (
    <div className="w-full bg-neutral-800/50 animate-pulse rounded-2xl shadow-2xl border border-neutral-700/50"></div>
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
      const size = Math.min(width * 0.85, height * 0.75)
      setBoardWidth(Math.max(320, size))
    }
  }

  useEffect(() => {
    updateBoardWidth()
    window.addEventListener("resize", updateBoardWidth)
    return () => window.removeEventListener("resize", updateBoardWidth)
  }, [])

  const isMyTurn = gameStatus === "ongoing" && currentTurn === clientPlayerColor && !!clientPlayerColor && !chessGame?.isGameOver() && !isRefreshing

  return (
    <div className="grid grid-cols-[1fr_350px] h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="flex flex-col h-full">
        {/* Modern Header */}
        <header className="py-4 px-6 border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-xl">
          <div className="flex justify-between items-center">
            <Link
              href="/"
              className="flex items-center gap-3 text-neutral-300 hover:text-amber-400 transition-all duration-200 group"
            >
              <div className="w-8 h-8 rounded-xl bg-neutral-800/60 flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="font-medium">Back to Lobby</span>
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                <span className="text-lg font-semibold text-white">Stacks Chess</span>
              </div>
              <Auth />
            </div>
          </div>
        </header>

        {/* Main Game Area */}
        <main ref={mainContentRef} className="flex-grow flex items-center justify-center p-8 relative">
          {/* Debug Panel */}
          {showDebug && (
            <div className="absolute top-4 left-4 bg-neutral-950/95 backdrop-blur-xl text-white p-6 z-50 rounded-2xl shadow-2xl max-w-sm max-h-[85%] overflow-auto border border-neutral-800/60">
              <h3 className="font-bold text-lg mb-4 border-b border-neutral-800 pb-2 text-amber-400">Debug Panel</h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-blue-400 mb-2">Move History ({moveHistory.length} moves)</h4>
                  <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/40 max-h-40 overflow-auto">
                    <pre className="text-xs text-neutral-300">{JSON.stringify(moveHistory, null, 2)}</pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-green-400 mb-2">Game State</h4>
                  <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/40">
                    <pre className="text-xs text-neutral-300">
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
                </div>
              </div>
            </div>
          )}

          {/* Chess Board Container */}
          {chessGame && (
            <div className="relative" style={{ width: boardWidth, height: boardWidth }}>
              {/* Board Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-blue-400/10 rounded-2xl blur-xl scale-105 -z-10" />

              <div className="relative bg-neutral-900/40 backdrop-blur-sm rounded-2xl p-4 border border-neutral-800/60 shadow-2xl">
                <Chessboard
                  position={currentFen ?? undefined}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  arePiecesDraggable={isMyTurn}
                  boardOrientation={clientPlayerColor === "b" ? "black" : "white"}
                  customBoardStyle={{
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                  }}
                  customSquareStyles={possibleMoves}
                  boardWidth={boardWidth - 32} // Account for padding
                />

                {/* Turn Indicator */}
                {gameStatus === "ongoing" && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700/60 rounded-full px-4 py-2 flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-green-400 animate-pulse' : 'bg-neutral-500'}`} />
                      <span className="text-sm font-medium text-white">
                        {isMyTurn ? "Your Turn" : `${currentTurn === "w" ? "White's" : "Black's"} Turn`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Loading Overlay */}
                {isRefreshing && (
                  <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center rounded-2xl z-20">
                    <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700/60 text-white px-6 py-3 rounded-xl shadow-xl flex items-center space-x-3">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="font-medium">Syncing game state...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modern Sidebar */}
      <GameSidebar
        onToggleDebug={() => setShowDebug((prev) => !prev)}
        isRefreshing={isRefreshing}
        connectionState={connectionState}
      />
    </div>
  )
}