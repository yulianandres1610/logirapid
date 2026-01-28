import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { faceEncoding, photoUrl } = body

    if (!faceEncoding) {
      return NextResponse.json(
        { success: false, error: 'Face encoding is required' },
        { status: 400 }
      )
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await db.query(`
      SELECT id FROM market_employees WHERE id = $1 AND companyid = $2
    `, [id, companyId])

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Delete existing face registration and insert new one
    await db.transaction(async (client) => {
      // Delete existing faces
      await client.query(`
        DELETE FROM market_employee_faces WHERE employeeid = $1
      `, [id])

      // Insert new face
      await client.query(`
        INSERT INTO market_employee_faces (employeeid, faceencoding, photourl, isprimary)
        VALUES ($1, $2, $3, true)
      `, [id, faceEncoding, photoUrl || null])

      // Update employee flag
      await client.query(`
        UPDATE market_employees SET hasfaceregistered = true, updatedat = NOW()
        WHERE id = $1
      `, [id])
    })

    return NextResponse.json({
      success: true,
      message: 'Face registered successfully'
    })

  } catch (error: any) {
    console.error('Error registering face:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
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

    const result = await db.query(`
      SELECT ef.*, e.hasfaceregistered
      FROM market_employee_faces ef
      JOIN market_employees e ON ef.employeeid = e.id
      WHERE ef.employeeid = $1 AND e.companyid = $2
    `, [id, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasFaceRegistered: false,
          faces: []
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        hasFaceRegistered: true,
        faces: result.rows.map(row => ({
          id: row.id,
          faceEncoding: row.faceencoding,
          photoUrl: row.photourl,
          isPrimary: row.isprimary,
          createdAt: row.createdat
        }))
      }
    })

  } catch (error: any) {
    console.error('Error fetching face data:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No company ID' }, { status: 401 })
    }

    const { id } = await params

    await db.transaction(async (client) => {
      // Delete face data
      await client.query(`
        DELETE FROM market_employee_faces WHERE employeeid = $1
      `, [id])

      // Update employee flag
      await client.query(`
        UPDATE market_employees SET hasfaceregistered = false, updatedat = NOW()
        WHERE id = $1 AND companyid = $2
      `, [id, companyId])
    })

    return NextResponse.json({
      success: true,
      message: 'Face data deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting face data:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
