'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Save,
  Box,
  Tag,
  MapPin,
  User,
  Calendar,
  DollarSign,
  FileText,
  Barcode
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface Category {
  id: number
  name: string
  code: string
}

interface Warehouse {
  id: number
  name: string
}

interface Employee {
  id: number
  first_name: string
  last_name: string
  position: string
}

interface Supplier {
  id: number
  name: string
}

const ASSET_TYPES = [
  { value: 'hardware', label: 'Hardware/Equipos de Cómputo' },
  { value: 'furniture', label: 'Mobiliario' },
  { value: 'equipment', label: 'Equipamiento' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'other', label: 'Otro' }
]

const CONDITIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'good', label: 'Bueno' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Malo' }
]

export default function NewFixedAssetPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    assetType: '',
    warehouseId: '',
    locationCode: '',
    responsibleEmployeeId: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
    acquisitionCost: '',
    currency: 'USD',
    currentValue: '',
    supplierId: '',
    invoiceNumber: '',
    serialNumber: '',
    brand: '',
    model: '',
    condition: 'good',
    notes: '',
    imageUrl: ''
  })

  // Fetch data for dropdowns
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, whRes, empRes, supRes] = await Promise.all([
          fetch('/api/market/fixed-assets/categories?flat=true'),
          fetch('/api/market/warehouses'),
          fetch('/api/market/accounting/employees'),
          fetch('/api/market/suppliers')
        ])

        const [catData, whData, empData, supData] = await Promise.all([
          catRes.json(),
          whRes.json(),
          empRes.json(),
          supRes.json()
        ])

        if (catData.success) setCategories(catData.data)
        if (whData.success) setWarehouses(whData.data.warehouses || whData.data || [])
        if (empData.success) setEmployees(empData.data.employees || empData.data || [])
        if (supData.success) setSuppliers(supData.data.suppliers || supData.data || [])
      } catch {
        console.error('Error fetching form data')
      }
    }
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      showNotification('error', 'Error', 'El nombre del activo es requerido')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/market/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          categoryId: form.categoryId ? parseInt(form.categoryId) : null,
          assetType: form.assetType || null,
          warehouseId: form.warehouseId ? parseInt(form.warehouseId) : null,
          locationCode: form.locationCode || null,
          responsibleEmployeeId: form.responsibleEmployeeId ? parseInt(form.responsibleEmployeeId) : null,
          acquisitionDate: form.acquisitionDate || null,
          acquisitionCost: form.acquisitionCost ? parseFloat(form.acquisitionCost) : null,
          currency: form.currency,
          currentValue: form.currentValue ? parseFloat(form.currentValue) : null,
          supplierId: form.supplierId ? parseInt(form.supplierId) : null,
          invoiceNumber: form.invoiceNumber || null,
          serialNumber: form.serialNumber || null,
          brand: form.brand || null,
          model: form.model || null,
          condition: form.condition,
          notes: form.notes || null,
          imageUrl: form.imageUrl || null
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Activo creado', `Se ha creado el activo ${data.data.assetCode}`)
        router.push(`/dashboard/market/fixed-assets/${data.data.id}`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear el activo')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo crear el activo')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = cn(
    "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
    theme === 'dark'
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  )

  const labelClass = cn(
    "block text-sm font-medium mb-1",
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/market/fixed-assets"
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                )}
              >
                <ArrowLeft className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )} />
              </Link>
              <div>
                <h1 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Nuevo Activo Fijo
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Registrar un nuevo activo en el inventario
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className={cn(
                "p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <h2 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Box className="w-5 h-5 text-blue-500" />
                  Información Básica
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>
                      Nombre del Activo *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ej: Servidor Dell PowerEdge R740"
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Descripción</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Descripción detallada del activo..."
                      rows={3}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Categoría</label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Seleccionar categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.code ? `[${cat.code}] ` : ''}{cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Tipo de Activo</label>
                    <select
                      value={form.assetType}
                      onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Seleccionar tipo</option>
                      {ASSET_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className={cn(
                "p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <h2 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <MapPin className="w-5 h-5 text-green-500" />
                  Ubicación y Responsable
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Almacén/Ubicación</label>
                    <select
                      value={form.warehouseId}
                      onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Seleccionar ubicación</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Código de Ubicación</label>
                    <input
                      type="text"
                      value={form.locationCode}
                      onChange={(e) => setForm({ ...form, locationCode: e.target.value })}
                      placeholder="Ej: Oficina 201, Rack A3"
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Responsable</label>
                    <select
                      value={form.responsibleEmployeeId}
                      onChange={(e) => setForm({ ...form, responsibleEmployeeId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Seleccionar responsable</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} {emp.position ? `- ${emp.position}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div className={cn(
                "p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <h2 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <DollarSign className="w-5 h-5 text-yellow-500" />
                  Información Financiera
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Fecha de Adquisición</label>
                    <input
                      type="date"
                      value={form.acquisitionDate}
                      onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Costo de Adquisición</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={form.acquisitionCost}
                        onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                        placeholder="0.00"
                        className={cn(inputClass, "flex-1")}
                      />
                      <select
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        className={cn(inputClass, "w-24")}
                      >
                        <option value="USD">USD</option>
                        <option value="CUP">CUP</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Valor Actual</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.currentValue}
                      onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                      placeholder="Dejar vacío para usar costo de adquisición"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Proveedor</label>
                    <select
                      value={form.supplierId}
                      onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Seleccionar proveedor</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Número de Factura</label>
                    <input
                      type="text"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                      placeholder="Ej: FAC-2025-001"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Technical Info */}
              <div className={cn(
                "p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <h2 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Barcode className="w-5 h-5 text-purple-500" />
                  Información Técnica
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Número de Serie</label>
                    <input
                      type="text"
                      value={form.serialNumber}
                      onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                      placeholder="Ej: SN123456789"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Marca</label>
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      placeholder="Ej: Dell, HP, Lenovo"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Modelo</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="Ej: PowerEdge R740"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Condición</label>
                    <select
                      value={form.condition}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      className={inputClass}
                    >
                      {CONDITIONS.map(cond => (
                        <option key={cond.value} value={cond.value}>{cond.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Notas</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Notas adicionales..."
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4">
                <Link
                  href="/dashboard/market/fixed-assets"
                  className={cn(
                    "px-6 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-lg transition-colors",
                    "bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Crear Activo
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
