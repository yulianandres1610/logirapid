export type BrandName = 'logirapid' | 'servisumic'

export interface BrandConfig {
  name: BrandName
  displayName: string
  colors: {
    primary: string
    primaryHover: string
    secondary: string
    secondaryHover: string
    // Versiones más brillantes para tema oscuro
    primaryLight: string
    secondaryLight: string
  }
  logos: {
    light: string  // Para fondos claros (logo oscuro/color)
    dark: string   // Para fondos oscuros (logo blanco)
  }
  defaultTheme: 'light' | 'dark'
  footer: string
}

export const brands: Record<BrandName, BrandConfig> = {
  logirapid: {
    name: 'logirapid',
    displayName: 'LogiRapid',
    colors: {
      primary: '#cc0a46',
      primaryHover: '#a50837',
      primaryLight: '#e61e5c',
      secondary: '#0374e5',
      secondaryHover: '#0260bf',
      secondaryLight: '#3d8ef7',
    },
    logos: {
      light: '/images/negro.png',
      dark: '/images/blanco.png',
    },
    defaultTheme: 'dark',
    footer: '© 2024 LogiRapid. Todos los derechos reservados.',
  },
  servisumic: {
    name: 'servisumic',
    displayName: 'Servisumic',
    colors: {
      primary: '#eb5b0c',
      primaryHover: '#d14f09',
      primaryLight: '#fb923c',
      secondary: '#3f3b39',
      secondaryHover: '#2d2a28',
      secondaryLight: '#78716c',
    },
    logos: {
      light: '/images/servisumic/color.png',
      dark: '/images/servisumic/blanco.png',
    },
    defaultTheme: 'light',
    footer: '© 2024 Servisumic. Todos los derechos reservados.',
  },
}

/**
 * Detecta la marca basándose en el hostname
 */
export function detectBrandFromHost(hostname: string): BrandName {
  if (hostname.includes('servisumic')) {
    return 'servisumic'
  }
  return 'logirapid'
}

/**
 * Obtiene la configuración de marca basándose en el hostname
 */
export function getBrandConfig(hostname: string): BrandConfig {
  const brandName = detectBrandFromHost(hostname)
  return brands[brandName]
}
