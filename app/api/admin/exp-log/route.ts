import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/lib/kv'

export async function GET(request: NextRequest) {
    try {
        const raw = await kv.lrange<string>('exp_rewards_log', -100, -1)
        const logs = raw
            .map((entry) => {
                try {
                    return JSON.parse(entry)
                } catch {
                    return null
                }
            })
            .filter(Boolean)
            .reverse() // Most recent first
        return NextResponse.json({ success: true, logs })
    } catch (err) {
        return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
    }
} 