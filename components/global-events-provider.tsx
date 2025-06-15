"use client"

import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from "react"
import type { GlobalEvent } from '@/types/global-events'
import PartySocket from 'partysocket'

interface GlobalEventsContextValue {
    connectionState: 'disconnected' | 'connecting' | 'connected'
    connectionStats: any | null
    isConnected: boolean
    connect: () => void
    disconnect: () => void
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null)

interface GlobalEventsProviderProps {
    children: ReactNode
    onEvent?: (event: GlobalEvent) => void
}

export default function GlobalEventsProvider({ children, onEvent }: GlobalEventsProviderProps) {
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [connectionStats, setConnectionStats] = useState<any>(null)
    const socketRef = useRef<PartySocket | null>(null)

    const handleGlobalEvent = useCallback((event: GlobalEvent) => {
        if (onEvent) onEvent(event)
        if (event.type === 'connection_stats') {
            setConnectionStats(event.data)
        }
    }, [onEvent])

    const connect = useCallback(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            return
        }
        if (socketRef.current) {
            socketRef.current.close()
        }
        setConnectionState('connecting')
        const partyKitHost =
            typeof window !== 'undefined' && window.location.hostname !== 'localhost'
                ? 'chess-game.r0zar.partykit.dev'
                : 'localhost:1999'
        const socket = new PartySocket({
            host: partyKitHost,
            room: 'global-events',
        })
        socket.onopen = () => setConnectionState('connected')
        socket.onclose = () => setConnectionState('disconnected')
        socket.onerror = () => setConnectionState('disconnected')
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                handleGlobalEvent(data)
            } catch (error) {
                console.error('[GlobalEventsProvider] Error parsing message:', error)
            }
        }
        socketRef.current = socket
    }, [handleGlobalEvent])

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close()
            socketRef.current = null
        }
        setConnectionState('disconnected')
    }, [])

    useEffect(() => {
        connect()
        return () => disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const contextValue: GlobalEventsContextValue = {
        connectionState,
        connectionStats,
        isConnected: connectionState === 'connected' && !!socketRef.current && socketRef.current.readyState === WebSocket.OPEN,
        connect,
        disconnect
    }
    return (
        <GlobalEventsContext.Provider value={contextValue}>
            {children}
        </GlobalEventsContext.Provider>
    )
}

export function useGlobalEvents() {
    const context = useContext(GlobalEventsContext)
    if (!context) {
        throw new Error('useGlobalEvents must be used within a GlobalEventsProvider')
    }
    return context
} 