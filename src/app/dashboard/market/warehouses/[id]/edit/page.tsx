'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Warehouse,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  User,
  Star,
  Save,
  Loader2,
  Building,
  Settings,
  CheckCircle,
  Printer
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface WarehouseForm {
  name: string
  code: string
  isCentral: boolean
  warehouseType: string
  address: string
  city: string
  state: string
  municipality: string
  country: string
  latitude: string
  longitude: string
  managerName: string
  phone: string
  email: string
  isActive: boolean
  allowNegativeStock: boolean
  defaultPrintServiceId: number | null
}

interface PrintService {
  id: number
  name: string
  code: string
  status?: string
}

const WAREHOUSE_TYPES = [
  { value: 'storage', label: 'Almacenaje' },
  { value: 'distribution', label: 'Distribución' },
  { value: 'retail', label: 'Punto de Venta' }
]

const CUBAN_PROVINCES = [
  'Pinar del Río', 'Artemisa', 'La Habana', 'Mayabeque', 'Matanzas',
  'Cienfuegos', 'Villa Clara', 'Sancti Spíritus', 'Ciego de Ávila',
  'Camagüey', 'Las Tunas', 'Holguín', 'Granma', 'Santiago de Cuba',
  'Guantánamo', 'Isla de la Juventud'
]

export default function EditWarehousePage() {
  const { theme } = useTheme()
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [printServices, setPrintServices] = useState<PrintService[]>([])

  const [form, setForm] = useState<WarehouseForm>({
    name: '',
    code: '',
    isCentral: false,
    warehouseType: 'storage',
    address: '',
    city: '',
    state: '',
    municipality: '',
    country: 'Cuba',
    latitude: '',
    longitude: '',
    managerName: '',
    phone: '',
    email: '',
    isActive: true,
    allowNegativeStock: false,
    defaultPrintServiceId: null
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch warehouse and print services in parallel
        const [warehouseRes, printServicesRes] = await Promise.all([
          fetch(`/api/market/warehouses/${params.id}`),
          fetch('/api/market/print-services')
        ])

        const warehouseData = await warehouseRes.json()
        const printServicesData = await printServicesRes.json()

        if (printServicesData.success && printServicesData.data) {
          setPrintServices(printServicesData.data)
        }

        if (warehouseData.success) {
          const w = warehouseData.data
          setForm({
            name: w.name || '',
            code: w.code || '',
            isCentral: w.isCentral || false,
            warehouseType: w.warehouseType || 'storage',
            address: w.address || '',
            city: w.city || '',
            state: w.state || '',
            municipality: w.municipality || '',
            country: w.country || 'Cuba',
            latitude: w.latitude?.toString() || '',
            longitude: w.longitude?.toString() || '',
            managerName: w.managerName || '',
            phone: w.phone || '',
            email: w.email || '',
            isActive: w.isActive ?? true,
            allowNegativeStock: w.allowNegativeStock || false,
            defaultPrintServiceId: w.defaultPrintServiceId || null
          })
        } else {
          setError(warehouseData.error || 'Error al cargar el almacén')
        }
      } catch (err) {
        console.error('Error fetching warehouse:', err)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchData()
    }
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const response = await fetch(`/api/market/warehouses/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push(`/dashboard/market/warehouses/${params.id}`)
        }, 1500)
      } else {
        setError(data.error || 'Error al actualizar el almacén')
      }
    } catch (err) {
      console.error('Error updating warehouse:', err)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error && !form.name) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Warehouse className="w-16 h-16 text-gray-400" />
            <p className="text-lg text-gray-500">{error}</p>
            <Link href="/dashboard/market/warehouses">
              <button className="flex items-center gap-2 px-4 py-2 text-blue-500 hover:text-blue-600">
                <ArrowLeft className="w-4 h-4" />
                Volver a almacenes
              </button>
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-4xl mx-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/market/warehouses/${params.id}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-xl transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Editar Almacén
                </h1>
                <p className="text-sm text-gray-500">{form.name}</p>
              </div>
            </div>

            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              >
                <CheckCircle className="w-5 h-5" />
                Almacén actualizado exitosamente. Redirigiendo...
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              >
                {error}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-blue-500" />
                  Información Básica
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nombre *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Código *</label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      required
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Tipo</label>
                    <select
                      value={form.warehouseType}
                      onChange={(e) => setForm({ ...form, warehouseType: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    >
                      {WAREHOUSE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-6 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isCentral}
                        onChange={(e) => setForm({ ...form, isCentral: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm">Almacén Central</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <span className="text-sm">Activo</span>
                    </label>
                  </div>
                </div>
              </motion.div>

              {/* Location */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  Ubicación
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">Dirección</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Calle, número, entre calles..."
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Ciudad</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Municipio</label>
                    <input
                      type="text"
                      value={form.municipality}
                      onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Provincia</label>
                    <select
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Seleccionar...</option>
                      {CUBAN_PROVINCES.map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">País</label>
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Latitud</label>
                    <input
                      type="text"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      placeholder="Ej: 23.1365"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Longitud</label>
                    <input
                      type="text"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      placeholder="Ej: -82.3596"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Contact */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-500" />
                  Contacto
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Encargado</label>
                    <input
                      type="text"
                      value={form.managerName}
                      onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Teléfono</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Correo</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Settings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-500" />
                  Configuración
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowNegativeStock}
                      onChange={(e) => setForm({ ...form, allowNegativeStock: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-medium">Permitir Stock Negativo</span>
                      <p className="text-sm text-gray-500">Permite que el inventario tenga cantidades negativas</p>
                    </div>
                  </label>

                  {/* Print Service */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Printer className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Servicio de Impresión</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Selecciona el servicio de impresión que se usará para imprimir documentos en este almacén
                    </p>
                    <select
                      value={form.defaultPrintServiceId || ''}
                      onChange={(e) => setForm({ ...form, defaultPrintServiceId: e.target.value ? parseInt(e.target.value) : null })}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Sin servicio de impresión</option>
                      {printServices.map(ps => (
                        <option key={ps.id} value={ps.id}>
                          {ps.name} ({ps.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-4">
                <Link href={`/dashboard/market/warehouses/${params.id}`}>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'px-6 py-2.5 rounded-xl transition-colors font-medium',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    Cancelar
                  </motion.button>
                </Link>
                <motion.button
                  type="submit"
                  disabled={saving || success}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all',
                    'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25',
                    (saving || success) ? 'opacity-70 cursor-not-allowed' : 'hover:from-blue-600 hover:to-blue-700'
                  )}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : success ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Guardado
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
