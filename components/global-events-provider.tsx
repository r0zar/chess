"use client"

import type React from "react"
import { useGlobalEvents } from "@/hooks/useGlobalEvents"

interface GlobalEventsProviderProps {
    children: React.ReactNode
}

export default function GlobalEventsProvider({ children }: GlobalEventsProviderProps) {
    // Initialize global events for the entire app
    useGlobalEvents({
        enabled: true,
        reconnectDelay: 3000,
        maxReconnectAttempts: 5
    })

    return <>{children}</>
} 