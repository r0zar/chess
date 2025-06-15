import type * as Party from "partykit/server";

export default class GlobalEventsServer implements Party.Server {
    constructor(readonly room: Party.Room) { }

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        console.log(`[PartyKit GlobalEvents] Client connected: ${conn.id}`);
        conn.send(JSON.stringify({ type: "connected", data: { connectionId: conn.id } }));
    }

    onMessage(message: string, sender: Party.Connection) {
        try {
            const event = JSON.parse(message);
            console.log(`[PartyKit GlobalEvents] Received event:`, event.type, event.data);
            // Broadcast to all except sender
            this.room.broadcast(message, [sender.id]);
        } catch (error) {
            console.error(`[PartyKit GlobalEvents] Error parsing message:`, error);
            sender.send(JSON.stringify({ type: "error", data: { message: "Invalid message format" } }));
        }
    }

    async onClose(conn: Party.Connection) {
        console.log(`[PartyKit GlobalEvents] Client disconnected: ${conn.id}`);
    }

    async onRequest(req: Party.Request) {
        if (req.method === "POST") {
            try {
                const event = await req.json();
                console.log(`[PartyKit GlobalEvents] Broadcasting server event:`, event);
                this.room.broadcast(JSON.stringify(event));
                return new Response(JSON.stringify({ success: true }), {
                    headers: { "Content-Type": "application/json" },
                });
            } catch (error) {
                console.error(`[PartyKit GlobalEvents] Error handling server request:`, error);
                return new Response(JSON.stringify({ error: "Invalid request" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                });
            }
        }
        return new Response("PartyKit Global Events Server", {
            headers: { "Content-Type": "text/plain" },
        });
    }
} 