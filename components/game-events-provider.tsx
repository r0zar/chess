"use client"

import React, { createContext, useContext, type ReactNode, useState, useEffect } from "react"
import usePartySocket from 'partysocket/react'
import { getPartyKitHost } from '@/lib/config'
import { ChessJsAdapter } from '@/lib/chess-logic/game'
import type { FenString, Move, PlayerColor, Square, PieceSymbol } from '@/lib/chess-logic/types'
import { useToast } from '@/hooks/use-toast'
import { useGlobalEvents } from '@/components/global-events-provider'
import { getGameState, makeServerMoveApi, joinGame } from '@/lib/game-actions'
import type { Square as LibSquare } from 'react-chessboard/dist/chessboard/types'

export interface GameEventsContextValue {
    connectionState: 'disconnected' | 'connecting' | 'connected'
    isConnected: boolean
    connect: (gameId: string) => void
    disconnect: () => void
    reconnect: () => void
    send: (data: any) => void
    connectionCount: number
    chessGame: ChessJsAdapter | null
    setChessGame: React.Dispatch<React.SetStateAction<ChessJsAdapter | null>>
    currentFen: FenString | null
    setCurrentFen: React.Dispatch<React.SetStateAction<FenString | null>>
    clientPlayerColor: PlayerColor | undefined
    setClientPlayerColor: React.Dispatch<React.SetStateAction<PlayerColor | undefined>>
    currentTurn: PlayerColor | undefined
    setCurrentTurn: React.Dispatch<React.SetStateAction<PlayerColor | undefined>>
    gameStatus: string
    setGameStatus: React.Dispatch<React.SetStateAction<string>>
    winner: PlayerColor | undefined
    setWinner: React.Dispatch<React.SetStateAction<PlayerColor | undefined>>
    moveHistory: Move[]
    setMoveHistory: React.Dispatch<React.SetStateAction<Move[]>>
    assignedWhiteId: string | null | undefined
    setAssignedWhiteId: React.Dispatch<React.SetStateAction<string | null | undefined>>
    assignedBlackId: string | null | undefined
    setAssignedBlackId: React.Dispatch<React.SetStateAction<string | null | undefined>>
    possibleMoves: Record<string, React.CSSProperties>
    setPossibleMoves: React.Dispatch<React.SetStateAction<Record<string, React.CSSProperties>>>
    selectedSquare: string | null
    setSelectedSquare: React.Dispatch<React.SetStateAction<string | null>>
    isRefreshing: boolean
    setIsRefreshing: React.Dispatch<React.SetStateAction<boolean>>
    showDebug: boolean
    setShowDebug: React.Dispatch<React.SetStateAction<boolean>>
    lastSyncToastAddress: string | undefined
    setLastSyncToastAddress: React.Dispatch<React.SetStateAction<string | undefined>>
    syncGameState: (gameId: string, userId: string, showSyncToast?: boolean) => Promise<void>
    handleServerMoveAndUpdateState: (from: Square, to: Square, promotion?: PieceSymbol) => Promise<boolean>
    onPieceDrop: (sourceSquare: LibSquare, targetSquare: LibSquare) => boolean
    onSquareClick: (square: LibSquare) => void
}

export const GameEventsContext = createContext<GameEventsContextValue | null>(null)

interface GameEventsProviderProps {
    children: ReactNode
    gameId: string
    onGameEvent?: (event: any) => void
}

