'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ClipboardCheck, Warehouse, History } from 'lucide-react'
import { motion } from 'framer-motion'

interface User {
  id: number
  email: string
  name: string
  role: string
  companyId: number
  companyName: string
  companyType: string
}

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get user from localStorage
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch {
        console.error('Error parsing user from localStorage')
      }
    }
    setIsLoading(false)
  }, [])

  const handleLogout = async () => {
    // Clear cookies
    const cookiesToClear = [
      'auth-token', 'user-id', 'user-name', 'user-email',
      'user-role', 'user-company-id', 'user-company-name', 'user-company-type'
    ]

    cookiesToClear.forEach(name => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.logirapid.com`
    })

    // Clear localStorage
    localStorage.removeItem('user')
    localStorage.removeItem('auth-token')

    // Redirect to login
    window.location.href = '/audit/login'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20">
                <ClipboardCheck className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Portal Auditoría</h1>
                <p className="text-xs text-gray-400">{user?.companyName || 'LogiRapid'}</p>
              </div>
            </div>

            {/* User Info and Logout */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-400">Auditor</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
