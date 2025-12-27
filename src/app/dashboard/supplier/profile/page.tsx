'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User,
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Building2,
  Hash,
  CreditCard,
  LogOut,
  ChevronRight
} from 'lucide-react'

interface SupplierProfile {
  id: number
  code: string
  name: string
  legalName: string | null
  email: string
  phone: string
  address: string | null
  bankAccounts: Array<{
    id: number
    bankName: string
    accountNumber: string
    accountType: string
  }>
}

export default function SupplierProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/supplier/profile')
      const data = await response.json()

      if (data.success) {
        setProfile(data.data)
      } else if (response.status === 401) {
        router.push('/supplier/login')
      }
    } catch {
      console.error('Error fetching profile')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/supplier/auth', { method: 'DELETE' })

      // Clear cookies
      if (typeof window !== 'undefined') {
        const cookies = ['supplier-token', 'supplier-id', 'supplier-code', 'supplier-name']
        cookies.forEach(cookie => {
          document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        })
      }

      window.location.href = '/supplier/login'
    } catch {
      window.location.href = '/supplier/login'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/supplier')}
            className="p-2 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-teal-600" />
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 md:py-8 space-y-5">
        {profile && (
          <>
            {/* Profile Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{profile.name}</h2>
                  {profile.legalName && (
                    <p className="text-white/70 text-sm truncate">{profile.legalName}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-mono">
                      {profile.code}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">Contacto</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-gray-900 dark:text-white truncate">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500">Telefono</p>
                    <p className="text-gray-900 dark:text-white">{profile.phone || 'No registrado'}</p>
                  </div>
                </div>
                {profile.address && (
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">Direccion</p>
                      <p className="text-gray-900 dark:text-white">{profile.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Bank Accounts */}
            {profile.bankAccounts && profile.bankAccounts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-gray-900 dark:text-white">Cuentas Bancarias</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {profile.bankAccounts.map((account) => (
                    <div key={account.id} className="flex items-center gap-3 px-5 py-4">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{account.bankName}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="font-mono">****{account.accountNumber.slice(-4)}</span>
                          <span>•</span>
                          <span className="capitalize">{account.accountType}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Logout Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm flex items-center justify-between text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="font-medium">
                  {loggingOut ? 'Cerrando sesion...' : 'Cerrar Sesion'}
                </span>
              </div>
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          </>
        )}
      </main>
    </div>
  )
}
