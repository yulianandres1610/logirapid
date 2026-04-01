'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShoppingBag } from 'lucide-react'

export default function CatalogResolvePage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    const resolve = async () => {
      try {
        const host = window.location.hostname
        // Try to find catalog by custom_domain or by extracting slug from subdomain
        const res = await fetch(`/api/public/catalog/resolve?host=${encodeURIComponent(host)}`)
        const data = await res.json()
        if (data.success && data.slug) {
          router.replace(`/catalog/${data.slug}`)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      }
    }
    resolve()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Catálogo no encontrado</h1>
          <p className="text-gray-500">No se encontró un catálogo para este dominio</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
    </div>
  )
}
