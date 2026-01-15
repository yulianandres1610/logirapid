'use client'

/**
 * Hook para realizar llamadas fetch autenticadas en el Driver Portal
 * Incluye automáticamente las cookies y maneja redirección en caso de 401
 */
export function useDriverFetch() {
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    // If unauthorized, redirect to login
    if (response.status === 401) {
      console.log('[Driver Fetch] Unauthorized - redirecting to login')
      if (typeof window !== 'undefined') {
        window.location.href = '/driver/login'
      }
      throw new Error('Unauthorized')
    }

    return response
  }

  return { fetchWithAuth }
}

/**
 * Helper function para llamadas fetch autenticadas sin usar el hook
 */
export async function driverFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Always include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  // If unauthorized, redirect to login
  if (response.status === 401) {
    console.log('[Driver Fetch] Unauthorized - redirecting to login')
    if (typeof window !== 'undefined') {
      window.location.href = '/driver/login'
    }
    throw new Error('Unauthorized')
  }

  return response
}
