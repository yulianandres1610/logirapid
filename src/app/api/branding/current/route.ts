/**
 * API Route: /api/branding/current
 *
 * Obtiene información de branding de la empresa actual basado en el hostname
 * Usado en login page y layout para aplicar branding dinámico
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveCompany } from '@/lib/subdomain-helpers'

/**
 * GET /api/branding/current
 *
 * Detecta la empresa actual desde el hostname del request
 * y retorna su información de branding
 *
 * Headers used:
 * - host: Para detectar subdomain/custom domain
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     companyId: number,
 *     companyName: string,
 *     subdomain: string,
 *     logoUrl: string | null,
 *     primaryColor: string,
 *     secondaryColor: string
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const host = request.headers.get('host') || ''

    if (!host) {
      return NextResponse.json(
        { success: false, error: 'Host header is required' },
        { status: 400 }
      )
    }

    // Resolver empresa desde hostname
    const company = await resolveCompany(host)

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found for this hostname' },
        { status: 404 }
      )
    }

    // Retornar branding
    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalName,
        subdomain: company.subdomain,
        logoUrl: company.logoUrl,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor
      }
    })
  } catch (error) {
    console.error('[GET /api/branding/current] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
