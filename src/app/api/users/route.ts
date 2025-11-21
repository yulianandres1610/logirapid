import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { hashPassword, generateRandomPassword } from '@/lib/auth'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET: Obtener todos los usuarios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)
    const includeCompanies = searchParams.get('includeCompanies') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const requestedCompanyId = searchParams.get('companyId')
    const companyIdFilter = requestedCompanyId ? parseInt(requestedCompanyId) : headerCompanyId

    // Get users from PostgreSQL with correct column names
    const offset = (page - 1) * limit
    const params: any[] = []
    const conditions: string[] = []

    if (!isSuperAdmin) {
      if (!headerCompanyId) {
        return NextResponse.json(
          { success: false, error: 'No se pudo determinar la empresa del usuario' },
          { status: 400 }
        )
      }
      params.push(headerCompanyId)
      conditions.push(`uc.companyid = $${params.length}`)
    } else if (requestedCompanyId) {
      params.push(parseInt(requestedCompanyId))
      conditions.push(`uc.companyid = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const usersQuery = `
      SELECT
        u.id,
        u.firstname as "firstName",
        u.lastname as "lastName",
        u.email,
        u.phone,
        u.address,
        u.city,
        u.country,
        u.role,
        u.status,
        u.isactive as "isActive",
        u.transactionscount as "transactionsCount",
        u.createdat as "createdAt",
        u.lastlogin as "lastLogin",
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT uc.companyid), NULL) as "companyIds"
      FROM users u
      LEFT JOIN user_companies uc ON uc.userid = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.createdat DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    params.push(limit, offset)

    const usersResult = await db.query(usersQuery, params)

    let companies: any[] = []
    if (includeCompanies) {
      // Get companies from PostgreSQL
      const companiesQuery = `
        SELECT
          id,
          legalname as "legalName",
          einnumber as "einNumber"
        FROM companies
        ORDER BY legalname ASC
      `
      const companiesResult = await db.query(companiesQuery)
      companies = companiesResult.rows
    }

    // Enrich users with company information if requested
    let enrichedUsers = usersResult.rows
    if (includeCompanies) {
      enrichedUsers = await Promise.all(
        usersResult.rows.map(async (user: any) => {
          // Get user companies from user_companies table
          const userCompaniesQuery = `
            SELECT c.legalname as "legalName"
            FROM user_companies uc
            JOIN companies c ON uc.companyid = c.id
            WHERE uc.userid = $1
            ${companyIdFilter ? 'AND uc.companyid = $2' : ''}
          `
          const userCompaniesResult = await db.query(
            userCompaniesQuery,
            companyIdFilter ? [user.id, companyIdFilter] : [user.id]
          )

          return {
            ...user,
            companies: userCompaniesResult.rows.map((c: any) => c.legalName),
            companyIds: Array.isArray(user.companyIds) ? user.companyIds : [],
            status: user.isActive ? 'active' : 'inactive'
          }
        })
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        companies: includeCompanies ? companies : undefined
      }
    })

  } catch (error) {
    console.error('Error getting users:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener usuarios'
    }, { status: 500 })
  }
}

// POST: Crear nuevo usuario
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
  const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

  const { user, assignedCompanies } = body
  const resolvedAssignedCompanies =
    assignedCompanies && assignedCompanies.length > 0
      ? assignedCompanies
      : headerCompanyId
        ? [headerCompanyId]
        : []

    if (!isSuperAdmin && resolvedAssignedCompanies.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo determinar la empresa para crear el usuario'
      }, { status: 400 })
    }

    if (!user || !user.firstName || !user.lastName || !user.email) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1'
    const existingUserResult = await db.query(existingUserQuery, [user.email])

    if (existingUserResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'El usuario ya existe'
      }, { status: 400 })
    }

    // Generate password if not provided
    const password = user.password || generateRandomPassword()
    const hashedPassword = await hashPassword(password)

    // Insert user into PostgreSQL
    const insertUserQuery = `
      INSERT INTO users (
        firstname, lastname, email, phone, address, city, country,
        role, password, status, isactive, transactionscount,
        createdat, lastlogin
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      )
      RETURNING
        id,
        firstname as "firstName",
        lastname as "lastName",
        email,
        phone,
        address,
        city,
        country,
        role,
        status,
        isactive as "isActive",
        transactionscount as "transactionsCount"
    `

    const values = [
      user.firstName,
      user.lastName,
      user.email,
      user.phone || null,
      user.address || null,
      user.city || null,
      user.country || null,
      (user.role || 'USER').toUpperCase(),
      hashedPassword,
      user.isActive ? 'active' : 'inactive',
      user.isActive !== false,
      0
    ]

    const newUserResult = await db.query(insertUserQuery, values)
    const newUser = newUserResult.rows[0]

    // Assign companies to user
    if (resolvedAssignedCompanies && resolvedAssignedCompanies.length > 0) {
      for (const companyId of resolvedAssignedCompanies) {
        const assignCompanyQuery = `
          INSERT INTO user_companies (userid, companyid)
          VALUES ($1, $2)
          ON CONFLICT (userid, companyid) DO NOTHING
        `
        await db.query(assignCompanyQuery, [newUser.id, companyId])
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: newUser,
        message: user.sendEmail ? 'Se enviará un email con las credenciales.' : ''
      }
    })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear usuario'
    }, { status: 500 })
  }
}

// PUT: Update user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...userData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de usuario requerido'
      }, { status: 400 })
    }

    // Build dynamic UPDATE query
    const updateFields = []
    const values = []
    let valueIndex = 1

    const fieldMapping: { [key: string]: string } = {
      firstName: 'firstname',
      lastName: 'lastname',
      email: 'email',
      phone: 'phone',
      address: 'address',
      city: 'city',
      country: 'country',
      role: 'role',
      isActive: 'isactive',
      status: 'status'
    }

    const hasPasswordUpdate = typeof userData.password === 'string' && userData.password.trim() !== ''

    for (const [key, value] of Object.entries(userData)) {
      if (fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = $${valueIndex}`)
        if (key === 'role' && typeof value === 'string') {
          values.push(value.toUpperCase())
        } else {
          values.push(value)
        }
        valueIndex++
      }
    }

    if (hasPasswordUpdate) {
      const hashed = await hashPassword(userData.password)
      updateFields.push(`password = $${valueIndex}`)
      values.push(hashed)
      valueIndex++
    }

    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    values.push(id)

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING
        id,
        firstname as "firstName",
        lastname as "lastName",
        email,
        phone,
        address,
        city,
        state,
        zipcode as "zipCode",
        apartment,
        country,
        role,
        status,
        isactive as "isActive"
    `

    const result = await db.query(updateQuery, values)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar usuario'
    }, { status: 500 })
  }
}

// DELETE: Delete user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de usuario requerido'
      }, { status: 400 })
    }

    // First delete user_companies relationships
    await db.query('DELETE FROM user_companies WHERE userid = $1', [id])

    // Then delete the user
    const deleteQuery = 'DELETE FROM users WHERE id = $1 RETURNING id'
    const result = await db.query(deleteQuery, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al eliminar usuario'
    }, { status: 500 })
  }
}
