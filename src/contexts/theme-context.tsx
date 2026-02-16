'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { detectBrandFromHost, brands } from '@/lib/brand-config'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detectar la marca para obtener el tema por defecto
      const host = window.location.hostname
      const brandName = detectBrandFromHost(host)
      const brandDefaultTheme = brands[brandName].defaultTheme

      // Verificar si hay un tema guardado
      const savedTheme = localStorage.getItem('theme') as Theme | null

      if (savedTheme) {
        // Usar el tema guardado por el usuario
        setThemeState(savedTheme)
      } else {
        // Usar el tema por defecto de la marca
        // - LogiRapid: dark
        // - Servisumic: light
        setThemeState(brandDefaultTheme)
        localStorage.setItem('theme', brandDefaultTheme)
      }
    }
  }, [])

  useEffect(() => {
    // Apply theme to document and save preference
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(theme)
      localStorage.setItem('theme', theme)
    }
  }, [theme])

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}