'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DriverPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to routes page
    router.replace('/driver/routes')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-sm">Cargando...</p>
      </div>
    </div>
  )
}
