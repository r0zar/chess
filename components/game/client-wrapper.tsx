"use client"

import { ReactNode } from "react"
import GameEventsProvider from "@/components/game-events-provider"

interface ClientWrapperProps {
    children: ReactNode
    gameId: string
}

export default function ClientWrapper({ children, gameId }: ClientWrapperProps) {
    return (
        <GameEventsProvider gameId={gameId}>
            {children}
        </GameEventsProvider>
    )
} 