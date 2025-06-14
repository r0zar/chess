import { useCallback, useEffect, useRef, useState } from 'react'
import PartySocket from 'partysocket'

interface UsePartyKitOptions {
    enabled?: boolean
    host?: string
}

export function usePartyKit(
    gameId: string,
    onEvent: (event: any) => void,
    options: UsePartyKitOptions = {}
) {
    const {
        enabled = true,
        host // Will be auto-determined if not provided
    } = options

    // Auto-determine PartyKit host
    const partyKitHost = host || (
        typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? 'chess-game.r0zar.partykit.dev'  // Production
            : 'localhost:1999'                  // Development
    )

    const socketRef = useRef<PartySocket | null>(null)
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')

    const connect = useCallback(() => {
        if (!enabled || !gameId) return

        // Clean up existing connection
        if (socketRef.current) {
            socketRef.current.close()
        }

        console.log(`[usePartyKit] Connecting to game ${gameId} via ${partyKitHost}`)
        setConnectionState('connecting')

        const socket = new PartySocket({
            host: partyKitHost,
            room: gameId,
            // Add connection parameters if needed
            query: {
                // Could add userId, playerColor, etc. here
            }
        })

        socket.onopen = () => {
            console.log(`[usePartyKit] Connected to game ${gameId}`)
            setConnectionState('connected')
        }

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log(`[usePartyKit] Received event:`, data.type, data)

                // Handle internal PartyKit events
                if (data.type === 'connected') {
                    console.log(`[usePartyKit] Connection confirmed for game ${gameId}`)
                    return
                }

                if (data.type === 'player_connected' || data.type === 'player_disconnected') {
                    console.log(`[usePartyKit] Player connection event:`, data)
                    // Could show notifications here if needed
                    return
                }

                // Pass game events to handler
                onEvent(data)
            } catch (error) {
                console.error(`[usePartyKit] Error parsing message:`, error)
            }
        }

        socket.onclose = () => {
            console.log(`[usePartyKit] Disconnected from game ${gameId}`)
            setConnectionState('disconnected')
        }

        socket.onerror = (error) => {
            console.error(`[usePartyKit] Connection error:`, error)
            setConnectionState('disconnected')
        }

        socketRef.current = socket
    }, [enabled, gameId, partyKitHost, onEvent])

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log(`[usePartyKit] Manually disconnecting from game ${gameId}`)
            socketRef.current.close()
            socketRef.current = null
        }
    }, [gameId])

    const send = useCallback((data: any) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(data))
        } else {
            console.warn(`[usePartyKit] Cannot send - not connected to game ${gameId}`)
        }
    }, [gameId])

    const isConnected = useCallback(() => {
        return connectionState === 'connected' &&
            socketRef.current?.readyState === WebSocket.OPEN
    }, [connectionState])

    // Connect on mount and when dependencies change
    useEffect(() => {
        if (enabled && gameId) {
            connect()

            return () => {
                if (socketRef.current) {
                    socketRef.current.close()
                }
            }
        }
    }, [connect, enabled, gameId])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.close()
            }
        }
    }, [])

    return {
        isConnected,
        connectionState,
        connect,
        disconnect,
        send
    }
} 