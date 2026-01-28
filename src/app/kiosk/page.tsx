'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Fingerprint, MapPin, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react'

interface Kiosk {
  id: number
  name: string
  location: string | null
  deviceId: string
  isActive: boolean
}

export default function KioskSelectorPage() {
  const router = useRouter()
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kioskIdInput, setKioskIdInput] = useState('')

  useEffect(() => {
    // Check if there's a saved kiosk ID in localStorage
    const savedKioskId = localStorage.getItem('attendance-kiosk-id')
    if (savedKioskId) {
      router.push(`/kiosk/${savedKioskId}`)
      return
    }

    fetchKiosks()
  }, [router])

  const fetchKiosks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/market/hr/kiosks')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setKiosks(result.data.filter((k: Kiosk) => k.isActive))
        }
      }
    } catch (err) {
      console.error('Error fetching kiosks:', err)
      setError('Error al cargar los kioscos')
    } finally {
      setLoading(false)
    }
  }

  const selectKiosk = (kioskId: number) => {
    // Save to localStorage for auto-redirect next time
    localStorage.setItem('attendance-kiosk-id', kioskId.toString())
    router.push(`/kiosk/${kioskId}`)
  }

  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault()
    const id = parseInt(kioskIdInput)
    if (!isNaN(id) && id > 0) {
      selectKiosk(id)
    }
  }

  const clearSavedKiosk = () => {
    localStorage.removeItem('attendance-kiosk-id')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      {/* Logo/Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Fingerprint className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Control de Asistencia
        </h1>
        <p className="text-indigo-200">
          Selecciona el kiosco para comenzar
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchKiosks}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Reintentar
            </button>
          </div>
        ) : kiosks.length > 0 ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Kioscos Disponibles
            </h2>
            <div className="space-y-3">
              {kiosks.map((kiosk) => (
                <button
                  key={kiosk.id}
                  onClick={() => selectKiosk(kiosk.id)}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-indigo-50 rounded-xl transition-colors text-left group"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{kiosk.name}</p>
                    {kiosk.location && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {kiosk.location}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Fingerprint className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              No hay kioscos configurados
            </p>
          </div>
        )}

        {/* Manual ID Entry */}
        <div className="border-t p-6">
          <form onSubmit={handleManualEntry} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              O ingresa el ID del kiosco manualmente:
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={kioskIdInput}
                onChange={(e) => setKioskIdInput(e.target.value)}
                placeholder="ID del Kiosco"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!kioskIdInput}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ir
              </button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Footer */}
      <p className="text-indigo-200 text-sm mt-8">
        asistencia.logirapid.com
      </p>
    </div>
  )
}
