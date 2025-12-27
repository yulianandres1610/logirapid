'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User,
  Loader2,
  Mail,
  Phone,
  Building2,
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
      {/* Header - Responsive */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 md:px-8 md:py-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
            <p className="text-sm text-gray-500">Informacion de tu cuenta</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 md:px-8 md:py-8 lg:px-12 pb-24 md:pb-8 space-y-5 md:space-y-8">
        {profile && (
          <>
            {/* Profile Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl md:rounded-3xl p-5 md:p-8 text-white shadow-lg"
            >
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl md:text-3xl font-bold truncate">{profile.name}</h2>
                  {profile.legalName && (
                    <p className="text-white/70 text-sm md:text-base truncate">{profile.legalName}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="px-3 py-1 bg-white/20 rounded-lg text-xs md:text-sm font-mono">
                      {profile.code}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Desktop Layout: Contact + Banks side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8">
              {/* Contact Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">Contacto</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="flex items-center gap-3 md:gap-4 px-5 py-4 md:px-6 md:py-5">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500">Email</p>
                      <p className="text-gray-900 dark:text-white text-sm md:text-base truncate">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:gap-4 px-5 py-4 md:px-6 md:py-5">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm text-gray-500">Telefono</p>
                      <p className="text-gray-900 dark:text-white text-sm md:text-base">{profile.phone || 'No registrado'}</p>
                    </div>
                  </div>
                  {profile.address && (
                    <div className="flex items-center gap-3 md:gap-4 px-5 py-4 md:px-6 md:py-5">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm text-gray-500">Direccion</p>
                        <p className="text-gray-900 dark:text-white text-sm md:text-base">{profile.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Bank Accounts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">Cuentas Bancarias</h3>
                </div>
                {profile.bankAccounts && profile.bankAccounts.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {profile.bankAccounts.map((account) => (
                      <div key={account.id} className="flex items-center gap-3 md:gap-4 px-5 py-4 md:px-6 md:py-5">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white text-sm md:text-base">{account.bankName}</p>
                          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
                            <span className="font-mono">****{account.accountNumber.slice(-4)}</span>
                            <span>•</span>
                            <span className="capitalize">{account.accountType}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 md:py-12 text-center">
                    <CreditCard className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No hay cuentas registradas</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Logout Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full md:w-auto md:min-w-[300px] bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 shadow-sm flex items-center justify-between text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                  <LogOut className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <span className="font-medium text-base md:text-lg">
                  {loggingOut ? 'Cerrando sesion...' : 'Cerrar Sesion'}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </motion.button>
          </>
        )}
      </main>
    </div>
  )
}
