import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

// Security constants
const FACE_DESCRIPTOR_LENGTH = 128
const MAX_ENCODING_SIZE = 10000 // Max characters for encoding string

async function getCompanyId() {
  const cookieStore = await cookies()
  const companyId = cookieStore.get('user-company-id')?.value
  return companyId ? parseInt(companyId) : null
}

// Validate face encoding format and integrity
function validateFaceEncoding(encoding: string): { valid: boolean; error?: string } {
  if (!encoding || typeof encoding !== 'string') {
    return { valid: false, error: 'Face encoding must be a string' }
  }

  if (encoding.length > MAX_ENCODING_SIZE) {
    return { valid: false, error: 'Face encoding exceeds maximum size' }
  }

  try {
    const parsed = JSON.parse(encoding)

    if (!Array.isArray(parsed)) {
      return { valid: false, error: 'Face encoding must be a JSON array' }
    }

    if (parsed.length !== FACE_DESCRIPTOR_LENGTH) {
      return { valid: false, error: `Face encoding must have exactly ${FACE_DESCRIPTOR_LENGTH} values` }
    }

    // Validate all values are valid numbers in expected range
    for (let i = 0; i < parsed.length; i++) {
      const value = parsed[i]
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: 'Face encoding contains invalid values' }
      }
      // Face descriptor values are typically between -0.5 and 0.5
      if (value < -2 || value > 2) {
        return { valid: false, error: 'Face encoding values out of expected range' }
      }
    }

    return { valid: true }
  } catch (e) {
    return { valid: false, error: 'Face encoding is not valid JSON' }
  }
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

    // Security: Validate employee ID is numeric
    const employeeId = parseInt(id)
    if (isNaN(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid employee ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { faceEncoding, photoUrl } = body

    if (!faceEncoding) {
      return NextResponse.json(
        { success: false, error: 'Face encoding is required' },
        { status: 400 }
      )
    }

    // Security: Validate face encoding format
    const validation = validateFaceEncoding(faceEncoding)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await db.query(`
      SELECT id FROM market_employees WHERE id = $1 AND company_id = $2
    `, [employeeId, companyId])

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
      `, [employeeId])

      // Insert new face
      await client.query(`
        INSERT INTO market_employee_faces (employeeid, faceencoding, photourl, isprimary)
        VALUES ($1, $2, $3, true)
      `, [employeeId, faceEncoding, photoUrl || null])

      // Update employee flag
      // Note: market_employees uses updated_at (with underscore)
      await client.query(`
        UPDATE market_employees SET hasfaceregistered = true, updated_at = NOW()
        WHERE id = $1
      `, [employeeId])
    })

    console.log(`Face registered for employee ${employeeId}`)

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

    // Security: Validate employee ID
    const employeeId = parseInt(id)
    if (isNaN(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid employee ID' },
        { status: 400 }
      )
    }

    const result = await db.query(`
      SELECT ef.*, e.hasfaceregistered
      FROM market_employee_faces ef
      JOIN market_employees e ON ef.employeeid = e.id
      WHERE ef.employeeid = $1 AND e.company_id = $2
    `, [employeeId, companyId])

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

    // Security: Validate employee ID
    const employeeId = parseInt(id)
    if (isNaN(employeeId) || employeeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid employee ID' },
        { status: 400 }
      )
    }

    await db.transaction(async (client) => {
      // Delete face data
      await client.query(`
        DELETE FROM market_employee_faces WHERE employeeid = $1
      `, [employeeId])

      // Update employee flag
      // Note: market_employees uses updated_at (with underscore)
      await client.query(`
        UPDATE market_employees SET hasfaceregistered = false, updated_at = NOW()
        WHERE id = $1 AND company_id = $2
      `, [employeeId, companyId])
    })

    console.log(`Face data deleted for employee ${employeeId}`)

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
