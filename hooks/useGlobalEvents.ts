"use client"

import { useEffect, useRef, useCallback, useState } from 'react'
import type { GlobalEvent } from '@/lib/global-events'
import { useToast } from '@/components/ui/use-toast'

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

    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
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
        console.log('[Global Events] Received:', event.type, event.data)

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

                if (gameActivity.data.action === 'created') {
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

                toast({
                    title: `${colorEmoji} Move Made`,
                    description: `${movePlayerDisplay} played ${moveActivity.data.move} in game ${moveGameIdShort}`,
                    duration: 3000,
                })
                break
            }

            default:
                console.log('[Global Events] Unhandled event type:', event.type)
        }
    }, [toast, formatUserDisplay])

    const connect = useCallback(() => {
        if (!enabled || eventSourceRef.current) return

        console.log('[Global Events] Connecting to global events...')
        setConnectionState('connecting')

        try {
            const eventSource = new EventSource('/api/events')
            eventSourceRef.current = eventSource

            eventSource.onopen = () => {
                console.log('[Global Events] Connected to global events')
                setConnectionState('connected')
                reconnectAttempts.current = 0
            }

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type && data.type !== 'heartbeat' && data.type !== 'connection') {
                        handleGlobalEvent(data as GlobalEvent)
                    }
                } catch (error) {
                    console.error('[Global Events] Error parsing event data:', error)
                }
            }

            eventSource.onerror = (error) => {
                console.error('[Global Events] Connection error:', error)
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
    }, [enabled, handleGlobalEvent, reconnectDelay, maxReconnectAttempts])

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
        if (enabled) {
            connect()
        } else {
            disconnect()
        }

        return () => {
            disconnect()
        }
    }, [enabled, connect, disconnect])

    return {
        isConnected,
        connectionState,
        connect,
        disconnect
    }
} 