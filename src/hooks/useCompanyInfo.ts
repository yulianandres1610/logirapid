'use client'

interface CompanyInfo {
  companyId?: string
  companyName?: string
  userRole?: string
}

/**
 * Hook para obtener información de la empresa del contexto de la solicitud
 * Esta información es inyectada por el middleware basado en el token JWT del usuario
 */
export function useCompanyInfo(): CompanyInfo {
  // Nota: Este es un ejemplo simplificado. En Next.js App Router,
  // necesitarías usar headers() de next/headers en Server Components
  // o pasar esta información como props del Server Component

  // Para Client Components, puedes obtener esta información de:
  // 1. Cookies (si el middleware la guarda ahí)
  // 2. Context provider que la pase del Server al Client
  // 3. Un hook personalizado que lea desde un contexto

  return {
    companyId: undefined,
    companyName: undefined,
    userRole: undefined
  }
}

/**
 * Versión para Server Components - usar en páginas del servidor
 */
export function getCompanyInfoFromHeaders(): CompanyInfo {
  // Esto solo funciona en Server Components
  try {
    const headers = require('next/headers').headers()
    return {
      companyId: headers.get('x-user-company-id') || undefined,
      companyName: headers.get('x-user-company-name') || undefined,
      userRole: headers.get('x-user-role') || undefined
    }
  } catch (error) {
    console.error('Error reading headers:', error)
    return {
      companyId: undefined,
      companyName: undefined,
      userRole: undefined
    }
  }
}