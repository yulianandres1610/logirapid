import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/companies/check-subdomain?subdomain=xxx
 * Verifica si un subdominio está disponible
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const subdomain = searchParams.get('subdomain')

    if (!subdomain) {
      return NextResponse.json({
        success: false,
        error: 'El parámetro subdomain es requerido'
      }, { status: 400 })
    }

    // Validar formato del subdominio (solo letras minúsculas, números y guiones)
    const subdomainRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json({
        success: false,
        available: false,
        error: 'El subdominio solo puede contener letras minúsculas, números y guiones (sin espacios ni caracteres especiales)'
      }, { status: 400 })
    }

    // Validar longitud (mínimo 3, máximo 50 caracteres)
    if (subdomain.length < 3 || subdomain.length > 50) {
      return NextResponse.json({
        success: false,
        available: false,
        error: 'El subdominio debe tener entre 3 y 50 caracteres'
      }, { status: 400 })
    }

    // Subdominios reservados (no permitidos)
    const reservedSubdomains = [
      'www', 'api', 'admin', 'dashboard', 'app', 'portal', 'login', 'register',
      'mail', 'email', 'ftp', 'smtp', 'pop', 'imap', 'webmail', 'blog', 'forum',
      'shop', 'store', 'dev', 'staging', 'test', 'demo', 'support', 'help',
      'docs', 'documentation', 'status', 'cdn', 'static', 'assets', 'img', 'images'
    ]

    if (reservedSubdomains.includes(subdomain.toLowerCase())) {
      return NextResponse.json({
        success: false,
        available: false,
        error: 'Este subdominio está reservado y no puede ser utilizado'
      }, { status: 400 })
    }

    // Verificar si el subdominio ya existe en la base de datos
    const query = `
      SELECT id, legalname
      FROM companies
      WHERE LOWER(subdomain) = LOWER($1)
      LIMIT 1
    `
    const result = await db.query(query, [subdomain])

    const available = result.rows.length === 0

    return NextResponse.json({
      success: true,
      available,
      subdomain,
      message: available
        ? 'El subdominio está disponible'
        : 'El subdominio ya está en uso',
      ...(available ? {} : { usedBy: result.rows[0].legalname })
    })
  } catch (error) {
    console.error('Error in GET /api/companies/check-subdomain:', error)
    return NextResponse.json({
      success: false,
      available: false,
      error: 'Error interno del servidor al verificar disponibilidad'
    }, { status: 500 })
  }
}
