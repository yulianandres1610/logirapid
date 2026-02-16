import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Control de Puerta - LogiRapid',
  description: 'Sistema de seguridad y control de acceso para visitantes',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f766e',
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
