import { NextResponse } from 'next/server'
import { KVConnectionManager } from '@/lib/kv-connection-manager'

export async function POST() {
    try {
        console.log('[Debug] Clearing all KV data...')

        // Clear all pending events
        await KVConnectionManager.clearAllPendingEvents()

        // Run cleanup to remove any corrupted data
        await KVConnectionManager.cleanup()

        console.log('[Debug] KV data cleared successfully')

        return NextResponse.json({
            success: true,
            message: 'KV data cleared successfully'
        })
    } catch (error) {
        console.error('[Debug] Error clearing KV data:', error)
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to clear KV data',
                error: (error as Error).message
            },
            { status: 500 }
        )
    }
} 