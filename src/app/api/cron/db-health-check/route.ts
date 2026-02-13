import { NextRequest, NextResponse } from 'next/server'
import { runHealthChecks, getCurrentDatabaseInfo } from '@/lib/database'
import { getStorageInfo } from '@/lib/storage-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  // Verify cron secret for Vercel cron jobs
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [healthResults, dbInfo, storageInfo] = await Promise.all([
      runHealthChecks(),
      Promise.resolve(getCurrentDatabaseInfo()),
      Promise.resolve(getStorageInfo()),
    ])

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        ...dbInfo,
        health: {
          primary: healthResults.primary,
          standby: healthResults.standby,
        },
        recoveryAttempted: healthResults.recoveryAttempted,
      },
      storage: storageInfo,
    }

    // Return appropriate status
    const isHealthy = healthResults.primary.healthy || (healthResults.standby?.healthy ?? false)

    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[Health Check] Error:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
