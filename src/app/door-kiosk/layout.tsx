import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'ServiSumic - Control de Puerta',
  description: 'Sistema de control de acceso y visitantes',
  manifest: '/door-kiosk-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Puerta',
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/icons/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#e86c00',
}

export default function DoorKioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen overflow-hidden">
      {children}
    </div>
  )
}
