'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Fingerprint,
  Plus,
  Edit,
  Trash2,
  Warehouse,
  Monitor,
  Wifi,
  WifiOff,
  ExternalLink,
  X,
  Copy,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Kiosk {
  id: number
  name: string
  location: string | null
  deviceId: string
  warehouseId: number | null
  warehouseName: string | null
  warehouseAddress: string | null
  isActive: boolean
  lastPing: string | null
  settings: any
  createdAt: string
}

interface WarehouseOption {
  id: number
  name: string
  address: string | null
}

export default function KiosksPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    warehouseId: ''
  })

  useEffect(() => {
    fetchKiosks()
    fetchWarehouses()
  }, [])

  const fetchKiosks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/market/hr/kiosks?status=all')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setKiosks(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching kiosks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses(result.data.map((w: any) => ({
            id: w.id,
            name: w.name,
            address: w.address
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingKiosk
        ? `/api/market/hr/kiosks/${editingKiosk.id}`
        : '/api/market/hr/kiosks'

      const response = await fetch(url, {
        method: editingKiosk ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          location: formData.location || null,
          warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : null
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowModal(false)
          setEditingKiosk(null)
          setFormData({ name: '', location: '', warehouseId: '' })
          fetchKiosks()
        }
      }
    } catch (error) {
      console.error('Error saving kiosk:', error)
    }
  }

  const handleEdit = (kiosk: Kiosk) => {
    setEditingKiosk(kiosk)
    setFormData({
      name: kiosk.name,
      location: kiosk.location || '',
      warehouseId: kiosk.warehouseId?.toString() || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de desactivar este kiosco?')) return

    try {
      const response = await fetch(`/api/market/hr/kiosks/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchKiosks()
      }
    } catch (error) {
      console.error('Error deleting kiosk:', error)
    }
  }

  const copyDeviceId = (deviceId: string) => {
    navigator.clipboard.writeText(deviceId)
    setCopied(deviceId)
    setTimeout(() => setCopied(null), 2000)
  }

  const isOnline = (lastPing: string | null) => {
    if (!lastPing) return false
    const pingTime = new Date(lastPing).getTime()
    const now = Date.now()
    return (now - pingTime) < 5 * 60 * 1000 // 5 minutes
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Fingerprint className="w-8 h-8 text-indigo-600" />
                Kioscos de Asistencia
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {kiosks.filter(k => k.isActive).length} kioscos activos
              </p>
            </div>
            <button
              onClick={() => {
                setEditingKiosk(null)
                setFormData({ name: '', location: '', warehouseId: '' })
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Kiosco
            </button>
          </motion.div>

          {/* Info Banner */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Monitor className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-indigo-800 dark:text-indigo-300">
                  ¿Cómo funciona?
                </h3>
                <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">
                  Los kioscos permiten a los empleados registrar su entrada y salida usando PIN, badge o reconocimiento facial.
                  Configura un dispositivo (tablet/computadora) y accede a la URL del kiosco para comenzar.
                </p>
              </div>
            </div>
          </div>

          {/* Kiosks Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : kiosks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
            >
              <Fingerprint className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay kioscos
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crea un kiosco para permitir el registro de asistencia
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kiosks.map((kiosk, idx) => (
                <motion.div
                  key={kiosk.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg ${!kiosk.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        kiosk.isActive && isOnline(kiosk.lastPing)
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Fingerprint className={`w-6 h-6 ${
                          kiosk.isActive && isOnline(kiosk.lastPing)
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {kiosk.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {kiosk.isActive && isOnline(kiosk.lastPing) ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Wifi className="w-3 h-3" />
                              En línea
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <WifiOff className="w-3 h-3" />
                              Sin conexión
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(kiosk)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      {kiosk.isActive && (
                        <button
                          onClick={() => handleDelete(kiosk.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {kiosk.location && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      📍 {kiosk.location}
                    </p>
                  )}

                  {kiosk.warehouseName && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <Warehouse className="w-4 h-4" />
                      {kiosk.warehouseName}
                    </div>
                  )}

                  {/* Device ID */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-3">
                    <p className="text-xs text-gray-500 mb-1">ID del Dispositivo</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">
                        {kiosk.deviceId}
                      </code>
                      <button
                        onClick={() => copyDeviceId(kiosk.deviceId)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        {copied === kiosk.deviceId ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Open Kiosk Button */}
                  {kiosk.isActive && (
                    <Link
                      href={`/dashboard/market/hr/kiosks/${kiosk.id}`}
                      target="_blank"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir Kiosco
                    </Link>
                  )}

                  {!kiosk.isActive && (
                    <div className="text-center py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-500">
                      Kiosco desactivado
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingKiosk ? 'Editar Kiosco' : 'Nuevo Kiosco'}
                    </h2>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ej: Kiosco Entrada Principal"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ej: Recepción, Piso 1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Almacén (opcional)
                    </label>
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Sin almacén asociado</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                    >
                      {editingKiosk ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