export default function GameEventsProvider({ children, gameId }: GameEventsProviderProps) {
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [reconnectCount, setReconnectCount] = useState(0)
    const [currentGameId, setCurrentGameId] = useState<string>(gameId)
    const [chessGame, setChessGame] = useState<ChessJsAdapter | null>(null)
    const [currentFen, setCurrentFen] = useState<FenString | null>(null)
    const [clientPlayerColor, setClientPlayerColor] = useState<PlayerColor | undefined>(undefined)
    const [currentTurn, setCurrentTurn] = useState<PlayerColor | undefined>(undefined)
    const [gameStatus, setGameStatus] = useState<string>("")
    const [winner, setWinner] = useState<PlayerColor | undefined>(undefined)
    const [moveHistory, setMoveHistory] = useState<Move[]>([])
    const [assignedWhiteId, setAssignedWhiteId] = useState<string | null | undefined>(undefined)
    const [assignedBlackId, setAssignedBlackId] = useState<string | null | undefined>(undefined)
    const [possibleMoves, setPossibleMoves] = useState<Record<string, React.CSSProperties>>({})
    const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showDebug, setShowDebug] = useState(false)
    const [lastSyncToastAddress, setLastSyncToastAddress] = useState<string | undefined>(undefined)
    const { stxAddress, userUuid } = useGlobalEvents()
    const { toast } = useToast()

    useEffect(() => {
        async function joinAndSync() {
            await joinGame({ gameId: currentGameId, userId: userUuid });
            await syncGameState(currentGameId, userUuid, false);
        }
        if (currentGameId && userUuid) {
            joinAndSync();
        }
    }, [currentGameId, userUuid]);

    function handleGameEvent(event: any) {
        console.log(`[GameEventsProvider] handleGameEvent:`, event)
        // Handle move events for players in the game
        if (event.type === 'move') {
            // Only show toast if the current user is a player in the game
            if (userUuid && (userUuid === assignedWhiteId || userUuid === assignedBlackId)) {
                const moveSan = event.data.move?.san || ''
                const playerId = event.data.playerId || ''
                toast({
                    title: '♟️ Move Played',
                    description: `${moveSan} by ${playerId.substring(0, 6)}...${playerId.slice(-4)}`,
                    duration: 4000
                })
            }
        }
        syncGameState(currentGameId, userUuid, false)
    }

    const gameSocket = usePartySocket({
        host: getPartyKitHost(),
        room: currentGameId,
        onOpen: () => {
            setConnectionState('connected')
            setReconnectCount(0)
        },
        onClose: () => setConnectionState('disconnected'),
        onError: () => setConnectionState('disconnected'),
        onMessage: (event) => {
            try {
                const data = JSON.parse(event.data)
                handleGameEvent(data)
            } catch (error) {
                console.error('[GameEventsProvider] Error parsing game message:', error)
            }
        },
        // Optionally add reconnect logic if needed
    })

    function connect(id: string) {
        setCurrentGameId(id)
        setConnectionState('connecting')
    }

    function disconnect() {
        setCurrentGameId("")
        setConnectionState('disconnected')
    }

    function reconnect() {
        if (currentGameId) {
            setCurrentGameId("")
            setTimeout(() => setCurrentGameId(currentGameId), 0)
            setConnectionState('connecting')
        }
    }

    function send(data: any) {
        if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
            gameSocket.send(JSON.stringify(data))
        } else {
            console.warn('[GameEventsProvider] Cannot send - not connected to game')
        }
    }

    async function syncGameState(gameId: string, userId: string, showSyncToast = true) {
        try {
            const data = await getGameState({ gameId, userId })
            console.log(`[GameEventsProvider] syncGameState data:`, data)
            if ('message' in data) {
                toast({
                    title: "Error",
                    description: data.message,
                    variant: "destructive"
                })
                return
            }
            setChessGame(new ChessJsAdapter(data.fen))
            setCurrentFen(data.fen)
            setClientPlayerColor(data.clientPlayerColor)
            setCurrentTurn(data.currentTurn)
            setGameStatus(data.gameStatus)
            setWinner(data.winner)
            setAssignedWhiteId(data.assignedWhiteId)
            setAssignedBlackId(data.assignedBlackId)
            setMoveHistory(data.moveHistory || [])
            if (showSyncToast && lastSyncToastAddress !== (stxAddress === null ? undefined : stxAddress)) {
                setLastSyncToastAddress(stxAddress === null ? undefined : stxAddress)
                toast({
                    title: "Game State Synced",
                    description: data.clientPlayerColor
                        ? `You are playing as ${data.clientPlayerColor === "w" ? "White" : "Black"}.`
                        : "You are spectating.",
                })
            }
        } catch (error) {
            console.error(`[GameEventsProvider] Error in syncGameState:`, error)
            toast({
                title: "Error Syncing Game",
                description: (error as Error).message,
                variant: "destructive",
            })
        }
    }

    async function handleServerMoveAndUpdateState(from: Square, to: Square, promotion?: PieceSymbol): Promise<boolean> {
        if (isRefreshing) return false
        setIsRefreshing(true)
        try {
            const serverResponse = await makeServerMoveApi({ gameId: currentGameId, from, to, promotion, userId: userUuid })
            if (serverResponse.success && serverResponse.newFen && serverResponse.move) {
                const updatedGame = new ChessJsAdapter(serverResponse.newFen)
                setChessGame(updatedGame)
                setCurrentFen(serverResponse.newFen)
                setCurrentTurn(updatedGame.getTurn())
                setGameStatus(serverResponse.gameStatus || updatedGame.getStatus())
                setWinner(serverResponse.winner)
                setMoveHistory((prevHistory) => [...prevHistory, serverResponse.move!])
                setPossibleMoves({})
                setSelectedSquare(null)
                return true
            } else {
                toast({
                    title: "Move Rejected",
                    description: serverResponse.message || "The server did not allow this move.",
                    variant: "destructive",
                })
                await syncGameState(currentGameId, userUuid, false)
                return false
            }
        } catch (error) {
            toast({ title: "Move Error", description: (error as Error).message, variant: "destructive" })
            await syncGameState(currentGameId, userUuid, false)
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
        let promotionPiece: PieceSymbol | undefined = undefined
        const pieceDetail = chessGame.getPieceAt(from)
        if (pieceDetail?.type === "p") {
            if ((pieceDetail.color === "w" && to[1] === "8") || (pieceDetail.color === "b" && to[1] === "1")) {
                promotionPiece = "q"
                toast({
                    title: "Pawn Promotion",
                    description: "Promoted to Queen. UI for selection is pending.",
                })
            }
        }
        const tempGame = new ChessJsAdapter(currentFen ?? undefined)
        const localMoveResult = tempGame.makeMove({ from, to, promotion: promotionPiece })
        if (localMoveResult === null) {
            return false
        }
        handleServerMoveAndUpdateState(from, to, promotionPiece)
        return true
    }

    function onSquareClick(square: LibSquare) {
        if (!chessGame || isRefreshing) return
        const gameIsEffectivelyOver = chessGame.isGameOver() || (gameStatus !== "ongoing" && gameStatus !== "pending")
        if (currentTurn !== clientPlayerColor || !clientPlayerColor || gameIsEffectivelyOver) {
            setSelectedSquare(null)
            setPossibleMoves({})
            return
        }
        const sq = square as Square
        if (!selectedSquare) {
            const pieceDetail = chessGame.getPieceAt(sq)
            if (pieceDetail && pieceDetail.color === currentTurn) {
                setSelectedSquare(sq as Square)
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
            }
        } else {
            if (sq === selectedSquare) {
                setSelectedSquare(null)
                setPossibleMoves({})
                return
            }
            const currentPossibleTos = Object.keys(possibleMoves).filter((s) => s !== (selectedSquare ?? undefined)) as Square[]
            if (currentPossibleTos.includes(sq)) {
                let promotionPiece: PieceSymbol | undefined = undefined
                const pieceDetail = chessGame.getPieceAt(selectedSquare as Square)
                if (pieceDetail?.type === "p") {
                    if ((pieceDetail.color === "w" && sq[1] === "8") || (pieceDetail.color === "b" && sq[1] === "1")) {
                        promotionPiece = "q"
                        toast({
                            title: "Pawn Promotion",
                            description: "Promoted to Queen. UI for selection is pending.",
                        })
                    }
                }
                if (selectedSquare && sq) {
                    handleServerMoveAndUpdateState(selectedSquare as Square, sq as Square, promotionPiece)
                }
            } else {
                const pieceDetail = chessGame.getPieceAt(sq)
                if (pieceDetail && pieceDetail.color === currentTurn) {
                    setSelectedSquare(sq as Square)
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
                    setSelectedSquare(null)
                    setPossibleMoves({})
                }
            }
        }
    }

    const contextValue: GameEventsContextValue = {
        connectionState,
        isConnected: connectionState === 'connected' && !!gameSocket && gameSocket.readyState === WebSocket.OPEN,
        connect,
        disconnect,
        reconnect,
        send,
        connectionCount: reconnectCount,
        chessGame,
        setChessGame,
        currentFen,
        setCurrentFen,
        clientPlayerColor,
        setClientPlayerColor,
        currentTurn,
        setCurrentTurn,
        gameStatus,
        setGameStatus,
        winner,
        setWinner,
        moveHistory,
        setMoveHistory,
        assignedWhiteId,
        setAssignedWhiteId,
        assignedBlackId,
        setAssignedBlackId,
        possibleMoves,
        setPossibleMoves,
        selectedSquare,
        setSelectedSquare,
        isRefreshing,
        setIsRefreshing,
        showDebug,
        setShowDebug,
        lastSyncToastAddress,
        setLastSyncToastAddress,
        syncGameState,
        handleServerMoveAndUpdateState,
        onPieceDrop,
        onSquareClick,
    }

    return (
        <GameEventsContext.Provider value={contextValue}>
            {children}
        </GameEventsContext.Provider>
    )
}

export function useGameEvents() {
    const context = useContext(GameEventsContext)
    if (!context) {
        throw new Error('useGameEvents must be used within a GameEventsProvider')
    }
    return context
} 