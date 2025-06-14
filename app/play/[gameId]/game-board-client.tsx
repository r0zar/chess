"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import type { Square as LibSquare } from "react-chessboard/dist/chessboard/types"
import { ChessJsAdapter } from "@/lib/chess-logic/game"
import type { FenString, Square, Move, PlayerColor, PieceSymbol as LocalPieceSymbol } from "@/lib/chess-logic/types"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { getOrCreateSessionId } from "@/lib/session"
import { useUnifiedEvents } from "@/hooks/useUnifiedEvents"
import type { UnifiedEvent } from "@/lib/unified-connection-manager"
import Auth from "@/components/auth"
import Link from "next/link"
import { ArrowLeft, Bug } from "lucide-react"
import GameSidebar from "./game-sidebar"

const Chessboard = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard), {
  ssr: false,
  loading: () => (
    <div style={{ aspectRatio: "1 / 1" }} className="w-full bg-slate-700 animate-pulse rounded-md shadow-lg"></div>
  ),
})

async function identifyPlayerApi(
  gameId: string,
  stxAddress?: string,
): Promise<{
  fen: FenString
  clientPlayerColor?: PlayerColor
  currentTurn: PlayerColor
  gameStatus: string
  winner?: PlayerColor
  assignedWhiteId?: string | null
  assignedBlackId?: string | null
  assignedWhiteAddress?: string | null
  assignedBlackAddress?: string | null
  moveHistory: Move[]
}> {
  console.log(`[identifyPlayerApi] Fetching for gameId: ${gameId}, stxAddress: ${stxAddress}`)
  const response = await fetch(`/api/game/${gameId}/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stxAddress ? JSON.stringify({ stxAddress }) : JSON.stringify({}), // Send empty JSON object if no stxAddress
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Failed to identify player (unparseable error)" }))
    console.error(`[identifyPlayerApi] Error response: ${response.status}`, errorData)
    throw new Error(errorData.message || `Failed to identify player (${response.status})`)
  }
  const data = await response.json()
  console.log(`[identifyPlayerApi] Success response for gameId ${gameId}:`, {
    fen: data.fen,
    moveHistoryLength: data.moveHistory?.length,
  })
  return data
}

async function makeServerMoveApi(
  gameId: string,
  from: Square,
  to: Square,
  promotion?: LocalPieceSymbol,
): Promise<{
  success: boolean
  newFen?: FenString
  message?: string
  gameStatus?: string
  winner?: PlayerColor
  move?: Move
}> {
  const response = await fetch(`/api/game/${gameId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, promotion }),
  })
  return response.json()
}

interface GameBoardClientProps {
  gameId: string
  publicInitialGameState: {
    fen: FenString
    gameStatus: string
    winner?: PlayerColor
    playerWhiteId?: string | null
    playerBlackId?: string | null
    playerWhiteAddress?: string | null
    playerBlackAddress?: string | null
  }
}

