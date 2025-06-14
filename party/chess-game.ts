import type * as Party from "partykit/server";

export default class ChessGameServer implements Party.Server {
    constructor(readonly room: Party.Room) { }

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        // Get user info from connection
        const gameId = this.room.id;
        const userAgent = ctx.request.headers.get("user-agent") || "unknown";

        console.log(`[PartyKit Chess] Player connected to game ${gameId}`);
        console.log(`[PartyKit Chess] Connection ID: ${conn.id}`);

        // Get connection count using new API
        const connections = Array.from(await this.room.getConnections());
        const connectionCount = connections.length;
        console.log(`[PartyKit Chess] Total connections: ${connectionCount}`);

        // Send welcome message
        conn.send(JSON.stringify({
            type: 'connected',
            data: {
                gameId,
                connectionId: conn.id,
                message: 'Connected to chess game',
                totalConnections: connectionCount
            }
        }));

        // Broadcast to others that someone joined
        this.room.broadcast(JSON.stringify({
            type: 'player_connected',
            data: {
                connectionId: conn.id,
                totalConnections: connectionCount,
                timestamp: new Date().toISOString()
            }
        }), [conn.id]); // Exclude the joining player
    }

    onMessage(message: string, sender: Party.Connection) {
        try {
            const event = JSON.parse(message);
            console.log(`[PartyKit Chess] Received ${event.type} from ${sender.id}`);

            // Broadcast the event to all other players (exclude sender)
            this.room.broadcast(message, [sender.id]);

            console.log(`[PartyKit Chess] Broadcasted ${event.type} to other players`);
        } catch (error) {
            console.error(`[PartyKit Chess] Error parsing message:`, error);
            sender.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid message format' }
            }));
        }
    }

    async onClose(conn: Party.Connection) {
        console.log(`[PartyKit Chess] Player disconnected from game ${this.room.id}`);

        // Get remaining connection count
        const connections = Array.from(await this.room.getConnections());
        const remainingCount = connections.length;
        console.log(`[PartyKit Chess] Remaining connections: ${remainingCount}`);

        // Broadcast to others that someone left
        this.room.broadcast(JSON.stringify({
            type: 'player_disconnected',
            data: {
                connectionId: conn.id,
                totalConnections: remainingCount,
                timestamp: new Date().toISOString()
            }
        }));
    }

    onError(conn: Party.Connection, error: Error) {
        console.error(`[PartyKit Chess] Connection error for ${conn.id}:`, error);
    }

    // HTTP endpoint for server-side events (like moves from your API)
    async onRequest(req: Party.Request) {
        if (req.method === "POST") {
            try {
                const event = await req.json() as { type: string; data: any };
                console.log(`[PartyKit Chess] Broadcasting server event ${event.type} to game ${this.room.id}`);

                // Broadcast to all connected players
                this.room.broadcast(JSON.stringify(event));

                return new Response(JSON.stringify({ success: true }), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error) {
                console.error(`[PartyKit Chess] Error handling server request:`, error);
                return new Response(JSON.stringify({ error: "Invalid request" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        return new Response("PartyKit Chess Game Server", {
            headers: { "Content-Type": "text/plain" }
        });
    }
} 