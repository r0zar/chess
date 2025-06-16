"use client"

import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import Auth from "@/components/auth"
import Link from "next/link"
import { ArrowLeft, Crown, Sparkles, RefreshCw, Menu, X, Info } from "lucide-react"
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

// Mobile-responsive EXP Balance Display Component
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
    <div className="flex items-center gap-2 bg-neutral-900/60 backdrop-blur-sm border border-neutral-800/50 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 group hover:border-amber-400/30 transition-colors">
      <div className="relative">
        <div className="text-sm sm:text-lg animate-gentle-bounce">✨</div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="h-2 w-2 sm:h-3 sm:w-3 text-amber-400 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <div className="text-[10px] sm:text-xs text-neutral-500 leading-none">EXP</div>
        <div className="text-xs sm:text-sm font-semibold text-amber-400 leading-none">
          {error ? (
            <span className="text-red-400 text-[10px] sm:text-xs cursor-pointer" onClick={fetchExpBalance}>
              Error
            </span>
          ) : expBalance !== null ? (
            <span className="tabular-nums">
              {expBalance >= 1000 ? `${(expBalance / 1000).toFixed(1)}k` : expBalance.toLocaleString()}
            </span>
          ) : (
            <div className="w-6 sm:w-8 h-2 sm:h-3 bg-neutral-700/50 rounded animate-pulse" />
          )}
        </div>
      </div>

      {!isLoading && (
        <button
          onClick={fetchExpBalance}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 hidden sm:block"
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

  const [boardWidth, setBoardWidth] = useState(320)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        setIsSidebarOpen(false) // Close sidebar on desktop
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const updateBoardWidth = () => {
    if (mainContentRef.current) {
      const { width, height } = mainContentRef.current.getBoundingClientRect()
      const availableWidth = isMobile ? width * 0.95 : width * 0.85
      const availableHeight = isMobile ? height * 0.85 : height * 0.75
      const size = Math.min(availableWidth, availableHeight)
      setBoardWidth(Math.max(280, size))
    }
  }

  useEffect(() => {
    updateBoardWidth()
    window.addEventListener("resize", updateBoardWidth)
    return () => window.removeEventListener("resize", updateBoardWidth)
  }, [isMobile])

  const isMyTurn = gameStatus === "ongoing" && currentTurn === clientPlayerColor && !!clientPlayerColor && !chessGame?.isGameOver() && !isRefreshing

  return (
    <div className="h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 relative">
      {/* Mobile Layout */}
      <div className="flex flex-col h-full md:grid md:grid-cols-[1fr_350px]">
        <div className="flex flex-col h-full">
          {/* Responsive Header */}
          <header className="py-3 sm:py-4 px-4 sm:px-6 border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-xl">
            <div className="flex justify-between items-center">
              <Link
                href="/"
                className="flex items-center gap-2 sm:gap-3 text-neutral-300 hover:text-amber-400 transition-all duration-200 group"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-neutral-800/60 flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </div>
                <span className="font-medium text-sm sm:text-base hidden sm:block">Back to Lobby</span>
                <span className="font-medium text-sm sm:hidden">Back</span>
              </Link>

              <div className="flex items-center gap-2 sm:gap-4">
                <ExpBalanceDisplay />

                {/* Mobile Sidebar Toggle */}
                {isMobile && (
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="w-8 h-8 rounded-lg bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-700/60 transition-colors md:hidden"
                  >
                    <Info className="h-4 w-4 text-neutral-300" />
                  </button>
                )}

                <div className="hidden sm:block">
                  <Auth />
                </div>
              </div>
            </div>
          </header>

          {/* Main Game Area */}
          <main ref={mainContentRef} className="flex-grow flex items-center justify-center p-4 sm:p-8 relative">
            {/* Debug Panel - Responsive */}
            {showDebug && (
              <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-neutral-950/95 backdrop-blur-xl text-white p-4 sm:p-6 z-50 rounded-xl sm:rounded-2xl shadow-2xl max-w-[90vw] sm:max-w-sm max-h-[70vh] sm:max-h-[85%] overflow-auto border border-neutral-800/60">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="font-bold text-base sm:text-lg text-amber-400">Debug Panel</h3>
                  <button
                    onClick={() => setShowDebug(false)}
                    className="w-6 h-6 rounded-lg bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-700/60 transition-colors"
                  >
                    <X className="h-3 w-3 text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h4 className="font-semibold text-blue-400 mb-2 text-sm">Move History ({moveHistory.length})</h4>
                    <div className="bg-neutral-900/60 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-neutral-800/40 max-h-32 sm:max-h-40 overflow-auto">
                      <pre className="text-[10px] sm:text-xs text-neutral-300">{JSON.stringify(moveHistory.slice(-5), null, 2)}</pre>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-green-400 mb-2 text-sm">Game State</h4>
                    <div className="bg-neutral-900/60 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-neutral-800/40">
                      <pre className="text-[10px] sm:text-xs text-neutral-300">
                        {JSON.stringify(
                          {
                            gameId,
                            gameStatus,
                            currentTurn,
                            winner,
                            clientPlayerColor,
                            isMyTurn,
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

            {/* Chess Board Container - Responsive */}
            {chessGame && (
              <div className="relative" style={{ width: boardWidth, height: boardWidth }}>
                {/* Board Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-blue-400/10 rounded-xl sm:rounded-2xl blur-xl scale-105 -z-10" />

                <div className="relative bg-neutral-900/40 backdrop-blur-sm rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-neutral-800/60 shadow-2xl">
                  <Chessboard
                    position={currentFen ?? undefined}
                    onPieceDrop={onPieceDrop}
                    onSquareClick={onSquareClick}
                    arePiecesDraggable={isMyTurn}
                    boardOrientation={clientPlayerColor === "b" ? "black" : "white"}
                    customBoardStyle={{
                      borderRadius: isMobile ? "8px" : "12px",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                    }}
                    customSquareStyles={possibleMoves}
                    boardWidth={boardWidth - (isMobile ? 16 : 32)} // Account for padding
                  />

                  {/* Turn Indicator - Responsive */}
                  {gameStatus === "ongoing" && (
                    <div className="absolute -top-2 sm:-top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700/60 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 flex items-center space-x-2">
                        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isMyTurn ? 'bg-green-400 animate-pulse' : 'bg-neutral-500'}`} />
                        <span className="text-xs sm:text-sm font-medium text-white">
                          {isMyTurn ? "Your Turn" : `${currentTurn === "w" ? "White's" : "Black's"} Turn`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Loading Overlay */}
                  {isRefreshing && (
                    <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center rounded-xl sm:rounded-2xl z-20">
                      <div className="bg-neutral-900/90 backdrop-blur-sm border border-neutral-700/60 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-xl flex items-center space-x-2 sm:space-x-3">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium text-sm sm:text-base">Syncing...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* Mobile Auth Bar */}
          {isMobile && (
            <div className="border-t border-neutral-800/60 bg-neutral-950/80 backdrop-blur-xl p-4">
              <Auth />
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <GameSidebar
            onToggleDebug={() => setShowDebug((prev) => !prev)}
            isRefreshing={isRefreshing}
            connectionState={connectionState}
          />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <>
          {/* Backdrop */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sliding Sidebar */}
          <div className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-neutral-900/95 backdrop-blur-xl border-l border-neutral-800/60 z-50 transform transition-transform duration-300 md:hidden ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            }`}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-800/60">
              <h2 className="text-lg font-semibold text-white">Game Info</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-lg bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-700/60 transition-colors"
              >
                <X className="h-4 w-4 text-neutral-400" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-hidden">
              <GameSidebar
                onToggleDebug={() => setShowDebug((prev) => !prev)}
                isRefreshing={isRefreshing}
                connectionState={connectionState}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}