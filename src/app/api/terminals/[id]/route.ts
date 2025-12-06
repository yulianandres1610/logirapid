import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// Helper to verify access to a terminal
async function verifyTerminalAccess(
  payload: JWTPayload,
  terminalId: number
): Promise<{ hasAccess: boolean; terminal: any | null }> {
  const terminalResult = await db.query(`
    SELECT
      id,
      company_id as "companyId",
      name,
      provider,
      device_id as "deviceId",
      device_code as "deviceCode",
      device_code_id as "deviceCodeId",
      status,
      last_seen_at as "lastSeenAt",
      paired_at as "pairedAt",
      location_name as "locationName",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM payment_terminals
    WHERE id = $1
  `, [terminalId])

  const terminal = terminalResult.rows[0]

  if (!terminal) {
    return { hasAccess: false, terminal: null }
  }

  // SUPER_ADMIN can access any terminal
  if (payload.role === 'SUPER_ADMIN') {
    return { hasAccess: true, terminal }
  }

  // Platform terminals (company_id IS NULL) - only SUPER_ADMIN
  if (terminal.companyId === null) {
    return { hasAccess: false, terminal: null }
  }

  // Company terminals - check if user belongs to the company
  if (payload.companyId === terminal.companyId) {
    return { hasAccess: true, terminal }
  }

  return { hasAccess: false, terminal: null }
}

/**
 * GET /api/terminals/[id]
 * Get terminal details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const terminalId = parseInt(id)

    if (isNaN(terminalId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de terminal inválido'
      }, { status: 400 })
    }

    // Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { hasAccess, terminal } = await verifyTerminalAccess(payload, terminalId)

    if (!hasAccess || !terminal) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado o sin acceso'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: terminal
    })

  } catch (error) {
    console.error('Error getting terminal:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener terminal'
    }, { status: 500 })
  }
}

/**
 * PUT /api/terminals/[id]
 * Update terminal (name, status, device_id after pairing)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const terminalId = parseInt(id)

    if (isNaN(terminalId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de terminal inválido'
      }, { status: 400 })
    }

    // Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { hasAccess, terminal } = await verifyTerminalAccess(payload, terminalId)

    if (!hasAccess || !terminal) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado o sin acceso'
      }, { status: 404 })
    }

    const body = await request.json()
    const { name, status, deviceId, deviceCode, deviceCodeId, locationName } = body

    // Build dynamic update
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`)
      values.push(name)
      paramIndex++
    }

    if (status !== undefined) {
      if (!['pending', 'paired', 'active', 'inactive'].includes(status)) {
        return NextResponse.json({
          success: false,
          error: 'Estado inválido'
        }, { status: 400 })
      }
      updates.push(`status = $${paramIndex}`)
      values.push(status)
      paramIndex++

      // Update paired_at timestamp when status changes to paired
      if (status === 'paired') {
        updates.push(`paired_at = NOW()`)
      }
    }

    if (deviceId !== undefined) {
      updates.push(`device_id = $${paramIndex}`)
      values.push(deviceId)
      paramIndex++
    }

    if (deviceCode !== undefined) {
      updates.push(`device_code = $${paramIndex}`)
      values.push(deviceCode)
      paramIndex++
    }

    if (deviceCodeId !== undefined) {
      updates.push(`device_code_id = $${paramIndex}`)
      values.push(deviceCodeId)
      paramIndex++
    }

    if (locationName !== undefined) {
      updates.push(`location_name = $${paramIndex}`)
      values.push(locationName)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(terminalId)

    const updateResult = await db.query(`
      UPDATE payment_terminals
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING
        id,
        company_id as "companyId",
        name,
        provider,
        device_id as "deviceId",
        device_code as "deviceCode",
        device_code_id as "deviceCodeId",
        status,
        last_seen_at as "lastSeenAt",
        paired_at as "pairedAt",
        location_name as "locationName",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, values)

    return NextResponse.json({
      success: true,
      message: 'Terminal actualizado',
      data: updateResult.rows[0]
    })

  } catch (error) {
    console.error('Error updating terminal:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar terminal'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/terminals/[id]
 * Delete a terminal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const terminalId = parseInt(id)

    if (isNaN(terminalId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de terminal inválido'
      }, { status: 400 })
    }

    // Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { hasAccess, terminal } = await verifyTerminalAccess(payload, terminalId)

    if (!hasAccess || !terminal) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado o sin acceso'
      }, { status: 404 })
    }

    // Delete the terminal
    await db.query('DELETE FROM payment_terminals WHERE id = $1', [terminalId])

    return NextResponse.json({
      success: true,
      message: 'Terminal eliminado'
    })

  } catch (error) {
    console.error('Error deleting terminal:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar terminal'
    }, { status: 500 })
  }
}
