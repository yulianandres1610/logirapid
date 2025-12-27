import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

/**
 * POST /api/supplier/auth
 * Login para proveedores de consignación usando username/password
 */
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validaciones básicas
    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Usuario y contraseña son requeridos'
      }, { status: 400 })
    }

    // Buscar proveedor por username
    const supplierResult = await db.query(`
      SELECT
        id,
        company_id,
        code,
        name,
        email,
        phone,
        username,
        password_hash,
        is_active
      FROM consignment_suppliers
      WHERE LOWER(username) = LOWER($1)
    `, [username])

    if (supplierResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      }, { status: 401 })
    }

    const supplier = supplierResult.rows[0]

    // Verificar que el proveedor esté activo
    if (!supplier.is_active) {
      return NextResponse.json({
        success: false,
        error: 'Esta cuenta está desactivada. Contacte a soporte.'
      }, { status: 403 })
    }

    // Verificar que tenga password_hash
    if (!supplier.password_hash) {
      return NextResponse.json({
        success: false,
        error: 'Esta cuenta no tiene credenciales configuradas. Contacte al administrador.'
      }, { status: 403 })
    }

    // Verificar contraseña con bcrypt
    const isValidPassword = await bcrypt.compare(password, supplier.password_hash)

    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Usuario o contraseña incorrectos'
      }, { status: 401 })
    }

    // Generar JWT token para proveedor
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    const token = jwt.sign(
      {
        supplierId: supplier.id,
        supplierCode: supplier.code,
        companyId: supplier.company_id,
        type: 'supplier'
      },
      secret,
      { expiresIn: '7d' }
    )

    // Crear respuesta con cookies
    const response = NextResponse.json({
      success: true,
      message: 'Login exitoso',
      data: {
        supplier: {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone
        }
      }
    })

    // Configurar cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      domain: process.env.NODE_ENV === 'production' ? '.logirapid.com' : undefined
    }

    // Cookie principal del token
    response.cookies.set('supplier-token', token, cookieOptions)

    // Cookies de información del proveedor (no httpOnly para acceso en cliente)
    const clientCookieOptions = {
      ...cookieOptions,
      httpOnly: false
    }

    response.cookies.set('supplier-id', supplier.id.toString(), clientCookieOptions)
    response.cookies.set('supplier-code', supplier.code, clientCookieOptions)
    response.cookies.set('supplier-name', encodeURIComponent(supplier.name), clientCookieOptions)

    return response

  } catch (error) {
    console.error('[Supplier Auth] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al iniciar sesión'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/supplier/auth
 * Logout para proveedores
 */
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Sesión cerrada'
  })

  const cookieOptions = {
    path: '/',
    maxAge: 0,
    domain: process.env.NODE_ENV === 'production' ? '.logirapid.com' : undefined
  }

  response.cookies.set('supplier-token', '', cookieOptions)
  response.cookies.set('supplier-id', '', cookieOptions)
  response.cookies.set('supplier-code', '', cookieOptions)
  response.cookies.set('supplier-name', '', cookieOptions)

  return response
}
