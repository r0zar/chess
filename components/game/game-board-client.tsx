"use client"

import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import Auth from "@/components/auth"
import Link from "next/link"
import { ArrowLeft, Crown, Sparkles, RefreshCw } from "lucide-react"
import GameSidebar from "@/components/game/game-sidebar"
import { useGameEvents } from "@/components/game-events-provider"
import { useGlobalEvents } from "@/components/global-events-provider"
import { principalCV, fetchCallReadOnlyFunction, ClarityValue } from "@stacks/transactions"

const Chessboard = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard), {
  ssr: false,
  loading: () => (
    <div className="w-full bg-neutral-800/50 animate-pulse rounded-2xl shadow-2xl border border-neutral-700/50"></div>
  ),
})

// EXP Balance Display Component
function ExpBalanceDisplay() {
  const [expBalance, setExpBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { stxAddress } = useGlobalEvents()

  // Load cached balance from localStorage on mount or stxAddress change
  useEffect(() => {
    if (stxAddress && typeof window !== 'undefined') {
      const cached = localStorage.getItem(`exp-balance-${stxAddress}`)
      if (cached) {
        setExpBalance(Number(cached))
      }
    }
  }, [stxAddress])

  const fetchExpBalance = async () => {
    if (!stxAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // Call Stacks API to get contract balance
      const response: any = await fetchCallReadOnlyFunction({
        contractName: "experience",
        contractAddress: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
        functionName: "get-balance",
        functionArgs: [principalCV(stxAddress)],
        senderAddress: stxAddress,
      })

      const data = Number(response.value.value) / 1_000_000

      if (typeof data === 'number') {
        setExpBalance(data)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`exp-balance-${stxAddress}`, String(data))
        }
      }
    } catch (err) {
      console.error('Error fetching EXP balance:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (stxAddress) {
      fetchExpBalance()
      // Refresh balance every 30 seconds
      const interval = setInterval(fetchExpBalance, 30000)
      return () => clearInterval(interval)
    }
  }, [stxAddress])

  return (
    <div className="flex items-center gap-2 bg-neutral-900/60 backdrop-blur-sm border border-neutral-800/50 rounded-xl px-3 py-2 group hover:border-amber-400/30 transition-colors">
      <div className="relative">
        <div className="text-lg animate-gentle-bounce">✨</div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <div className="text-xs text-neutral-500 leading-none">EXP</div>
        <div className="text-sm font-semibold text-amber-400 leading-none">
          {error ? (
            <span className="text-red-400 text-xs cursor-pointer" onClick={fetchExpBalance}>
              {error}
            </span>
          ) : expBalance !== null ? (
            <span className="tabular-nums">
              {expBalance.toLocaleString()}
            </span>
          ) : (
            <div className="w-8 h-3 bg-neutral-700/50 rounded animate-pulse" />
          )}
        </div>
      </div>

      {!isLoading && (
        <button
          onClick={fetchExpBalance}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
          title="Refresh EXP balance"
        >
          <RefreshCw className="h-3 w-3 text-neutral-500 hover:text-amber-400 transition-colors" />
        </button>
      )}
    </div>
  )
}

export default function GameBoardClient({ gameId }: { gameId: string }) {
  const {
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

            <div className="flex items-center gap-4">
              <ExpBalanceDisplay />

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