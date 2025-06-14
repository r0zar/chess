import { useCallback, useEffect, useRef, useState } from 'react'
import type { UnifiedEvent } from '@/lib/unified-connection-manager'

interface UseUnifiedEventsOptions {
    gameId?: string // If provided, subscribes to game-specific events
    enabled?: boolean
    reconnectDelay?: number
    maxReconnectAttempts?: number
}

interface ConnectionStats {
    totalConnections: number
    activePlayers: number
    totalSpectators: number
    connectedUsers: string[]
}

export function useUnifiedEvents(
    onEvent: (event: UnifiedEvent) => void,
    options: UseUnifiedEventsOptions = {}
) {
    const {
        gameId,
        enabled = true,
        reconnectDelay = 3000,
        maxReconnectAttempts = 5
    } = options

    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const reconnectAttemptsRef = useRef(0)
    const isConnectedRef = useRef(false)
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null)

    const cleanup = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = undefined
        }
        isConnectedRef.current = false
        setConnectionState('disconnected')
    }, [])

    const connect = useCallback(() => {
        if (!enabled) return

        cleanup()

        console.log(`[useUnifiedEvents] Connecting to unified events${gameId ? ` for game ${gameId}` : ' (global)'}`)
        setConnectionState('connecting')

        // Build URL with gameId parameter if provided
        const url = gameId
            ? `/api/events/unified?gameId=${gameId}`
            : '/api/events/unified'

        const eventSource = new EventSource(url)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
            console.log(`[useUnifiedEvents] Connection opened${gameId ? ` for game ${gameId}` : ' (global)'}`)
            isConnectedRef.current = true
            reconnectAttemptsRef.current = 0
            setConnectionState('connected')
        }

        eventSource.onmessage = (event) => {
            console.log(`[useUnifiedEvents] *** RAW EVENT RECEIVED ***`)
            console.log(`[useUnifiedEvents] Event type:`, event.type || 'message')
            console.log(`[useUnifiedEvents] Event data:`, event.data)

            try {
                const rawEventData = JSON.parse(event.data)
                console.log(`[useUnifiedEvents] Parsed raw event:`, rawEventData)

                // Handle SSE-specific events (not part of UnifiedEvent)
                if (rawEventData.type === 'connected') {
                    console.log(`[useUnifiedEvents] Connection confirmed:`, rawEventData.data)
                    return
                }

                if (rawEventData.type === 'heartbeat') {
                    // Silent heartbeat handling
                    return
                }

                if (rawEventData.type === 'connection_stats') {
                    console.log(`[useUnifiedEvents] Connection stats update:`, rawEventData.data)
                    if (rawEventData.data?.global) {
                        setConnectionStats(rawEventData.data.global)
                    }
                    return
                }

                // Cast to UnifiedEvent for other events
                const eventData = rawEventData as UnifiedEvent

                // Pass other events to the handler
                console.log(`[useUnifiedEvents] Calling event handler with:`, eventData)
                onEvent(eventData)
            } catch (error) {
                console.error(`[useUnifiedEvents] Error parsing event:`, error, event)
            }
        }

        eventSource.onerror = (error) => {
            console.error(`[useUnifiedEvents] Connection error${gameId ? ` for game ${gameId}` : ' (global)'}:`, error)
            isConnectedRef.current = false
            setConnectionState('disconnected')

            // Attempt to reconnect if we haven't exceeded max attempts
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++
                const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1) // Exponential backoff

                console.log(`[useUnifiedEvents] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)

                reconnectTimeoutRef.current = setTimeout(() => {
                    if (enabled) {
                        connect()
                    }
                }, delay)
            } else {
                console.error(`[useUnifiedEvents] Max reconnect attempts reached`)
            }
        }
    }, [enabled, gameId, onEvent, reconnectDelay, maxReconnectAttempts, cleanup])

    const disconnect = useCallback(() => {
        console.log(`[useUnifiedEvents] Manual disconnect${gameId ? ` for game ${gameId}` : ' (global)'}`)
        cleanup()
    }, [gameId, cleanup])

    const reconnect = useCallback(() => {
        console.log(`[useUnifiedEvents] Manual reconnect${gameId ? ` for game ${gameId}` : ' (global)'}`)
        reconnectAttemptsRef.current = 0
        connect()
    }, [connect, gameId])

    const isConnected = useCallback(() => {
        return connectionState === 'connected' && isConnectedRef.current && eventSourceRef.current?.readyState === EventSource.OPEN
    }, [connectionState])

    // Connect on mount and when dependencies change
    useEffect(() => {
        if (enabled) {
            connect()
            return cleanup
        }
        return cleanup
    }, [connect, cleanup, enabled])

    // Cleanup on unmount
    useEffect(() => {
        return cleanup
    }, [cleanup])

    return {
        isConnected,
        disconnect,
        reconnect,
        connectionState,
        connectionStats,
        reconnectAttempts: reconnectAttemptsRef.current
    }
} 