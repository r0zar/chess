export type GlobalEvent =
    | { type: 'user_activity'; data: { userId: string; userAddress?: string; action: 'connected' | 'disconnected' } }
    | { type: 'game_activity'; data: { gameId: string; userId: string; userAddress?: string; action: 'created' | 'joined' | 'ended'; playerColor?: 'w' | 'b'; winner?: 'w' | 'b' } }
    | { type: 'move_activity'; data: { gameId: string; userId: string; userAddress?: string; playerColor: 'w' | 'b'; move: string } }
    | { type: 'challenge_request'; data: { userId: string; userAddress?: string; message: string } }
    | { type: 'connection_stats'; data: any } 