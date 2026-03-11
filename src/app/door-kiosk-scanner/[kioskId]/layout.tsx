import { Metadata, Viewport } from 'next'

interface Props {
  children: React.ReactNode
  params: Promise<{ kioskId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kioskId } = await params

  return {
    title: 'ServiSumic - Control de Puerta',
    description: 'Sistema de control de acceso con escáner',
    manifest: `/api/market/door-security/kiosks/${kioskId}/manifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'Puerta Scanner',
    },
    icons: {
      icon: '/favicon.png',
      shortcut: '/favicon.png',
      apple: '/icons/icon-192x192.png',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#e86c00',
}

export default function KioskScannerLayout({ children }: Props) {
  return <>{children}</>
}
