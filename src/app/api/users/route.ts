import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveUser, getAllCompanies, assignUserToCompany, getUserCompanies } from '@/lib/database'
import { hashPassword, generateRandomPassword } from '@/lib/auth'

// GET: Obtener todos los usuarios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeCompanies = searchParams.get('includeCompanies') === 'true'

    const users = getAllUsers()
    let companies: any[] = []

    if (includeCompanies) {
      companies = getAllCompanies()
    }

    // Enrich users with company information if requested
    let enrichedUsers = users
    if (includeCompanies) {
      enrichedUsers = await Promise.all(
        users.map(async (user: any) => {
          const userCompanies = getUserCompanies(user.id)
          return {
            ...user,
            companies: userCompanies.map((c: any) => c.legalName),
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

    const { user, assignedCompanies } = body

    if (!user || !user.firstName || !user.lastName || !user.email) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Generate password if not provided
    const password = user.password || generateRandomPassword()
    const hashedPassword = await hashPassword(password)

    // Create user in database
    const newUser = saveUser({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      city: user.city,
      country: user.country,
      role: user.role,
      password: hashedPassword,
      status: user.isActive ? 'active' : 'inactive',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      transactionsCount: 0,
      isActive: user.isActive,
      sendEmail: user.sendEmail
    })

    // Assign companies to user
    if (assignedCompanies && assignedCompanies.length > 0) {
      for (const companyId of assignedCompanies) {
        assignUserToCompany(newUser.id, companyId)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          ...newUser,
          password: undefined // Don't send password back
        },
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