"use client"

import React, { createContext, useContext, type ReactNode, useState, useCallback, useRef, useEffect } from "react"
import type { GlobalEvent } from '@/types/global-events'
import usePartySocket from 'partysocket/react'
import { getPartyKitHost, GLOBAL_EVENTS_ROOM } from '@/lib/config'
import { useToast } from '@/hooks/use-toast'

interface ChallengeRequest {
    userId: string;
    userAddress?: string;
    message: string;
    timestamp: number;
}

interface GlobalEventsContextValue {
    connectionState: 'disconnected' | 'connecting' | 'connected'
    connectionStats: any | null
    isConnected: boolean
    connect: () => void
    disconnect: () => void
    stxAddress: string | null
    setStxAddress: (address: string | null) => void
    userUuid: string
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null)

interface GlobalEventsProviderProps {
    children: ReactNode
}

export { GlobalEventsContext }
export default function GlobalEventsProvider({ children }: GlobalEventsProviderProps) {
    const [globalConnectionState, setGlobalConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [connectionStats, setConnectionStats] = useState<any>(null)
    const [stxAddress, setStxAddress] = useState<string | null>(null)
    const [userUuid, setUserUuid] = useState<string>("")
    const { toast } = useToast()

    const globalSocket = usePartySocket({
        host: getPartyKitHost(),
        room: GLOBAL_EVENTS_ROOM,
        onOpen: () => setGlobalConnectionState('connected'),
        onClose: () => setGlobalConnectionState('disconnected'),
        onError: () => setGlobalConnectionState('disconnected'),
        onMessage: (event) => {
            try {
                const data = JSON.parse(event.data)
                handleGlobalEvent(data)
            } catch (error) {
                console.error('[GlobalEventsProvider] Error parsing message:', error)
            }
        },
    })

    // Initialize userUuid from localStorage or create a new one
    useEffect(() => {
        if (typeof window !== 'undefined') {
            let uuid = localStorage.getItem('user-uuid')
            if (!uuid) {
                uuid = crypto.randomUUID()
                localStorage.setItem('user-uuid', uuid)
            }
            setUserUuid(uuid)
        }
    }, [])

    function handleGlobalEvent(event: GlobalEvent) {
        if (event.type === 'connection_stats') {
            setConnectionStats(event.data)
        }
        if (event.type === 'challenge_request') {
            if (event.data.userId !== userUuid) {
                toast({
                    title: '⚔️ New Challenge!',
                    description: `${event.data.message}\nFrom: ${event.data.userId.substring(0, 6)}...${event.data.userId.slice(-4)}`,
                    duration: 5000
                })
            }
        }
        if (event.type === 'game_ended') {
            // Show a toast for all users (no userId in event, so show to everyone)
            const winner = event.data.winner ? `Winner: ${event.data.winner}` : 'Draw';
            const reason = event.data.reason ? `Reason: ${event.data.reason}` : '';
            const status = event.data.status ? `Status: ${event.data.status}` : '';
            let expLine = '';
            if (typeof event.data.expRewarded === 'number' && event.data.expRewarded > 0) {
                expLine = `\n✨ ${event.data.expRewarded} EXP awarded to the winner!`;
            }
            toast({
                title: '🏁 Game Ended',
                description: `${winner}\n${reason}\n${status}${expLine}`.trim(),
                duration: 6000
            })
        }
    }

    function connect() {
        if (globalSocket.readyState === WebSocket.OPEN) {
            return
        }
        if (globalSocket) {
            globalSocket.close()
        }
        setGlobalConnectionState('connecting')
    }

    function disconnect() {
        if (globalSocket) {
            globalSocket.close()
        }
        setGlobalConnectionState('disconnected')
    }

    useEffect(() => {
        connect()
        return () => disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const contextValue: GlobalEventsContextValue = {
        connectionState: globalConnectionState,
        connectionStats,
        isConnected: globalConnectionState === 'connected' && !!globalSocket && globalSocket.readyState === WebSocket.OPEN,
        connect,
        disconnect,
        stxAddress,
        setStxAddress,
        userUuid,
    }
    return (
        <GlobalEventsContext.Provider value={contextValue}>
            {children}
        </GlobalEventsContext.Provider>
    )
}

function useGlobalEvents() {
    const context = useContext(GlobalEventsContext)
    if (!context) {
        throw new Error('useGlobalEvents must be used within a GlobalEventsProvider')
    }
    return context
}

export { useGlobalEvents }
export type { GlobalEventsContextValue } 