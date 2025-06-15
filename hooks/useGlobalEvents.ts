"use client"

import { useEffect, useRef, useCallback, useState } from 'react'
import type { GlobalEvent } from '@/types/global-events'
import { useToast } from '@/hooks/use-toast'
import PartySocket from 'partysocket'

interface UseGlobalEventsOptions {
    enabled?: boolean
    reconnectDelay?: number
    maxReconnectAttempts?: number
    onEvent?: (event: GlobalEvent) => void
}

export function useGlobalEvents(options: UseGlobalEventsOptions = {}) {
    const {
        enabled = true,
        reconnectDelay = 3000,
        maxReconnectAttempts = 5,
        onEvent
    } = options

    console.log('[useGlobalEvents] Hook called with options:', { enabled, reconnectDelay, maxReconnectAttempts })

    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
    const [connectionStats, setConnectionStats] = useState<any>(null)
    const socketRef = useRef<PartySocket | null>(null)
    const reconnectAttempts = useRef(0)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const { toast } = useToast()

    const formatUserDisplay = useCallback((userId?: string, userAddress?: string): string => {
        if (userAddress) {
            return `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`
        }
        if (userId) {
            return `User ${userId.substring(0, 8)}`
        }
        return "Unknown User"
    }, [])

    const handleGlobalEvent = useCallback((event: GlobalEvent) => {
        console.log('[Global Events] *** Received event:', event.type, event.data)

        // Handle connection stats updates (don't show toasts, just update state)
        if (event.type === 'connection_stats') {
            console.log('[Global Events] Connection stats update:', event.data)
            const statsEvent = event as GlobalEvent
            setConnectionStats(event.data)
            return
        }

        console.log('[Global Events] *** Processing event for toast notification... Type:', event.type)

        if (onEvent) onEvent(event)

        switch (event.type) {
            case 'user_activity': {
                const userActivity = event as GlobalEvent
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
                break;
            }
            case 'game_activity': {
                const gameActivity = event as GlobalEvent
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
                        : 'Game ended';
                    toast({
                        title: "🏁 Game Finished",
                        description: `${winnerText} in game ${gameIdShort}`,
                        duration: 4000,
                    })
                }
                break;
            }
            case 'move_activity': {
                const moveActivity = event as GlobalEvent
                const movePlayerDisplay = formatUserDisplay(moveActivity.data.userId, moveActivity.data.userAddress)
                const moveGameIdShort = moveActivity.data.gameId.substring(0, 8)
                const colorEmoji = moveActivity.data.playerColor === 'w' ? '⚪' : '⚫'
                toast({
                    title: `${colorEmoji} Move Made`,
                    description: `${movePlayerDisplay} played ${moveActivity.data.move} in game ${moveGameIdShort}`,
                    duration: 3000,
                })
                break;
            }
            case 'challenge_request': {
                const challengeRequest = event as GlobalEvent
                const challengerDisplay = formatUserDisplay(challengeRequest.data.userId, challengeRequest.data.userAddress)
                toast({
                    title: "⚔️ Challenge Request!",
                    description: `${challengerDisplay} is looking for a game: "${challengeRequest.data.message}"`,
                    duration: 6000,
                })
                break;
            }
            default:
                // Optionally handle unknown event types
                break;
        }
    }, [toast, formatUserDisplay, onEvent])

    const connect = useCallback(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log('[useGlobalEvents] connect() called but socket already open');
            return;
        }
        if (socketRef.current) {
            socketRef.current.close();
        }
        setConnectionState('connecting');
        const partyKitHost =
            typeof window !== 'undefined' && window.location.hostname !== 'localhost'
                ? 'chess-game.r0zar.partykit.dev'
                : 'localhost:1999';
        const socket = new PartySocket({
            host: partyKitHost,
            room: 'global-events',
        });
        socket.onopen = () => setConnectionState('connected');
        socket.onclose = () => setConnectionState('disconnected');
        socket.onerror = () => setConnectionState('disconnected');
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleGlobalEvent(data);
            } catch (error) {
                console.error('[useGlobalEvents] Error parsing message:', error);
            }
        };
        socketRef.current = socket;
        console.log('[useGlobalEvents] connect() opened new socket');
    }, [handleGlobalEvent]);

    const disconnect = useCallback(() => {
        console.log('[useGlobalEvents] disconnect() called');
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        setConnectionState('disconnected');
    }, []);

    const isConnected = useCallback(() => {
        return connectionState === 'connected' && socketRef.current?.readyState === WebSocket.OPEN;
    }, [connectionState]);

    useEffect(() => {
        if (options.enabled) {
            connect();
            return () => disconnect();
        } else {
            disconnect();
        }
    }, [options.enabled, connect, disconnect]);

    return {
        isConnected,
        connectionState,
        connectionStats,
        connect,
        disconnect
    };
}