export default function GameBoardClient({ gameId, publicInitialGameState }: GameBoardClientProps) {
  const [chessGame, setChessGame] = useState<ChessJsAdapter | null>(
    () => new ChessJsAdapter(publicInitialGameState.fen),
  )
  const [currentFen, setCurrentFen] = useState<FenString>(publicInitialGameState.fen)
  const [stxAddress, setStxAddress] = useState<string | null>(null)
  const [clientPlayerColor, setClientPlayerColor] = useState<PlayerColor | undefined>(undefined)
  const [currentTurn, setCurrentTurn] = useState<PlayerColor>(() =>
    new ChessJsAdapter(publicInitialGameState.fen).getTurn(),
  )
  const [possibleMoves, setPossibleMoves] = useState<Record<string, React.CSSProperties>>({})
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [gameStatus, setGameStatus] = useState<string>(publicInitialGameState.gameStatus)
  const [winner, setWinner] = useState<PlayerColor | undefined>(publicInitialGameState.winner)
  const [assignedWhiteId, setAssignedWhiteId] = useState<string | null | undefined>(
    publicInitialGameState.playerWhiteId,
  )
  const [assignedBlackId, setAssignedBlackId] = useState<string | null | undefined>(
    publicInitialGameState.playerBlackId,
  )
  const [whitePlayerDisplayAddress, setWhitePlayerDisplayAddress] = useState<string | null | undefined>(
    publicInitialGameState.playerWhiteAddress,
  )
  const [blackPlayerDisplayAddress, setBlackPlayerDisplayAddress] = useState<string | null | undefined>(
    publicInitialGameState.playerBlackAddress,
  )
  const [moveHistory, setMoveHistory] = useState<Move[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()
  const [boardWidth, setBoardWidth] = useState(500)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  const [lastSyncToastAddress, setLastSyncToastAddress] = useState<string | null | undefined>(undefined)
  const [clientUserId, setClientUserId] = useState<string | null>(null)

  console.log(
    `[GameBoardClient ${gameId}] Component RENDER. moveHistory length: ${moveHistory.length}. Fen: ${currentFen}`,
  )

  const updateBoardWidth = useCallback(() => {
    if (mainContentRef.current) {
      const { width, height } = mainContentRef.current.getBoundingClientRect()
      const size = Math.min(width * 0.9, height * 0.8)
      setBoardWidth(Math.max(280, size))
    }
  }, [])

  useEffect(() => {
    updateBoardWidth()
    window.addEventListener("resize", updateBoardWidth)
    return () => window.removeEventListener("resize", updateBoardWidth)
  }, [updateBoardWidth])

  const syncGameState = useCallback(
    async (currentStxAddress?: string | null, showSyncToast = true) => {
      if (isRefreshing) {
        console.log(`[GameBoardClient ${gameId}] syncGameState SKIPPED - already refreshing.`)
        return
      }
      setIsRefreshing(true)
      console.log(`[GameBoardClient ${gameId}] syncGameState CALLED. STX Address: ${currentStxAddress}`)
      try {
        const data = await identifyPlayerApi(gameId, currentStxAddress || undefined)

        setChessGame(new ChessJsAdapter(data.fen))
        setCurrentFen(data.fen)
        setClientPlayerColor(data.clientPlayerColor)
        setCurrentTurn(data.currentTurn)
        setGameStatus(data.gameStatus)
        setWinner(data.winner)
        setAssignedWhiteId(data.assignedWhiteId)
        setAssignedBlackId(data.assignedBlackId)
        setWhitePlayerDisplayAddress(data.assignedWhiteAddress)
        setBlackPlayerDisplayAddress(data.assignedBlackAddress)

        setMoveHistory(data.moveHistory || [])

        // Set client user ID based on player color
        const newClientUserId = data.clientPlayerColor === 'w' ? data.assignedWhiteId :
          data.clientPlayerColor === 'b' ? data.assignedBlackId : null
        setClientUserId(newClientUserId || null)

        console.log(
          `[GameBoardClient ${gameId}] syncGameState SUCCESS. moveHistory SET to length: ${data.moveHistory?.length || 0}. First move SAN: ${data.moveHistory?.[0]?.san}. Client user ID: ${newClientUserId}`,
        )

        if (showSyncToast && lastSyncToastAddress !== currentStxAddress) {
          setLastSyncToastAddress(currentStxAddress)
          toast({
            title: "Game State Synced",
            description: data.clientPlayerColor
              ? `You are playing as ${data.clientPlayerColor === "w" ? "White" : "Black"}.`
              : "You are spectating.",
          })
        }
      } catch (error) {
        console.error(`[GameBoardClient ${gameId}] Error in syncGameState:`, error)
        toast({
          title: "Error Syncing Game",
          description: (error as Error).message,
          variant: "destructive",
        })
      } finally {
        setIsRefreshing(false)
        console.log(`[GameBoardClient ${gameId}] syncGameState FINISHED.`)
      }
    },
    [gameId, toast, isRefreshing, lastSyncToastAddress], // Added state dependencies
  )

  // Handle real-time game events
  const handleGameEvent = useCallback((event: UnifiedEvent) => {
    console.log(`[GameBoardClient ${gameId}] *** HANDLING GAME EVENT ***`)
    console.log(`[GameBoardClient ${gameId}] Event type: ${event.type}`)
    console.log(`[GameBoardClient ${gameId}] Event data:`, event.data)
    console.log(`[GameBoardClient ${gameId}] Current clientUserId: ${clientUserId}`)

    switch (event.type) {
      case 'move':
        console.log(`[GameBoardClient ${gameId}] *** PROCESSING MOVE EVENT ***`)
        console.log(`[GameBoardClient ${gameId}] Move event playerId: ${event.data.playerId}`)
        console.log(`[GameBoardClient ${gameId}] Current clientUserId: ${clientUserId}`)
        console.log(`[GameBoardClient ${gameId}] Player IDs match (should skip): ${event.data.playerId === clientUserId}`)

        // Only update if this move came from another player
        if (event.data.playerId !== clientUserId) {
          const { move, gameState } = event.data

          console.log(`[GameBoardClient ${gameId}] *** APPLYING OPPONENT MOVE ***`)
          console.log(`[GameBoardClient ${gameId}] Move:`, move)
          console.log(`[GameBoardClient ${gameId}] New game state:`, gameState)
          console.log(`[GameBoardClient ${gameId}] Current FEN before update: ${currentFen}`)
          console.log(`[GameBoardClient ${gameId}] New FEN: ${gameState.fen}`)

          // Update game state
          const updatedGame = new ChessJsAdapter(gameState.fen)
          setChessGame(updatedGame)
          setCurrentFen(gameState.fen)
          setCurrentTurn(gameState.turn)
          setGameStatus(gameState.status)
          setWinner(gameState.winner)

          // Add move to history
          setMoveHistory(prev => {
            const newHistory = [...prev, move]
            console.log(`[GameBoardClient ${gameId}] Updated move history length: ${newHistory.length}`)
            return newHistory
          })

          // Clear any selection
          setPossibleMoves({})
          setSelectedSquare(null)

          console.log(`[GameBoardClient ${gameId}] *** OPPONENT MOVE APPLIED SUCCESSFULLY ***`)
          console.log(`[GameBoardClient ${gameId}] Showing toast for move: ${move.san}`)

          // Show notification
          toast({
            title: "Opponent Moved",
            description: `${move.san}`,
            duration: 3000,
          })
        } else {
          console.log(`[GameBoardClient ${gameId}] *** IGNORING OWN MOVE EVENT ***`)
          console.log(`[GameBoardClient ${gameId}] Move SAN: ${event.data.move?.san}`)
        }
        break

      case 'player_joined':
        console.log(`[GameBoardClient ${gameId}] Player joined:`, event.data)
        // Sync game state to get updated player info
        syncGameState(stxAddress, false)
        toast({
          title: "Player Joined",
          description: `${event.data.playerColor === 'w' ? 'White' : 'Black'} player joined the game`,
          duration: 3000,
        })
        break

      case 'player_disconnected':
        console.log(`[GameBoardClient ${gameId}] Player disconnected:`, event.data)
        toast({
          title: "Player Disconnected",
          description: `${event.data.playerColor === 'w' ? 'White' : 'Black'} player disconnected`,
          duration: 3000,
        })
        break

      case 'game_ended':
        console.log(`[GameBoardClient ${gameId}] Game ended:`, event.data)
        setGameStatus(event.data.status)
        setWinner(event.data.winner)
        toast({
          title: "Game Ended",
          description: event.data.reason,
          duration: 5000,
        })
        break

      case 'sync_required':
        console.log(`[GameBoardClient ${gameId}] Sync required:`, event.data.reason)
        syncGameState(stxAddress, false)
        break

      default:
        console.log(`[GameBoardClient ${gameId}] Unhandled event type:`, event.type)
    }
  }, [gameId, clientUserId, toast, syncGameState])

  // Set up SSE connection
  const { isConnected, reconnect, connectionState } = useUnifiedEvents(handleGameEvent, {
    gameId,
    enabled: true,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5
  })

  // Update connection status - now reactive to connectionState changes
  useEffect(() => {
    setSseConnected(isConnected())
  }, [isConnected, connectionState])

  // Initial game state sync
  useEffect(() => {
    console.log(
      `[GameBoardClient ${gameId}] Initial useEffect for syncGameState. Current stxAddress state: ${stxAddress}`,
    )
    // Pass the current stxAddress state, which might be null initially
    syncGameState(stxAddress, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]) // Only run on gameId change for initial load. syncGameState is memoized.

  const handleConnect = useCallback(
    (newAddress: string) => {
      console.log(`[GameBoardClient ${gameId}] Wallet CONNECTED: ${newAddress}. Calling syncGameState.`)
      setStxAddress(newAddress)
      syncGameState(newAddress, true)
    },
    [gameId, syncGameState],
  ) // syncGameState is stable due to its own useCallback

  const handleDisconnect = useCallback(() => {
    console.log(`[GameBoardClient ${gameId}] Wallet DISCONNECTED. Calling syncGameState.`)
    setStxAddress(null)
    syncGameState(null, true)
    toast({ title: "Wallet Disconnected", description: "You are now playing as a guest." })
  }, [gameId, syncGameState]) // syncGameState is stable

  const handleServerMoveAndUpdateState = async (
    from: Square,
    to: Square,
    promotion?: LocalPieceSymbol,
  ): Promise<boolean> => {
    if (isRefreshing) {
      console.log(`[GameBoardClient ${gameId}] handleServerMoveAndUpdateState SKIPPED - currently refreshing/syncing.`)
      return false
    }
    setIsRefreshing(true)
    console.log(`[GameBoardClient ${gameId}] handleServerMoveAndUpdateState: ${from}-${to}`)
    try {
      const serverResponse = await makeServerMoveApi(gameId, from, to, promotion)
      console.log(`[GameBoardClient ${gameId}] API response from /move:`, serverResponse)

      if (serverResponse.success && serverResponse.newFen && serverResponse.move) {
        const updatedGame = new ChessJsAdapter(serverResponse.newFen)
        setChessGame(updatedGame)
        setCurrentFen(serverResponse.newFen)
        setCurrentTurn(updatedGame.getTurn())
        setGameStatus(serverResponse.gameStatus || updatedGame.getStatus())
        setWinner(serverResponse.winner)

        setMoveHistory((prevHistory) => {
          const newHistory = [...prevHistory, serverResponse.move!]
          console.log(
            `[GameBoardClient ${gameId}] moveHistory updated after move. New length: ${newHistory.length}. Last move SAN: ${serverResponse.move?.san}`,
          )
          return newHistory
        })

        setPossibleMoves({})
        setSelectedSquare(null)
        toast({ title: "Move Successful", description: `Moved ${from} to ${to}.` })
        return true
      } else {
        toast({
          title: "Move Rejected",
          description: serverResponse.message || "The server did not allow this move.",
          variant: "destructive",
        })
        // If move rejected, re-sync state to be sure
        syncGameState(stxAddress, false)
        return false
      }
    } catch (error) {
      console.error(`[GameBoardClient ${gameId}] Error in handleServerMoveAndUpdateState:`, error)
      toast({ title: "Move Error", description: (error as Error).message, variant: "destructive" })
      syncGameState(stxAddress, false) // Re-sync on error
      return false
    } finally {
      setIsRefreshing(false)
    }
  }

  function onPieceDrop(sourceSquare: LibSquare, targetSquare: LibSquare): boolean {
    if (!chessGame) return false
    const gameIsEffectivelyOver = chessGame.isGameOver() || (gameStatus !== "ongoing" && gameStatus !== "pending")

    if (currentTurn !== clientPlayerColor || !clientPlayerColor || gameIsEffectivelyOver) {
      return false
    }

    const from = sourceSquare as Square
    const to = targetSquare as Square
    let promotionPiece: LocalPieceSymbol | undefined = undefined
    const pieceDetail = chessGame.getPieceAt(from)
    if (pieceDetail?.type === "p") {
      if ((pieceDetail.color === "w" && to[1] === "8") || (pieceDetail.color === "b" && to[1] === "1")) {
        promotionPiece = "q" // Default to Queen
        toast({
          title: "Pawn Promotion",
          description: "Promoted to Queen. UI for selection is pending.",
        })
      }
    }

    // Optimistic local update for chess.js instance to check validity
    const tempGame = new ChessJsAdapter(currentFen)
    const localMoveResult = tempGame.makeMove({ from, to, promotion: promotionPiece })

    if (localMoveResult === null) {
      console.log(`[GameBoardClient ${gameId}] Optimistic local move validation FAILED for ${from}-${to}`)
      return false // Move is illegal by local rules
    }
    console.log(
      `[GameBoardClient ${gameId}] Optimistic local move validation SUCCEEDED for ${from}-${to}. Proceeding with server move.`,
    )

    // Proceed with server move
    handleServerMoveAndUpdateState(from, to, promotionPiece)
    return true // react-chessboard expects true if the move attempt is being handled
  }

  function onSquareClick(square: LibSquare) {
    if (!chessGame || isRefreshing) return // Prevent actions while syncing
    const gameIsEffectivelyOver = chessGame.isGameOver() || (gameStatus !== "ongoing" && gameStatus !== "pending")

    if (currentTurn !== clientPlayerColor || !clientPlayerColor || gameIsEffectivelyOver) {
      setSelectedSquare(null)
      setPossibleMoves({})
      return
    }

    const sq = square as Square

    if (!selectedSquare) {
      // First click - select a piece
      const pieceDetail = chessGame.getPieceAt(sq)
      if (pieceDetail && pieceDetail.color === currentTurn) {
        setSelectedSquare(sq)
        const moves = chessGame.getPossibleMoves(sq)
        const newPossibleMoves: Record<string, React.CSSProperties> = {}
        moves.forEach((m) => {
          newPossibleMoves[m.to] = {
            background: m.captured
              ? "radial-gradient(circle, rgba(239, 68, 68, 0.4) 25%, transparent 30%)"
              : "radial-gradient(circle, rgba(59, 130, 246, 0.3) 25%, transparent 30%)",
          }
        })
        newPossibleMoves[sq] = { background: "rgba(250, 204, 21, 0.5)" } // Highlight selected square
        setPossibleMoves(newPossibleMoves)
      }
    } else {
      // Second click - attempt to move or re-select
      if (sq === selectedSquare) {
        // Clicked the same square again
        setSelectedSquare(null)
        setPossibleMoves({})
        return
      }

      const currentPossibleTos = Object.keys(possibleMoves).filter((s) => s !== selectedSquare) as Square[]
      if (currentPossibleTos.includes(sq)) {
        // Clicked a valid destination square
        let promotionPiece: LocalPieceSymbol | undefined = undefined
        const pieceDetail = chessGame.getPieceAt(selectedSquare)
        if (pieceDetail?.type === "p") {
          if ((pieceDetail.color === "w" && sq[1] === "8") || (pieceDetail.color === "b" && sq[1] === "1")) {
            promotionPiece = "q" // Default to Queen
            toast({
              title: "Pawn Promotion",
              description: "Promoted to Queen. UI for selection is pending.",
            })
          }
        }
        handleServerMoveAndUpdateState(selectedSquare, sq, promotionPiece)
        // State like selectedSquare and possibleMoves will be cleared by handleServerMoveAndUpdateState on success
      } else {
        // Clicked an invalid square or another piece of the same color
        const pieceDetail = chessGame.getPieceAt(sq)
        if (pieceDetail && pieceDetail.color === currentTurn) {
          // Clicked another of own pieces
          setSelectedSquare(sq) // Re-select
          const moves = chessGame.getPossibleMoves(sq)
          const newPossibleMoves: Record<string, React.CSSProperties> = {}
          moves.forEach((m) => {
            newPossibleMoves[m.to] = {
              background: m.captured
                ? "radial-gradient(circle, rgba(239, 68, 68, 0.4) 25%, transparent 30%)"
                : "radial-gradient(circle, rgba(59, 130, 246, 0.3) 25%, transparent 30%)",
            }
          })
          newPossibleMoves[sq] = { background: "rgba(250, 204, 21, 0.5)" }
          setPossibleMoves(newPossibleMoves)
        } else {
          // Clicked an empty square not in possible moves, or opponent's piece
          setSelectedSquare(null)
          setPossibleMoves({})
        }
      }
    }
  }

  const getPlayerDisplay = (stxAddr: string | null | undefined, userId: string | null | undefined): string => {
    if (stxAddr) return `${stxAddr.substring(0, 6)}...${stxAddr.substring(stxAddr.length - 4)}`
    if (userId) return `User ${userId.substring(0, 4)}...`
    return "Open Slot"
  }

  const whitePlayerDisplay = getPlayerDisplay(whitePlayerDisplayAddress, assignedWhiteId)
  const blackPlayerDisplay = getPlayerDisplay(blackPlayerDisplayAddress, assignedBlackId)
  const playerRole = clientPlayerColor ? `Playing as ${clientPlayerColor === "w" ? "White" : "Black"}` : "Spectating"
  const isMyTurn =
    gameStatus === "ongoing" &&
    currentTurn === clientPlayerColor &&
    !!clientPlayerColor &&
    !chessGame?.isGameOver() &&
    !isRefreshing

  // Log moveHistory just before passing to sidebar
  useEffect(() => {
    console.log(
      `[GameBoardClient ${gameId}] useEffect LOG before passing to sidebar. moveHistory length: ${moveHistory.length}. First move SAN: ${moveHistory?.[0]?.san}`,
    )
  }, [moveHistory, gameId])

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
              <Auth onConnect={handleConnect} onDisconnect={handleDisconnect} />
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
                position={currentFen}
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
        gameId={gameId}
        gameStatus={gameStatus}
        currentTurn={currentTurn}
        winner={winner}
        whitePlayerDisplay={whitePlayerDisplay}
        blackPlayerDisplay={blackPlayerDisplay}
        moveHistory={moveHistory}
        yourRole={playerRole}
        isYourTurn={isMyTurn}
        showDebug={showDebug}
        onToggleDebug={() => setShowDebug((prev) => !prev)}
        isRefreshing={isRefreshing}
        onRefresh={() => {
          console.log(`[GameBoardClient ${gameId}] Manual refresh clicked. Calling syncGameState.`)
          setLastSyncToastAddress(undefined) // Reset to allow refresh toast
          syncGameState(stxAddress, true)
        }}
        connectionState={connectionState}
      />
    </div>
  )
}
