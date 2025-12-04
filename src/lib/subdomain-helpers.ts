/**
 * Subdomain Helpers para Multi-Tenancy
 *
 * Utilidades para detectar subdominios y obtener información de empresa
 * Permite acceso por subdominio (empresa.logirapid.com) y desarrollo local
 */

import { db } from '@/lib/database'

/**
 * Interfaz para la información de empresa obtenida desde subdomain
 */
export interface CompanyInfo {
  id: number
  legalName: string
  subdomain: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  customDomain: string | null
  status: string
}

/**
 * Extrae el subdomain desde el hostname
 *
 * @param host - Hostname completo (e.g., "empresa1.logirapid.com" o "localhost:3000")
 * @returns Subdomain extraído o null si no hay subdomain
 *
 * @example
 * ```typescript
 * extractSubdomain('empresa1.logirapid.com') // → 'empresa1'
 * extractSubdomain('logirapid.com') // → null (dominio raíz)
 * extractSubdomain('localhost:3000') // → null (desarrollo local)
 * extractSubdomain('www.logirapid.com') // → null (www se ignora)
 * ```
 */
export function extractSubdomain(host: string): string | null {
  // Remover puerto si existe
  const hostname = host.split(':')[0]

  // Desarrollo local: retornar null (se usará DEV_SUBDOMAIN env var)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null
  }

  // Dividir hostname en partes
  const parts = hostname.split('.')

  // Si tiene menos de 3 partes, no hay subdomain
  // Ejemplo: logirapid.com → ['logirapid', 'com'] → no subdomain
  if (parts.length < 3) {
    return null
  }

  // Primer parte es el subdomain
  const subdomain = parts[0]

  // Ignorar 'www' como subdomain
  if (subdomain === 'www') {
    return null
  }

  return subdomain
}

/**
 * Obtiene información de empresa desde subdomain
 *
 * @param subdomain - Subdomain a buscar (e.g., 'holapack')
 * @returns CompanyInfo si se encuentra, null si no existe
 *
 * @example
 * ```typescript
 * const company = await getCompanyBySubdomain('holapack')
 * if (company) {
 *   console.log(`Empresa: ${company.legalName}`)
 *   console.log(`Logo: ${company.logoUrl}`)
 *   console.log(`Color primario: ${company.primaryColor}`)
 * }
 * ```
 */
export async function getCompanyBySubdomain(
  subdomain: string
): Promise<CompanyInfo | null> {
  try {
    const query = `
      SELECT
        id,
        legalname,
        subdomain,
        logo_url,
        primary_color,
        secondary_color,
        custom_domain,
        status
      FROM companies
      WHERE subdomain = $1
        AND status = 'active'
      LIMIT 1
    `

    const result = await db.query(query, [subdomain])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]

    return {
      id: row.id,
      legalName: row.legalname,
      subdomain: row.subdomain,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color || '#DC2626',
      secondaryColor: row.secondary_color || '#1E40AF',
      customDomain: row.custom_domain,
      status: row.status
    }
  } catch (error) {
    console.error('[getCompanyBySubdomain] Error:', error)
    return null
  }
}

/**
 * Obtiene información de empresa desde custom domain
 *
 * @param domain - Dominio personalizado (e.g., 'miempresa.com')
 * @returns CompanyInfo si se encuentra, null si no existe
 *
 * @example
 * ```typescript
 * const company = await getCompanyByCustomDomain('holapack.com')
 * ```
 */
export async function getCompanyByCustomDomain(
  domain: string
): Promise<CompanyInfo | null> {
  try {
    const query = `
      SELECT
        id,
        legalname,
        subdomain,
        logo_url,
        primary_color,
        secondary_color,
        custom_domain,
        status
      FROM companies
      WHERE custom_domain = $1
        AND status = 'active'
      LIMIT 1
    `

    const result = await db.query(query, [domain])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]

    return {
      id: row.id,
      legalName: row.legalname,
      subdomain: row.subdomain,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color || '#DC2626',
      secondaryColor: row.secondary_color || '#1E40AF',
      customDomain: row.custom_domain,
      status: row.status
    }
  } catch (error) {
    console.error('[getCompanyByCustomDomain] Error:', error)
    return null
  }
}

/**
 * Resuelve la empresa actual desde el hostname
 * Prioridad: Custom Domain → Subdomain → DEV_SUBDOMAIN env var → Empresa por defecto (ID=1)
 *
 * @param host - Hostname completo desde request headers
 * @returns CompanyInfo de la empresa detectada
 *
 * @example
 * ```typescript
 * // En API route o middleware:
 * const host = request.headers.get('host') || ''
 * const company = await resolveCompany(host)
 *
 * if (!company) {
 *   return NextResponse.json({ error: 'Company not found' }, { status: 404 })
 * }
 * ```
 */
