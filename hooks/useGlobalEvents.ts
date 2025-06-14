"use client"

import { useEffect, useRef, useCallback, useState } from 'react'
import type { GlobalEvent } from '@/lib/global-events'
import { useToast } from '@/hooks/use-toast'

interface UseGlobalEventsOptions {
    enabled?: boolean
    reconnectDelay?: number
    maxReconnectAttempts?: number
}

export function useGlobalEvents(options: UseGlobalEventsOptions = {}) {
    const {
        enabled = true,
        reconnectDelay = 3000,
        maxReconnectAttempts = 5
    } = options

    console.log('[useGlobalEvents] Hook called with options:', { enabled, reconnectDelay, maxReconnectAttempts })

    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [connectionStats, setConnectionStats] = useState<GlobalEvent<'connection_stats'>['data'] | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectAttempts = useRef(0)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const { toast } = useToast()

    const formatUserDisplay = useCallback((userId: string, userAddress?: string): string => {
        if (userAddress) {
            return `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`
        }
        return `User ${userId.substring(0, 8)}`
    }, [])

    const handleGlobalEvent = useCallback((event: GlobalEvent) => {
        console.log('[Global Events] *** Received event:', event.type, event.data)

        // Handle connection stats updates (don't show toasts, just update state)
        if (event.type === 'connection_stats') {
            console.log('[Global Events] Connection stats update:', event.data)
            const statsEvent = event as GlobalEvent<'connection_stats'>
            setConnectionStats(statsEvent.data)
            return
        }

        console.log('[Global Events] *** Processing event for toast notification... Type:', event.type)

        switch (event.type) {
            case 'user_activity': {
                const userActivity = event as GlobalEvent<'user_activity'>
                const userDisplay = formatUserDisplay(userActivity.data.userId, userActivity.data.userAddress)
                if (userActivity.data.action === 'connected') {
                    toast({
                        title: "🟢 Player Connected",
                        description: `${userDisplay} joined the platform`,
                        duration: 3000,
                    })
                } else if (userActivity.data.action === 'disconnected') {
                    toast({
                        title: "🔴 Player Disconnected",
                        description: `${userDisplay} left the platform`,
                        duration: 3000,
                    })
                }
                break
            }

            case 'game_activity': {
                const gameActivity = event as GlobalEvent<'game_activity'>
                const gamePlayerDisplay = formatUserDisplay(gameActivity.data.userId, gameActivity.data.userAddress)
                const gameIdShort = gameActivity.data.gameId.substring(0, 8)

                console.log('[Global Events] *** Processing game_activity event:', gameActivity.data.action)

                if (gameActivity.data.action === 'created') {
                    console.log('[Global Events] *** Showing toast for game created')
                    toast({
                        title: "🎮 New Game Created",
                        description: `${gamePlayerDisplay} started game ${gameIdShort}`,
                        duration: 4000,
                    })
                } else if (gameActivity.data.action === 'joined') {
                    const colorEmoji = gameActivity.data.playerColor === 'w' ? '⚪' : '⚫'
                    toast({
                        title: `${colorEmoji} Player Joined Game`,
                        description: `${gamePlayerDisplay} joined as ${gameActivity.data.playerColor === 'w' ? 'White' : 'Black'} in ${gameIdShort}`,
                        duration: 4000,
                    })
                } else if (gameActivity.data.action === 'ended') {
                    const winnerText = gameActivity.data.winner
                        ? `${gameActivity.data.winner === 'w' ? 'White' : 'Black'} wins!`
                        : 'Game ended'
                    toast({
                        title: "🏁 Game Finished",
                        description: `${winnerText} in game ${gameIdShort}`,
                        duration: 4000,
                    })
                }
                break
            }

            case 'move_activity': {
                const moveActivity = event as GlobalEvent<'move_activity'>
                const movePlayerDisplay = formatUserDisplay(moveActivity.data.userId, moveActivity.data.userAddress)
                const moveGameIdShort = moveActivity.data.gameId.substring(0, 8)
                const colorEmoji = moveActivity.data.playerColor === 'w' ? '⚪' : '⚫'

                console.log('[Global Events] *** Processing move_activity event:', moveActivity.data.move)
                console.log('[Global Events] *** Showing toast for move made')

                toast({
                    title: `${colorEmoji} Move Made`,
                    description: `${movePlayerDisplay} played ${moveActivity.data.move} in game ${moveGameIdShort}`,
                    duration: 3000,
                })
                break
            }

            case 'challenge_request': {
                const challengeRequest = event as GlobalEvent<'challenge_request'>
                const challengerDisplay = formatUserDisplay(challengeRequest.data.userId, challengeRequest.data.userAddress)

                console.log('[Global Events] *** Processing challenge_request event from:', challengerDisplay)
                console.log('[Global Events] *** Event data:', challengeRequest.data)
                console.log('[Global Events] *** About to show toast for challenge request')

                const toastResult = toast({
                    title: "⚔️ Challenge Request!",
                    description: `${challengerDisplay} is looking for a game: "${challengeRequest.data.message}"`,
                    duration: 6000,
                })

                console.log('[Global Events] *** Toast function called, result:', toastResult)
                console.log('[Global Events] *** Toast should now be visible on screen')
                break
            }

            default:
                console.log('[Global Events] Unhandled event type:', event.type)
        }
    }, [toast, formatUserDisplay])

    const connect = useCallback(() => {
        console.log('='.repeat(50))
        console.log('[Global Events] *** connect() called! enabled:', enabled, 'eventSourceRef.current:', !!eventSourceRef.current)
        console.log('[Global Events] *** Current connectionState:', connectionState)

        if (!enabled || eventSourceRef.current) {
            console.log('[Global Events] *** connect() early return - enabled:', enabled, 'eventSourceRef exists:', !!eventSourceRef.current)
            return
        }

        console.log('[Global Events] *** Establishing global SSE connection...')
        setConnectionState('connecting')

        try {
            console.log('[Global Events] *** Creating EventSource for URL: /api/events')
            const eventSource = new EventSource('/api/events')
            eventSourceRef.current = eventSource
            console.log('[Global Events] *** EventSource created successfully')
            console.log('[Global Events] *** EventSource readyState:', eventSource.readyState)

            eventSource.onopen = () => {
                console.log('[Global Events] *** Global SSE connection opened!')
                setConnectionState('connected')
                reconnectAttempts.current = 0
            }

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log('[Global Events] Raw message received:', data)

                    if (data.type && data.type !== 'heartbeat' && data.type !== 'connection') {
                        console.log('[Global Events] Processing non-heartbeat event:', data.type)
                        handleGlobalEvent(data as GlobalEvent)
                    } else {
                        console.log('[Global Events] Skipping heartbeat/connection event:', data.type)
                    }
                } catch (error) {
                    console.error('[Global Events] Error parsing event data:', error)
                }
            }

            eventSource.onerror = (error) => {
                console.error('[Global Events] *** Connection error occurred:', error)
                console.error('[Global Events] *** EventSource readyState:', eventSource.readyState)
                console.error('[Global Events] *** EventSource URL:', eventSource.url)
                setConnectionState('disconnected')

                if (eventSourceRef.current) {
                    eventSourceRef.current.close()
                    eventSourceRef.current = null
                }

                // Attempt to reconnect
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current++
                    console.log(`[Global Events] Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts}) in ${reconnectDelay}ms`)

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect()
                    }, reconnectDelay)
                } else {
                    console.log('[Global Events] Max reconnect attempts reached')
                }
            }

        } catch (error) {
            console.error('[Global Events] Failed to create EventSource:', error)
            setConnectionState('disconnected')
        }
    }, [enabled, handleGlobalEvent, reconnectDelay, maxReconnectAttempts]) // Restored dependencies

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }

        setConnectionState('disconnected')
        console.log('[Global Events] Disconnected from global events')
    }, [])

    const isConnected = useCallback(() => {
        return connectionState === 'connected'
    }, [connectionState])

    // Set up connection
    useEffect(() => {
        console.log('🚀'.repeat(30))
        console.log('[useGlobalEvents] *** USE_EFFECT TRIGGERED ***')
        console.log('[useGlobalEvents] *** enabled:', enabled)
        console.log('[useGlobalEvents] *** Current connectionState:', connectionState)
        console.log('[useGlobalEvents] *** EventSource ref current:', !!eventSourceRef.current)
        console.log('🚀'.repeat(30))

        if (enabled) {
            console.log('[useGlobalEvents] *** Calling connect()...')
            connect()
        } else {
            console.log('[useGlobalEvents] *** Calling disconnect()...')
            disconnect()
        }

        return () => {
            console.log('[useGlobalEvents] *** useEffect cleanup, calling disconnect()...')
            disconnect()
        }
    }, [enabled, connect, disconnect]) // Restored proper dependencies

    return {
        isConnected,
        connectionState,
        connectionStats,
        connect,
        disconnect
    }
} 