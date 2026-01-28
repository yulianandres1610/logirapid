import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

// GET - Get all face encodings for face recognition in kiosk
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

    // Verify kiosk exists and is active
    const kioskCheck = await db.query(`
      SELECT * FROM market_attendance_kiosks
      WHERE id = $1 AND companyid = $2 AND isactive = true
    `, [id, companyId])

    if (kioskCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Kiosk not found or inactive' },
        { status: 404 }
      )
    }

    // Update kiosk last ping
    await db.query(`
      UPDATE market_attendance_kiosks SET lastping = NOW() WHERE id = $1
    `, [id])

    // Get all face encodings for active employees in the company
    const result = await db.query(`
      SELECT
        ef.id as face_id,
        ef.faceencoding,
        ef.employeeid,
        e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as fullname
      FROM market_employee_faces ef
      JOIN market_employees e ON ef.employeeid = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.company_id = $1
        AND e.status = 'active'
        AND ef.isprimary = true
        AND ef.faceencoding IS NOT NULL
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        faceId: row.face_id,
        employeeId: row.employeeid,
        employeeCode: row.employee_code,
        fullName: row.fullname,
        faceEncoding: row.faceencoding
      }))
    })

  } catch (error: any) {
    console.error('Error fetching face encodings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