export async function resolveCompany(host: string): Promise<CompanyInfo | null> {
  const hostname = host.split(':')[0]

  // 1. Intentar resolver por custom domain primero
  const companyByDomain = await getCompanyByCustomDomain(hostname)
  if (companyByDomain) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[resolveCompany] Resolved by custom domain: ${hostname} → Company ID ${companyByDomain.id}`)
    }
    return companyByDomain
  }

  // 2. Intentar extraer subdomain
  const subdomain = extractSubdomain(host)

  // Subdomains especiales que deben usar el fallback en lugar de retornar 404
  const specialSubdomains = ['agencias', 'admin', 'app', 'panel']

  if (subdomain && !specialSubdomains.includes(subdomain)) {
    const company = await getCompanyBySubdomain(subdomain)
    if (company) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[resolveCompany] Resolved by subdomain: ${subdomain} → Company ID ${company.id}`)
      }
      return company
    } else {
      console.warn(`[resolveCompany] Subdomain "${subdomain}" not found in database`)
      return null
    }
  }

  // 3. Desarrollo local, Vercel, subdomain especial, o dominio raíz: usar DEV_SUBDOMAIN env var o empresa por defecto
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isMainDomain = hostname === 'logirapid.com' || hostname === 'www.logirapid.com'
  const isVercel = hostname.includes('vercel.app') || hostname.includes('.vercel.app')
  const isSpecialSubdomain = subdomain && specialSubdomains.includes(subdomain)

  if (isLocalhost || isMainDomain || isVercel || isSpecialSubdomain) {
    const devSubdomain = process.env.DEV_SUBDOMAIN

    if (devSubdomain) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[resolveCompany] Using DEV_SUBDOMAIN: ${devSubdomain}`)
      }

      const company = await getCompanyBySubdomain(devSubdomain)

      if (company) {
        return company
      }
    }

    console.log(`[resolveCompany] No subdomain or DEV_SUBDOMAIN, falling back to first active company`)

    // 4. Fallback: primera empresa activa (para agencias, admin, etc.)
    try {
      const query = `
        SELECT
          id,
          legalname,
          subdomain,
          logo_url,
          primary_color,
          secondary_color,
          custom_domain,
          status
        FROM companies
        WHERE status = 'active'
        ORDER BY id ASC
        LIMIT 1
      `

      const result = await db.query(query)

      if (result.rows.length === 0) {
        console.error('[resolveCompany] No active company found in database')
        return null
      }

      const row = result.rows[0]

      return {
        id: row.id,
        legalName: row.legalname,
        subdomain: row.subdomain,
        logoUrl: row.logo_url,
        primaryColor: row.primary_color || '#DC2626',
        secondaryColor: row.secondary_color || '#1E40AF',
        customDomain: row.custom_domain,
        status: row.status
      }
    } catch (error) {
      console.error('[resolveCompany] Error fetching default company:', error)
      return null
    }
  }

  // No se pudo resolver empresa
  console.warn(`[resolveCompany] Could not resolve company for host: ${host}`)
  return null
}

/**
 * Valida que un subdomain sea válido (formato y disponibilidad)
 *
 * @param subdomain - Subdomain a validar
 * @returns { valid: boolean, error?: string }
 *
 * @example
 * ```typescript
 * const validation = await validateSubdomain('holapack')
 * if (!validation.valid) {
 *   console.error(validation.error)
 * }
 * ```
 */
export async function validateSubdomain(
  subdomain: string
): Promise<{ valid: boolean; error?: string }> {
  // Validación de formato
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

  if (!subdomainRegex.test(subdomain)) {
    return {
      valid: false,
      error: 'Subdomain must contain only lowercase letters, numbers, and hyphens. Cannot start or end with hyphen.'
    }
  }

  // Subdominios reservados
  const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'demo', 'test', 'dev', 'staging', 'prod']

  if (reserved.includes(subdomain.toLowerCase())) {
    return {
      valid: false,
      error: `Subdomain "${subdomain}" is reserved and cannot be used.`
    }
  }

  // Verificar disponibilidad en base de datos
  try {
    const query = `
      SELECT 1 FROM companies
      WHERE subdomain = $1
      LIMIT 1
    `

    const result = await db.query(query, [subdomain])

    if (result.rows.length > 0) {
      return {
        valid: false,
        error: `Subdomain "${subdomain}" is already taken.`
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('[validateSubdomain] Error:', error)
    return {
      valid: false,
      error: 'Error checking subdomain availability.'
    }
  }
}
