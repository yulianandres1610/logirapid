'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { brands, BrandConfig, BrandName, detectBrandFromHost } from '@/lib/brand-config'

interface BrandContextType {
  brand: BrandConfig
  brandName: BrandName
  isServisumic: boolean
  isLogirapid: boolean
}

const BrandContext = createContext<BrandContextType | null>(null)

interface BrandProviderProps {
  children: ReactNode
}

export function BrandProvider({ children }: BrandProviderProps) {
  const [brandName, setBrandName] = useState<BrandName>('logirapid')
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    const detectedBrand = detectBrandFromHost(host)
    setBrandName(detectedBrand)

    // Inyectar CSS variables
    const config = brands[detectedBrand]
    const root = document.documentElement

    root.style.setProperty('--brand-primary', config.colors.primary)
    root.style.setProperty('--brand-primary-hover', config.colors.primaryHover)
    root.style.setProperty('--brand-primary-light', config.colors.primaryLight)
    root.style.setProperty('--brand-secondary', config.colors.secondary)
    root.style.setProperty('--brand-secondary-hover', config.colors.secondaryHover)
    root.style.setProperty('--brand-secondary-light', config.colors.secondaryLight)

    // Agregar clase de marca al html para estilos CSS específicos
    root.classList.remove('brand-logirapid', 'brand-servisumic')
    root.classList.add(`brand-${detectedBrand}`)

    setIsHydrated(true)
  }, [])

  const brand = brands[brandName]

  const value: BrandContextType = {
    brand,
    brandName,
    isServisumic: brandName === 'servisumic',
    isLogirapid: brandName === 'logirapid',
  }

  // Renderizar children incluso antes de hidratación para evitar flicker
  // Las CSS variables tienen valores por defecto en globals.css
  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  const context = useContext(BrandContext)
  if (!context) {
    throw new Error('useBrand must be used within BrandProvider')
  }
  return context
}

/**
 * Hook seguro que devuelve valores por defecto si no hay BrandProvider
 * Útil para componentes que pueden renderizarse fuera del provider
 */
export function useBrandSafe(): BrandContextType {
  const context = useContext(BrandContext)
  if (!context) {
    return {
      brand: brands.logirapid,
      brandName: 'logirapid',
      isServisumic: false,
      isLogirapid: true,
    }
  }
  return context
}
