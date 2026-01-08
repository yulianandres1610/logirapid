import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * GET /api/auth/profile
 * Get complete user profile data
 */
export async function GET() {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const userId = payload.userId
    console.log('[Profile GET] userId:', userId)

    // Get user data with company info (try both user_companies and market_employees for company)
    let result
    try {
      result = await db.query(`
        SELECT
          u.id,
          u.email,
          u.name,
          u.firstname,
          u.lastname,
          u.phone,
          u.address,
          u.city,
          u.state,
          u.country,
          u.zipcode,
          u.avatar,
          u.role,
          u.createdat,
          u.lastlogin,
          COALESCE(c.id, c2.id) as company_id,
          COALESCE(c.name, c2.name) as company_name,
          COALESCE(c.type, c2.type) as company_type
        FROM users u
        LEFT JOIN user_companies uc ON u.id = uc.user_id
        LEFT JOIN companies c ON uc.company_id = c.id
        LEFT JOIN market_employees me ON u.id = me.user_id
        LEFT JOIN companies c2 ON me.company_id = c2.id
        WHERE u.id = $1
        LIMIT 1
      `, [userId])
      console.log('[Profile GET] Query result rows:', result.rows.length)
    } catch (dbError) {
      console.error('[Profile GET] DB Error:', dbError)
      return NextResponse.json({
        success: false,
        error: 'Error de base de datos: ' + (dbError instanceof Error ? dbError.message : 'Unknown')
      }, { status: 500 })
    }

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Usuario no encontrado (id: ${userId})`
      }, { status: 404 })
    }

    const user = result.rows[0]

    // Parse name if firstname/lastname are empty
    let firstName = user.firstname || ''
    let lastName = user.lastname || ''
    if (!firstName && !lastName && user.name) {
      const nameParts = user.name.split(' ')
      firstName = nameParts[0] || ''
      lastName = nameParts.slice(1).join(' ') || ''
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName,
        lastName,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        zipcode: user.zipcode || '',
        avatar: user.avatar || null,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name || '',
        companyType: user.company_type || '',
        createdAt: user.createdat,
        lastLogin: user.lastlogin
      }
    })

  } catch (error) {
    console.error('[Profile GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener perfil'
    }, { status: 500 })
  }
}

/**
 * PUT /api/auth/profile
 * Update user profile data
 */
export async function PUT(request: NextRequest) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const userId = payload.userId

    // Get request body
    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      country,
      zipcode,
      avatar
    } = body

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (firstName !== undefined) {
      updates.push(`firstname = $${paramIndex++}`)
      values.push(firstName)
    }
    if (lastName !== undefined) {
      updates.push(`lastname = $${paramIndex++}`)
      values.push(lastName)
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`)
      values.push(phone)
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`)
      values.push(address)
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`)
      values.push(city)
    }
    if (state !== undefined) {
      updates.push(`state = $${paramIndex++}`)
      values.push(state)
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`)
      values.push(country)
    }
    if (zipcode !== undefined) {
      updates.push(`zipcode = $${paramIndex++}`)
      values.push(zipcode)
    }
    if (avatar !== undefined) {
      updates.push(`avatar = $${paramIndex++}`)
      values.push(avatar)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay datos para actualizar'
      }, { status: 400 })
    }

    // Add userId to values
    values.push(userId)

    // Execute update
    await db.query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, values)

    // Get updated user data
    const result = await db.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.firstname,
        u.lastname,
        u.phone,
        u.address,
        u.city,
        u.state,
        u.country,
        u.zipcode,
        u.avatar,
        u.role,
        u.createdat,
        u.lastlogin,
        COALESCE(c.id, c2.id) as company_id,
        COALESCE(c.name, c2.name) as company_name,
        COALESCE(c.type, c2.type) as company_type
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.user_id
      LEFT JOIN companies c ON uc.company_id = c.id
      LEFT JOIN market_employees me ON u.id = me.user_id
      LEFT JOIN companies c2 ON me.company_id = c2.id
      WHERE u.id = $1
      LIMIT 1
    `, [userId])

    const user = result.rows[0]

    // Parse name if firstname/lastname are empty
    let updatedFirstName = user.firstname || ''
    let updatedLastName = user.lastname || ''
    if (!updatedFirstName && !updatedLastName && user.name) {
      const nameParts = user.name.split(' ')
      updatedFirstName = nameParts[0] || ''
      updatedLastName = nameParts.slice(1).join(' ') || ''
    }

    // Update localStorage data via response
    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        id: user.id,
        email: user.email,
        firstName: updatedFirstName,
        lastName: updatedLastName,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        zipcode: user.zipcode || '',
        avatar: user.avatar || null,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name || '',
        companyType: user.company_type || '',
        createdAt: user.createdat,
        lastLogin: user.lastlogin
      }
    })

  } catch (error) {
    console.error('[Profile PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar perfil'
    }, { status: 500 })
  }
}
