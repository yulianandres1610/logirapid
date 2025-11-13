import './globals.css'
import '@/styles/brand-colors.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ThemeProvider } from '@/contexts/theme-context'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CUBARAPID - Plataforma Multi-Servicios',
  description: 'Plataforma integral para la gestión de remesas, recargas, renta de autos, pasajes y mercado',
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
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}