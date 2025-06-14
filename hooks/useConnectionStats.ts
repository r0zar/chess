"use client"

import { useState, useEffect, useCallback } from 'react'
import type { ConnectionStats } from '@/lib/connection-stats'
import { useGlobalEventsContext } from '@/components/global-events-provider'

interface UseConnectionStatsOptions {
    gameId?: string // If provided, will also track game-specific stats
}

export function useConnectionStats(options: UseConnectionStatsOptions = {}) {
    const { gameId } = options

    const [globalStats, setGlobalStats] = useState<ConnectionStats['global']>({
        totalConnections: 0,
        activePlayers: 0,
        totalSpectators: 0,
        connectedUsers: []
    })

    const [gameStats, setGameStats] = useState<ConnectionStats['gameSpecific'] | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Subscribe to global events for connection stats updates
    const globalEvents = useGlobalEventsContext()

    // Handle connection stats events from useGlobalEvents
    useEffect(() => {
        if (globalEvents.connectionStats) {
            console.log('[useConnectionStats] Received connection stats update:', globalEvents.connectionStats)
            setGlobalStats(globalEvents.connectionStats.global)
            setIsLoading(false)
        }
    }, [globalEvents.connectionStats])

    // Set loading to false when connected, even if no stats yet
    useEffect(() => {
        if (globalEvents.connectionState === 'connected') {
            setIsLoading(false)
        } else if (globalEvents.connectionState === 'disconnected') {
            setIsLoading(true)
        }
    }, [globalEvents.connectionState])

    // Fetch initial stats
    const fetchStats = useCallback(async () => {
        try {
            setIsLoading(true)

            // For initial load, we'll create a temporary endpoint or use the existing global events
            // For now, we'll rely on the real-time updates from SSE
            console.log('[useConnectionStats] Waiting for real-time stats...')

        } catch (error) {
            console.error('[useConnectionStats] Error fetching stats:', error)
            setIsLoading(false)
        }
    }, [])

    // Fetch game-specific stats if gameId is provided
    const fetchGameStats = useCallback(async () => {
        if (!gameId) return

        try {
            // We'll get game stats from the game events or create a dedicated endpoint
            console.log('[useConnectionStats] Fetching game stats for:', gameId)

            // For now, we'll implement this as part of the game events system

        } catch (error) {
            console.error('[useConnectionStats] Error fetching game stats:', error)
        }
    }, [gameId])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    useEffect(() => {
        if (gameId) {
            fetchGameStats()
        }
    }, [gameId, fetchGameStats])

    return {
        globalStats,
        gameStats,
        isLoading,
        isConnected: globalEvents.isConnected(),
        refetch: fetchStats
    }
} 