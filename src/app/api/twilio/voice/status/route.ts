import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook para recibir actualizaciones de estado de llamadas de Twilio
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const callDuration = formData.get('CallDuration') as string

    console.log('[Twilio Voice Status] Update:', { callSid, callStatus, callDuration })

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'queued',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'busy': 'busy',
      'failed': 'failed',
      'no-answer': 'no-answer',
      'canceled': 'canceled'
    }

    const status = statusMap[callStatus] || callStatus

    // Update call record in database
    const updateFields: string[] = ['status = $2']
    const updateValues: (string | number | null)[] = [callSid, status]
    let paramIndex = 3

    if (callDuration) {
      updateFields.push(`durationseconds = $${paramIndex}`)
      updateValues.push(parseInt(callDuration, 10))
      paramIndex++
    }

    // Set end time for terminal states
    if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status)) {
      updateFields.push(`endedat = $${paramIndex}`)
      updateValues.push(new Date().toISOString())
      paramIndex++
    }

    const updateQuery = `
      UPDATE voice_calls
      SET ${updateFields.join(', ')}
      WHERE callsid = $1
    `

    await db.query(updateQuery, updateValues)

    console.log('[Twilio Voice Status] Call updated:', { callSid, status })

    return new NextResponse('OK', { status: 200 })

  } catch (error) {
    console.error('[Twilio Voice Status] Error:', error)
    return new NextResponse('Error', { status: 500 })
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Twilio Voice Status Webhook is active',
    timestamp: new Date().toISOString()
  })
}
