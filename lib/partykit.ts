type BroadcastPartyKitEventArgs = {
    event: any
    gameId?: string
}

export async function broadcastPartyKitEvent({ event, gameId }: BroadcastPartyKitEventArgs) {
    try {
        const isProduction = process.env.NODE_ENV === 'production'
        const partyKitHost = isProduction
            ? process.env.PARTYKIT_HOST || 'chess-game.r0zar.partykit.dev'
            : 'localhost:1999'
        const protocol = isProduction ? 'https' : 'http'
        const path = gameId ? `/party/${gameId}` : '/party/global-events'
        const url = `${protocol}://${partyKitHost}${path}`
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        })
        if (!response.ok) {
            console.error(`[PartyKit] Broadcast failed:`, response.status, response.statusText)
        }
    } catch (error) {
        console.error(`[PartyKit] Broadcast error:`, error)
    }
} 