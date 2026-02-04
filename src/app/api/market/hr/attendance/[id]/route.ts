import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET_NAME = 'company-private-documents'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path || !supabaseUrl || !supabaseServiceKey) return null

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600) // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data?.signedUrl || null
  } catch (error) {
    console.error('Error getting signed URL:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params
    const attendanceId = parseInt(id)

    if (isNaN(attendanceId)) {
      return NextResponse.json({ success: false, error: 'Invalid attendance ID' }, { status: 400 })
    }

    // Get attendance record with employee info
    const result = await db.query(`
      SELECT
        a.*,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as employeename,
        e.employee_code as employeecode,
        d.name as departmentname,
        d.code as departmentcode,
        COALESCE(approver_u.firstname || ' ' || approver_u.lastname, approver_u.email) as approvedbyname,
        e.photo_url as employeephoto
      FROM market_attendance a
      JOIN market_employees e ON a.employeeid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN market_departments d ON e.department_id = d.id
      LEFT JOIN market_employees approver ON a.approvedby = approver.id
      LEFT JOIN users approver_u ON approver.user_id = approver_u.id
      WHERE a.id = $1 AND a.companyid = $2
    `, [attendanceId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 })
    }

    const row = result.rows[0]

    // Get attendance logs (photos) for this record
    let checkInPhoto = null
    let checkOutPhoto = null

    try {
      const logsResult = await db.query(`
        SELECT * FROM market_attendance_logs
        WHERE attendanceid = $1 OR (employeeid = $2 AND DATE(createdat) = $3)
        ORDER BY createdat ASC
      `, [attendanceId, row.employeeid, row.date])

      for (const log of logsResult.rows) {
        if (log.actiontype === 'checkin' && log.imagepath) {
          checkInPhoto = await getSignedUrl(log.imagepath)
        } else if (log.actiontype === 'checkout' && log.imagepath) {
          checkOutPhoto = await getSignedUrl(log.imagepath)
        }
      }
    } catch (logError) {
      // Table might not exist, continue without photos
      console.log('Attendance logs not available:', logError)
    }

    // Also check if photos are stored directly in attendance record
    if (!checkInPhoto && row.checkinphotourl) {
      checkInPhoto = await getSignedUrl(row.checkinphotourl)
    }
    if (!checkOutPhoto && row.checkoutphotourl) {
      checkOutPhoto = await getSignedUrl(row.checkoutphotourl)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        companyId: row.companyid,
        employeeId: row.employeeid,
        employeeName: row.employeename,
        employeeCode: row.employeecode,
        employeePhoto: row.employeephoto,
        departmentName: row.departmentname,
        departmentCode: row.departmentcode,
        date: row.date,
        checkIn: row.checkin,
        checkOut: row.checkout,
        checkInMethod: row.checkinmethod,
        checkOutMethod: row.checkoutmethod,
        checkInPhoto,
        checkOutPhoto,
        workedHours: row.workedhours ? parseFloat(row.workedhours) : null,
        overtimeHours: row.overtimehours ? parseFloat(row.overtimehours) : 0,
        status: row.status,
        lateMinutes: row.lateminutes || 0,
        earlyDepartureMinutes: row.earlydepartureminutes || 0,
        notes: row.notes,
        approvedBy: row.approvedby,
        approvedByName: row.approvedbyname,
        createdAt: row.createdat,
        updatedAt: row.updatedat
      }
    })

  } catch (error: any) {
    console.error('Error fetching attendance details:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
