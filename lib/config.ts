export function getPartyKitHost() {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        return 'chess-game.r0zar.partykit.dev'
    }
    return 'localhost:1999'
}

export const GLOBAL_EVENTS_ROOM = 'global-events' 