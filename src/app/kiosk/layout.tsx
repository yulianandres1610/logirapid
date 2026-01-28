import { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Kiosco de Asistencia - LogiRapid',
  description: 'Sistema de control de asistencia para empleados',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4f46e5',
}

export default function KioskLayout({
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
