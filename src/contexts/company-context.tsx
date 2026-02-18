'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface CompanyInfo {
  companyId?: string
  companyName?: string
  userRole?: string
  enabledServices?: string[]
}

interface CompanyContextType {
  companyInfo: CompanyInfo
  setCompanyInfo: (info: CompanyInfo) => void
  isLoading: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({
  children,
  initialCompanyInfo
}: {
  children: React.ReactNode
  initialCompanyInfo?: CompanyInfo
}) {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(initialCompanyInfo || {})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Skip company info loading for kiosk routes (they use PIN auth, not JWT)
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/door-kiosk')) {
      setIsLoading(false)
      return
    }

    // Intentar obtener la información de la empresa de las cookies
    // que el middleware podría haber establecido
    const getCompanyInfoFromCookies = async () => {
      try {
        const cookies = document.cookie.split(';')
        let info: CompanyInfo = {}

        cookies.forEach(cookie => {
          const [name, value] = cookie.trim().split('=')
          if (name === 'user-company-id') {
            info.companyId = decodeURIComponent(value)
          } else if (name === 'user-company-name') {
            info.companyName = decodeURIComponent(value)
          } else if (name === 'user-role') {
            info.userRole = decodeURIComponent(value)
          }
        })

        // Si es SUPER_ADMIN, no necesita servicios (acceso completo)
        if (info.userRole === 'SUPER_ADMIN') {
          info.enabledServices = []
          setCompanyInfo(info)
        }
        // Si es usuario de empresa (ADMIN, MANAGER, USER), cargar servicios
        else if (info.companyId && ['ADMIN', 'MANAGER', 'USER'].includes(info.userRole || '')) {
          try {
            const response = await fetch(`/api/companies/${info.companyId}`)
            if (response.ok) {
              const result = await response.json()
              // El endpoint retorna { success, data: { enabledServices, ... } }
              info.enabledServices = result.data?.enabledServices || []
              console.log('[CompanyContext] Loaded services for company:', info.companyId, info.enabledServices)
            } else {
              console.error('[CompanyContext] Failed to load company services:', response.status)
              info.enabledServices = []
            }
          } catch (error) {
            console.error('[CompanyContext] Error loading company services:', error)
            info.enabledServices = []
          }
          setCompanyInfo(info)
        } else {
          info.enabledServices = []
          setCompanyInfo(info)
        }
      } catch (error) {
        console.error('Error reading company info from cookies:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Si no hay información inicial, intentar obtenerla de las cookies
    if (!initialCompanyInfo?.companyId) {
      getCompanyInfoFromCookies()
    } else {
      setIsLoading(false)
    }
  }, [initialCompanyInfo])

  const value: CompanyContextType = {
    companyInfo,
    setCompanyInfo,
    isLoading
  }

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}

// Hook para verificar si el usuario es administrador de empresa
export function useIsAgencyAdmin() {
  const { companyInfo } = useCompany()
  return companyInfo.userRole === 'ADMIN'
}

// Hook para obtener el ID de la empresa actual
export function useCompanyId() {
  const { companyInfo, isLoading } = useCompany()

  if (isLoading) {
    return null
  }

  return companyInfo.companyId || null
}