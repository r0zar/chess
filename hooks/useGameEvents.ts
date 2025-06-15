import { useEffect, useRef, useCallback, useState } from 'react'
import PartySocket from 'partysocket'

interface UseGameEventsOptions {
    enabled?: boolean
    reconnectDelay?: number
    maxReconnectAttempts?: number
}

export function useGameEvents(
    gameId: string,
    onGameEvent: (event: any) => void,
    options: UseGameEventsOptions = {}
) {
    const {
        enabled = true,
        reconnectDelay = 3000,
        maxReconnectAttempts = 5
    } = options

    const socketRef = useRef<PartySocket | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const reconnectAttemptsRef = useRef(0)
    const isConnectedRef = useRef(false)
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

    const cleanup = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close()
            socketRef.current = null
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = undefined
        }
        isConnectedRef.current = false
        setConnectionState('disconnected')
    }, [])

    const connect = useCallback(() => {
        if (!enabled || !gameId) return
        cleanup()
        setConnectionState('connecting')
        const partyKitHost =
            typeof window !== 'undefined' && window.location.hostname !== 'localhost'
                ? 'chess-game.r0zar.partykit.dev'
                : 'localhost:1999'
        const socket = new PartySocket({
            host: partyKitHost,
            room: gameId,
        })
        socket.onopen = () => {
            isConnectedRef.current = true
            reconnectAttemptsRef.current = 0
            setConnectionState('connected')
        }
        socket.onmessage = (event) => {
            try {
                const eventData = JSON.parse(event.data)
                if (eventData.type === 'connected') return
                onGameEvent(eventData)
            } catch (error) {
                console.error('[useGameEvents] Error parsing message:', error)
            }
        }
        socket.onclose = () => {
            isConnectedRef.current = false
            setConnectionState('disconnected')
            if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++
                const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1)
                reconnectTimeoutRef.current = setTimeout(connect, delay)
            }
        }
        socket.onerror = () => {
            setConnectionState('disconnected')
        }
        socketRef.current = socket
    }, [gameId, enabled, onGameEvent, reconnectDelay, maxReconnectAttempts, cleanup])

    const disconnect = useCallback(() => {
        cleanup()
    }, [cleanup])

    const reconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0
        connect()
    }, [connect])

    const isConnected = useCallback(() => {
        return connectionState === 'connected' && isConnectedRef.current && socketRef.current?.readyState === WebSocket.OPEN
    }, [connectionState])

    useEffect(() => {
        if (enabled && gameId) {
            connect()
            return cleanup
        }
        return cleanup
    }, [connect, cleanup, enabled, gameId])

    useEffect(() => {
        return cleanup
    }, [cleanup])

    return {
        isConnected,
        disconnect,
        reconnect,
        connectionCount: reconnectAttemptsRef.current,
        connectionState
    }
} 