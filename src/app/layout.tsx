import './globals.css'
import '@/styles/brand-colors.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ThemeProvider } from '@/contexts/theme-context'
import { BrandProvider } from '@/contexts/brand-context'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { CompanyProvider } from '@/contexts/company-context'
import NotificationPopup from '@/components/ui/NotificationPopup'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ServiSumic - Plataforma de Logistica y Entrega',
  description: 'Plataforma integral de logistica, envios y entrega de paquetes con rastreo en tiempo real',
  manifest: '/manifest.json',
  themeColor: '#e86c00',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ServiSumic',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <BrandProvider>
          <ThemeProvider>
            <AuthProvider>
              <CompanyProvider>
                <NotificationProvider>
                  {children}
                  <NotificationPopup />
                </NotificationProvider>
              </CompanyProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrandProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}