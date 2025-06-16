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
            const joinResult = await joinGame({ gameId: currentGameId, userId: userUuid });

            // Show welcome bonus notification if received
            if (joinResult.welcomeBonus && stxAddress) {
                toast({
                    title: `🎮 ${joinResult.welcomeBonus.amount} EXP Welcome Bonus!`,
                    description: `Thanks for joining! Reward: ${joinResult.welcomeBonus.reason}`,
                    duration: 5000
                })
            }

            await syncGameState(currentGameId, userUuid, false);
        }
        if (currentGameId && userUuid) {
            joinAndSync();
        }
    }, [currentGameId, userUuid, stxAddress, toast]);

    // Enhanced piece type names for better UX
    const getPieceDisplayName = (piece: PieceSymbol): string => {
        const names: Record<PieceSymbol, string> = {
            'p': 'Pawn',
            'n': 'Knight',
            'b': 'Bishop',
            'r': 'Rook',
            'q': 'Queen',
            'k': 'King'
        }
        return names[piece] || piece.toUpperCase()
    }

    // Enhanced move descriptions
    const getMoveDescription = (move: Move, isCapture: boolean, isPromotion: boolean): string => {
        const pieceName = getPieceDisplayName(move.piece)
        let description = `${pieceName} ${move.from} → ${move.to}`

        if (isCapture && move.captured) {
            description += ` captures ${getPieceDisplayName(move.captured)}`
        }
        if (isPromotion && move.promotion) {
            description += ` promotes to ${getPieceDisplayName(move.promotion)}`
        }

        return description
    }

    function handleGameEvent(event: any) {
        console.log(`[GameEventsProvider] handleGameEvent:`, event)

        if (event.type === 'move') {
            const move = event.data.move
            const playerId = event.data.playerId || ''
            const isCapture = !!move?.captured
            const isPromotion = !!move?.promotion

            // Enhanced move notification for players
            if (userUuid && (userUuid === assignedWhiteId || userUuid === assignedBlackId)) {
                const moveDescription = move ? getMoveDescription(move, isCapture, isPromotion) : 'Move played'
                const playerName = `${playerId.substring(0, 6)}...${playerId.slice(-4)}`

                // Different toast styles based on move type
                let title = '♟️ Move Played'
                let description = `${moveDescription} by ${playerName}`

                if (isCapture && isPromotion) {
                    title = '👑⚔️ Capture & Promotion!'
                    description = `${moveDescription} by ${playerName}`
                } else if (isCapture) {
                    title = '⚔️ Piece Captured!'
                    description = `${moveDescription} by ${playerName}`
                } else if (isPromotion) {
                    title = '👑 Pawn Promoted!'
                    description = `${moveDescription} by ${playerName}`
                } else if (move?.piece === 'k') {
                    title = '👑 King Moves!'
                    description = `${moveDescription} by ${playerName}`
                }

                toast({
                    title,
                    description,
                    duration: 4500
                })
            }

            // Enhanced EXP reward notification
            if (userUuid && stxAddress && event.data.playerId === userUuid) {
                let expTitle = '✨ 10 EXP Earned!'
                let expDescription = 'Strategic thinking rewarded!'

                if (isCapture && isPromotion) {
                    expTitle = '🚀 15 EXP Bonus!'
                    expDescription = 'Capture + Promotion combo!'
                } else if (isCapture) {
                    expTitle = '⚡ 12 EXP Earned!'
                    expDescription = 'Tactical capture executed!'
                } else if (isPromotion) {
                    expTitle = '👑 15 EXP Earned!'
                    expDescription = 'Pawn promotion achieved!'
                }

                toast({
                    title: expTitle,
                    description: expDescription,
                    duration: 6000
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
                    title: "⚠️ Sync Error",
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
                const roleIcon = data.clientPlayerColor === "w" ? "⚪" : data.clientPlayerColor === "b" ? "⚫" : "👀"
                const roleText = data.clientPlayerColor
                    ? `Playing as ${data.clientPlayerColor === "w" ? "White" : "Black"}`
                    : "Spectating"

                toast({
                    title: `${roleIcon} Game Ready!`,
                    description: `${roleText} • State synchronized`,
                    duration: 4000
                })
            }
        } catch (error) {
            console.error(`[GameEventsProvider] Error in syncGameState:`, error)
            toast({
                title: "🔄 Sync Failed",
                description: "Failed to synchronize game state",
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

                // Enhanced success feedback
                const move = serverResponse.move
                const isCapture = !!move.captured
                const isPromotion = !!move.promotion

                let successTitle = '✅ Move Executed!'
                if (isCapture && isPromotion) {
                    successTitle = '🎯 Epic Combo!'
                } else if (isCapture) {
                    successTitle = '⚔️ Capture Success!'
                } else if (isPromotion) {
                    successTitle = '👑 Promotion Complete!'
                }

                // Brief success indication (no description to keep it clean)
                toast({
                    title: successTitle,
                    duration: 2500
                })

                return true
            } else {
                // Enhanced error feedback
                toast({
                    title: "❌ Invalid Move",
                    description: serverResponse.message || "That move is not allowed",
                    variant: "destructive",
                })
                await syncGameState(currentGameId, userUuid, false)
                return false
            }
        } catch (error) {
            toast({
                title: "🚫 Move Failed",
                description: "Connection error - please try again",
                variant: "destructive"
            })
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
                    title: "👑 Pawn Promotion!",
                    description: "Your pawn has been promoted to Queen",
                    duration: 4000
                })
            }
        }

        const tempGame = new ChessJsAdapter(currentFen ?? undefined)
        const localMoveResult = tempGame.makeMove({ from, to, promotion: promotionPiece })

        if (localMoveResult === null) {
            // Enhanced invalid move feedback
            toast({
                title: "🚫 Invalid Move",
                description: "That piece cannot move there",
                variant: "destructive",
                duration: 2000
            })
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
            // Selecting a piece
            const pieceDetail = chessGame.getPieceAt(sq)
            if (pieceDetail && pieceDetail.color === currentTurn) {
                setSelectedSquare(sq as Square)
                const moves = chessGame.getPossibleMoves(sq)
                const newPossibleMoves: Record<string, React.CSSProperties> = {}

                moves.forEach((m) => {
                    const isCapture = !!m.captured
                    const isSpecialMove = isCapture || !!m.promotion

                    newPossibleMoves[m.to] = {
                        background: isCapture
                            ? "radial-gradient(circle, rgba(239, 68, 68, 0.6) 15%, rgba(239, 68, 68, 0.2) 30%, transparent 70%)"
                            : "radial-gradient(circle, rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0.15) 30%, transparent 70%)",
                        boxShadow: isSpecialMove
                            ? "inset 0 0 0 3px rgba(251, 191, 36, 0.6), 0 0 8px rgba(251, 191, 36, 0.4)"
                            : "inset 0 0 0 2px rgba(34, 197, 94, 0.4)",
                        borderRadius: "8px",
                        transition: "all 0.2s ease-in-out",
                    }
                })

                // Enhanced selected square styling
                newPossibleMoves[sq] = {
                    background: "linear-gradient(135deg, rgba(251, 191, 36, 0.4) 0%, rgba(245, 158, 11, 0.6) 100%)",
                    boxShadow: "inset 0 0 0 3px rgba(251, 191, 36, 0.8), 0 0 12px rgba(251, 191, 36, 0.5)",
                    borderRadius: "8px",
                    transform: "scale(1.02)",
                    transition: "all 0.2s ease-in-out",
                }
                setPossibleMoves(newPossibleMoves)
            }
        } else {
            // Square already selected
            if (sq === selectedSquare) {
                // Deselecting
                setSelectedSquare(null)
                setPossibleMoves({})
                return
            }

            const currentPossibleTos = Object.keys(possibleMoves).filter((s) => s !== (selectedSquare ?? undefined)) as Square[]

            if (currentPossibleTos.includes(sq)) {
                // Making a move
                let promotionPiece: PieceSymbol | undefined = undefined
                const pieceDetail = chessGame.getPieceAt(selectedSquare as Square)

                if (pieceDetail?.type === "p") {
                    if ((pieceDetail.color === "w" && sq[1] === "8") || (pieceDetail.color === "b" && sq[1] === "1")) {
                        promotionPiece = "q"
                        toast({
                            title: "👑 Pawn Promotion!",
                            description: "Your pawn has been promoted to Queen",
                            duration: 4000
                        })
                    }
                }

                if (selectedSquare && sq) {
                    handleServerMoveAndUpdateState(selectedSquare as Square, sq as Square, promotionPiece)
                }
            } else {
                // Selecting a different piece
                const pieceDetail = chessGame.getPieceAt(sq)
                if (pieceDetail && pieceDetail.color === currentTurn) {
                    setSelectedSquare(sq as Square)
                    const moves = chessGame.getPossibleMoves(sq)
                    const newPossibleMoves: Record<string, React.CSSProperties> = {}

                    moves.forEach((m) => {
                        const isCapture = !!m.captured
                        const isSpecialMove = isCapture || !!m.promotion

                        newPossibleMoves[m.to] = {
                            background: isCapture
                                ? "radial-gradient(circle, rgba(239, 68, 68, 0.6) 15%, rgba(239, 68, 68, 0.2) 30%, transparent 70%)"
                                : "radial-gradient(circle, rgba(34, 197, 94, 0.5) 15%, rgba(34, 197, 94, 0.15) 30%, transparent 70%)",
                            boxShadow: isSpecialMove
                                ? "inset 0 0 0 3px rgba(251, 191, 36, 0.6), 0 0 8px rgba(251, 191, 36, 0.4)"
                                : "inset 0 0 0 2px rgba(34, 197, 94, 0.4)",
                            borderRadius: "8px",
                            transition: "all 0.2s ease-in-out",
                        }
                    })

                    newPossibleMoves[sq] = {
                        background: "linear-gradient(135deg, rgba(251, 191, 36, 0.4) 0%, rgba(245, 158, 11, 0.6) 100%)",
                        boxShadow: "inset 0 0 0 3px rgba(251, 191, 36, 0.8), 0 0 12px rgba(251, 191, 36, 0.5)",
                        borderRadius: "8px",
                        transform: "scale(1.02)",
                        transition: "all 0.2s ease-in-out",
                    }
                    setPossibleMoves(newPossibleMoves)
                } else {
                    // Clicked empty square or opponent piece - deselect
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