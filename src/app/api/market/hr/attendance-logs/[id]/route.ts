import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

async function getCompanyAndUser() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  const userId = cookieStore.get('auth-token')?.value

  let parsedUserId = null
  if (userId) {
    try {
      const decoded = Buffer.from(userId, 'base64').toString('utf-8')
      const parts = decoded.split(':')
      parsedUserId = parts[0] ? parseInt(parts[0]) : null
    } catch {
      // Invalid token format
    }
  }

  return {
    companyId: companyId ? parseInt(companyId) : null,
    userId: parsedUserId
  }
}

/**
 * PATCH /api/market/hr/attendance-logs/[id]
 * Update attendance log (mark reviewed, flag, add notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, userId } = await getCompanyAndUser()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { reviewed, flagged, notes } = body

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (reviewed !== undefined) {
      updates.push(`reviewed = $${paramIndex}`)
      values.push(reviewed)
      paramIndex++

      if (reviewed && userId) {
        updates.push(`reviewedby = $${paramIndex}`)
        values.push(userId)
        paramIndex++
        updates.push(`reviewedat = NOW()`)
      }
    }

    if (flagged !== undefined) {
      updates.push(`flagged = $${paramIndex}`)
      values.push(flagged)
      paramIndex++
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`)
      values.push(notes)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    // Add WHERE conditions
    values.push(id, companyId)

    const result = await db.query(`
      UPDATE market_attendance_logs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND companyid = $${paramIndex + 1}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Log not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('Error updating attendance log:', error)
    return NextResponse.json(
      { success: false, error: 'Error updating log' },
      { status: 500 }
    )
  }
}
