'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated and redirect accordingly
    const token = localStorage.getItem('auth-token')
    if (token) {
      router.push('/dashboard/admin')
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Redirigiendo...</p>
      </div>
    </div>
  )
}