import { useEffect, useRef, useCallback, useState } from 'react'
import type { GameEvent } from '@/lib/game-events'

interface UseGameEventsOptions {
    enabled?: boolean
    reconnectDelay?: number
    maxReconnectAttempts?: number
}

export function useGameEvents(
    gameId: string,
    onGameEvent: (event: GameEvent) => void,
    options: UseGameEventsOptions = {}
) {
    const {
        enabled = true,
        reconnectDelay = 3000,
        maxReconnectAttempts = 5
    } = options

    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const reconnectAttemptsRef = useRef(0)
    const isConnectedRef = useRef(false)
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

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
        if (!enabled || !gameId) return

        cleanup()

        console.log(`[useGameEvents] Connecting to SSE for game ${gameId}`)
        setConnectionState('connecting')

        const eventSource = new EventSource(`/api/game/${gameId}/events`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
            console.log(`[useGameEvents] SSE connection opened for game ${gameId}`)
            isConnectedRef.current = true
            reconnectAttemptsRef.current = 0
            setConnectionState('connected')
        }

        eventSource.onmessage = (event) => {
            console.log(`[useGameEvents] *** RAW EVENT RECEIVED for game ${gameId} ***`)
            console.log(`[useGameEvents] Event type:`, event.type || 'message')
            console.log(`[useGameEvents] Event data:`, event.data)
            console.log(`[useGameEvents] Full event object:`, event)

            try {
                const eventData = JSON.parse(event.data)
                console.log(`[useGameEvents] Parsed event data:`, eventData)

                // Handle specific event types
                if (event.type === 'connected') {
                    console.log(`[useGameEvents] Connected to game ${gameId}:`, eventData)
                    return
                }

                if (event.type === 'initial_state') {
                    console.log(`[useGameEvents] Received initial state for game ${gameId}:`, eventData)
                    return
                }

                if (event.type === 'heartbeat') {
                    // Silent heartbeat handling
                    return
                }

                // Create game event object for other events
                const gameEvent: GameEvent = {
                    type: event.type as GameEvent['type'],
                    data: eventData
                }

                console.log(`[useGameEvents] Calling onGameEvent with:`, gameEvent)
                onGameEvent(gameEvent)
            } catch (error) {
                console.error(`[useGameEvents] Error parsing SSE event:`, error, event)
            }
        }

        // Handle specific SSE events
        const eventTypes = ['move', 'player_joined', 'player_disconnected', 'game_ended', 'sync_required']
        eventTypes.forEach(eventType => {
            eventSource.addEventListener(eventType, (event) => {
                console.log(`[useGameEvents] *** SPECIFIC EVENT LISTENER TRIGGERED ***`)
                console.log(`[useGameEvents] Event type: ${eventType}`)
                console.log(`[useGameEvents] Event data:`, (event as MessageEvent).data)

                try {
                    const eventData = JSON.parse((event as MessageEvent).data)
                    const gameEvent: GameEvent = {
                        type: eventType as GameEvent['type'],
                        data: eventData
                    }
                    console.log(`[useGameEvents] Calling onGameEvent from specific listener with:`, gameEvent)
                    onGameEvent(gameEvent)
                } catch (error) {
                    console.error(`[useGameEvents] Error parsing ${eventType} event:`, error)
                }
            })
        })

        eventSource.onerror = (error) => {
            console.error(`[useGameEvents] SSE error for game ${gameId}:`, error)
            isConnectedRef.current = false
            setConnectionState('disconnected')

            // Attempt to reconnect if we haven't exceeded max attempts
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                reconnectAttemptsRef.current++
                const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1) // Exponential backoff

                console.log(`[useGameEvents] Reconnecting to game ${gameId} in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)

                reconnectTimeoutRef.current = setTimeout(() => {
                    if (enabled && gameId) {
                        connect()
                    }
                }, delay)
            } else {
                console.error(`[useGameEvents] Max reconnect attempts reached for game ${gameId}`)
            }
        }
    }, [gameId, enabled, onGameEvent, reconnectDelay, maxReconnectAttempts, cleanup])

    const disconnect = useCallback(() => {
        console.log(`[useGameEvents] Manually disconnecting from game ${gameId}`)
        cleanup()
    }, [gameId, cleanup])

    const reconnect = useCallback(() => {
        console.log(`[useGameEvents] Manual reconnect requested for game ${gameId}`)
        reconnectAttemptsRef.current = 0
        connect()
    }, [connect, gameId])

    const isConnected = useCallback(() => {
        return connectionState === 'connected' && isConnectedRef.current && eventSourceRef.current?.readyState === EventSource.OPEN
    }, [connectionState])

    // Connect on mount and when dependencies change
    useEffect(() => {
        if (enabled && gameId) {
            connect()
            return cleanup
        }
        return cleanup
    }, [connect, cleanup, enabled, gameId])

    // Cleanup on unmount
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