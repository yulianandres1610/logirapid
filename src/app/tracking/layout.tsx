import { PublicHeader } from '@/components/public/Header'
import { PublicFooter } from '@/components/public/Footer'

export const metadata = {
  title: 'Rastrear Paquete - LogiRapid',
  description: 'Rastrea tu paquete en tiempo real con LogiRapid. Ingresa tu número de orden para ver el estado de tu envío.',
}

export default function TrackingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
