'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Esta página ha sido deprecada.
 * La configuración de tasas de agencias ahora se gestiona desde
 * /dashboard/admin/exchange-rate?tab=agency
 *
 * Redirección automática a la nueva ubicación.
 */
export default function DeprecatedAgencyRatesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/admin/exchange-rate?tab=agency')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-exa-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Redirigiendo a configuración de tasas...</p>
      </div>
    </div>
  )
}
