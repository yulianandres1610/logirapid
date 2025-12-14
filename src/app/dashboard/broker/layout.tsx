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
          // Not authorized as broker - redirect to login
          console.error('[Broker Layout] Not authorized, status:', response.status)
          router.push('/login')
          return
        }
        setIsAuthorized(true)
      } catch (error) {
        console.error('[Broker Layout] Error checking access:', error)
        router.push('/login')
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
