'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BrokerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verify user has broker access
    const checkAccess = async () => {
      try {
        const response = await fetch('/api/broker/wallet')
        if (!response.ok) {
          // Not authorized as broker
          router.push('/dashboard')
          return
        }
        setIsAuthorized(true)
      } catch {
        router.push('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
