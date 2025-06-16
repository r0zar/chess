import type { ReactNode } from 'react'
import ClientWrapper from '@/components/game/client-wrapper'

interface GameLayoutProps {
    children: ReactNode
    params: { gameId: string }
}

export default async function GameLayout({ children, params }: GameLayoutProps) {
    // This is a server component
    const { gameId } = await params
    return (
        <ClientWrapper gameId={gameId}>
            {children}
        </ClientWrapper>
    )
} 