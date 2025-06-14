"use client"

import React, { createContext, useContext, type ReactNode } from "react"
import { useGlobalEvents } from "@/hooks/useGlobalEvents"
import type { GlobalEvent } from "@/lib/global-events"

interface GlobalEventsContextValue {
    connectionState: 'disconnected' | 'connecting' | 'connected'
    connectionStats: GlobalEvent<'connection_stats'>['data'] | null
    isConnected: () => boolean
    connect: () => void
    disconnect: () => void
}

const GlobalEventsContext = createContext<GlobalEventsContextValue | null>(null)

interface GlobalEventsProviderProps {
    children: ReactNode
}

export default function GlobalEventsProvider({ children }: GlobalEventsProviderProps) {
    console.log('🔥'.repeat(20))
    console.log('[GlobalEventsProvider] *** RENDERING AND INITIALIZING GLOBAL EVENTS ***')
    console.log('[GlobalEventsProvider] *** Component is mounted and running ***')

    // Single instance of global events for the entire app
    const globalEvents = useGlobalEvents({
        enabled: true,
        reconnectDelay: 3000,
        maxReconnectAttempts: 5
    })

    console.log('[GlobalEventsProvider] *** Global events hook result:')
    console.log('[GlobalEventsProvider] *** connectionState:', globalEvents.connectionState)
    console.log('[GlobalEventsProvider] *** isConnected():', globalEvents.isConnected())
    console.log('🔥'.repeat(20))

    const contextValue: GlobalEventsContextValue = {
        connectionState: globalEvents.connectionState,
        connectionStats: globalEvents.connectionStats,
        isConnected: globalEvents.isConnected,
        connect: globalEvents.connect,
        disconnect: globalEvents.disconnect
    }

    return (
        <GlobalEventsContext.Provider value={contextValue}>
            {children}
        </GlobalEventsContext.Provider>
    )
}

export function useGlobalEventsContext(): GlobalEventsContextValue {
    const context = useContext(GlobalEventsContext)
    if (!context) {
        throw new Error('useGlobalEventsContext must be used within a GlobalEventsProvider')
    }
    return context
} 