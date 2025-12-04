/**
 * API Route: /api/branding/current
 *
 * Obtiene información de branding de la empresa actual basado en el hostname
 * Usado en login page y layout para aplicar branding dinámico
 *
 * Para subdominios especiales (agencias, admin, app, panel) retorna branding de plataforma
 * Para subdominios de empresa específicos retorna branding de esa empresa
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveCompany, extractSubdomain } from '@/lib/subdomain-helpers'

// Logo de LogiRapid (plataforma) - usar logo-rojo.png que existe en public/
const PLATFORM_LOGO = '/logo-rojo.png'
const PLATFORM_NAME = 'LogiRapid'
const PLATFORM_PRIMARY_COLOR = '#DC2626'
const PLATFORM_SECONDARY_COLOR = '#1E40AF'

// Subdominios especiales que deben usar branding de plataforma
const SPECIAL_SUBDOMAINS = ['agencias', 'admin', 'app', 'panel']

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
 *     companyId: number | null,
 *     companyName: string,
 *     subdomain: string | null,
 *     logoUrl: string | null,
 *     primaryColor: string,
 *     secondaryColor: string,
 *     isPlatformBranding: boolean
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

    // Extraer subdomain para verificar si es especial
    const subdomain = extractSubdomain(host)
    const hostname = host.split(':')[0]
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
    const isVercel = hostname.includes('vercel.app')
    const isMainDomain = hostname === 'logirapid.com' || hostname === 'www.logirapid.com'

    // Verificar si es un subdomain especial (agencias, admin, etc.)
    const isSpecialSubdomain = subdomain && SPECIAL_SUBDOMAINS.includes(subdomain)

    // Para subdominios especiales, localhost sin DEV_SUBDOMAIN, o dominio principal: usar branding de plataforma
    if (isSpecialSubdomain || isMainDomain || (isLocalhost && !process.env.DEV_SUBDOMAIN) || (isVercel && !subdomain)) {
      return NextResponse.json({
        success: true,
        data: {
          companyId: null,
          companyName: PLATFORM_NAME,
          subdomain: null,
          logoUrl: PLATFORM_LOGO,
          primaryColor: PLATFORM_PRIMARY_COLOR,
          secondaryColor: PLATFORM_SECONDARY_COLOR,
          isPlatformBranding: true
        }
      })
    }

    // Para otros subdominios: resolver empresa y usar su branding
    const company = await resolveCompany(host)

    if (!company) {
      // Si no se encuentra empresa, usar branding de plataforma como fallback
      return NextResponse.json({
        success: true,
        data: {
          companyId: null,
          companyName: PLATFORM_NAME,
          subdomain: null,
          logoUrl: PLATFORM_LOGO,
          primaryColor: PLATFORM_PRIMARY_COLOR,
          secondaryColor: PLATFORM_SECONDARY_COLOR,
          isPlatformBranding: true
        }
      })
    }

    // Retornar branding de la empresa
    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalName,
        subdomain: company.subdomain,
        logoUrl: company.logoUrl || PLATFORM_LOGO, // Fallback al logo de plataforma si no tiene
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        isPlatformBranding: false
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
