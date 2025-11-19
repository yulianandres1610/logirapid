/**
 * API Route: /api/companies/by-subdomain
 *
 * Obtiene información de empresa por subdomain
 * Usado para resolver empresa en login y middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompanyBySubdomain } from '@/lib/subdomain-helpers'

/**
 * GET /api/companies/by-subdomain?subdomain=holapack
 *
 * Query params:
 * - subdomain: string (required) - Subdomain to lookup
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: number,
 *     legalName: string,
 *     subdomain: string,
 *     logoUrl: string | null,
 *     primaryColor: string,
 *     secondaryColor: string,
 *     customDomain: string | null,
 *     status: string
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')

    // Validación
    if (!subdomain) {
      return NextResponse.json(
        { success: false, error: 'Subdomain parameter is required' },
        { status: 400 }
      )
    }

    // Buscar empresa
    const company = await getCompanyBySubdomain(subdomain)

    if (!company) {
      return NextResponse.json(
        { success: false, error: `Company with subdomain "${subdomain}" not found` },
        { status: 404 }
      )
    }

    // Retornar información
    return NextResponse.json({
      success: true,
      data: company
    })
  } catch (error) {
    console.error('[GET /api/companies/by-subdomain] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
