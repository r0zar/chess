import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/user'

export async function POST(request: NextRequest) {
    try {
        const { userUuid, stxAddress } = await request.json()
        if (!userUuid || !stxAddress) {
            return NextResponse.json({ error: 'Missing userUuid or stxAddress' }, { status: 400 })
        }
        const user = await getOrCreateUser(userUuid, stxAddress)
        return NextResponse.json({ success: true, user })
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 })
    }
} 