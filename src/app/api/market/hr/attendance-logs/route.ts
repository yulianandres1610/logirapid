import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET_NAME = 'company-private-documents'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

/**
 * POST /api/market/hr/attendance-logs
 * Save attendance photo for supervisor review
 */
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, attendanceId, imageData, actionType } = body

    if (!employeeId || !imageData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `attendance-${employeeId}-${actionType}-${timestamp}.jpg`
    const storagePath = `company-${companyId}/attendance-logs/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading attendance photo:', uploadError)
      // Don't fail the request - photo is for audit only
    }

    // Save log to database
    try {
      await db.query(`
        INSERT INTO market_attendance_logs
        (companyid, employeeid, attendanceid, actiontype, imagepath, createdat)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [companyId, employeeId, attendanceId || null, actionType, storagePath])
    } catch (dbError: any) {
      // Table might not exist, try to create it
      if (dbError.message?.includes('does not exist')) {
        await db.query(`
          CREATE TABLE IF NOT EXISTS market_attendance_logs (
            id SERIAL PRIMARY KEY,
            companyid INTEGER NOT NULL,
            employeeid INTEGER NOT NULL,
            attendanceid INTEGER,
            actiontype VARCHAR(20),
            imagepath TEXT,
            reviewed BOOLEAN DEFAULT FALSE,
            reviewedby INTEGER,
            reviewedat TIMESTAMP,
            flagged BOOLEAN DEFAULT FALSE,
            notes TEXT,
            createdat TIMESTAMP DEFAULT NOW()
          )
        `)
        // Retry insert
        await db.query(`
          INSERT INTO market_attendance_logs
          (companyid, employeeid, attendanceid, actiontype, imagepath, createdat)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [companyId, employeeId, attendanceId || null, actionType, storagePath])
      }
    }

    return NextResponse.json({
      success: true,
      data: { imagePath: storagePath }
    })

  } catch (error: any) {
    console.error('Error saving attendance log:', error)
    // Return success anyway - don't block attendance for logging failure
    return NextResponse.json({ success: true, data: { imagePath: null } })
  }
}

/**
 * GET /api/market/hr/attendance-logs
 * Get attendance logs for supervisor review
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const reviewed = searchParams.get('reviewed')
    const flagged = searchParams.get('flagged')
    const employeeId = searchParams.get('employeeId')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE l.companyid = $1'
    const params: any[] = [companyId]
    let paramIndex = 2

    if (reviewed !== null && reviewed !== '') {
      whereClause += ` AND l.reviewed = $${paramIndex}`
      params.push(reviewed === 'true')
      paramIndex++
    }

    if (flagged === 'true') {
      whereClause += ` AND l.flagged = TRUE`
    }

    if (employeeId) {
      whereClause += ` AND l.employeeid = $${paramIndex}`
      params.push(parseInt(employeeId))
      paramIndex++
    }

    // Get logs with employee info
    const result = await db.query(`
      SELECT
        l.*,
        e.employee_code,
        COALESCE(u.name, e.employee_code) as employee_name
      FROM market_attendance_logs l
      JOIN market_employees e ON l.employeeid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY l.createdat DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_attendance_logs l
      ${whereClause}
    `, params)

    return NextResponse.json({
      success: true,
      data: {
        logs: result.rows.map(row => ({
          id: row.id,
          employeeId: row.employeeid,
          employeeCode: row.employee_code,
          employeeName: row.employee_name,
          attendanceId: row.attendanceid,
          actionType: row.actiontype,
          imagePath: row.imagepath,
          reviewed: row.reviewed,
          reviewedBy: row.reviewedby,
          reviewedAt: row.reviewedat,
          flagged: row.flagged,
          notes: row.notes,
          createdAt: row.createdat
        })),
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0]?.total || '0'),
          totalPages: Math.ceil(parseInt(countResult.rows[0]?.total || '0') / limit)
        }
      }
    })

  } catch (error: any) {
    console.error('Error fetching attendance logs:', error)
    return NextResponse.json(
      { success: false, error: 'Error fetching logs' },
      { status: 500 }
    )
  }
}
