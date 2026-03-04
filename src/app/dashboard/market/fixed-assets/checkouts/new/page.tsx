'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Check,
  Box,
  Search,
  User,
  Calendar,
  FileText,
  MapPin,
  Tag
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface FixedAsset {
  id: number
  assetCode: string
  name: string
  categoryName: string
  warehouseName: string
  imageUrl: string | null
  status: string
  condition: string
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  fullName: string
}

const STEPS = [
  { id: 1, title: 'Seleccionar Activo', description: 'Elige el activo a prestar' },
  { id: 2, title: 'Empleado y Detalles', description: 'Asignar responsable' }
]

export default function NewAssetCheckoutPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1 state
  const [searchTerm, setSearchTerm] = useState('')
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null)

  // Step 2 state
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [notes, setNotes] = useState('')

  // Fetch assets
  useEffect(() => {
    const fetchAssets = async () => {
      setLoadingAssets(true)
      try {
        const params = new URLSearchParams({
          limit: '50',
          status: 'active'
        })
        if (searchTerm.trim()) {
          params.set('search', searchTerm.trim())
        }
        const res = await fetch(`/api/market/fixed-assets?${params.toString()}`)
        const data = await res.json()
        if (data.success && data.data) {
          setAssets(data.data.assets || [])
        }
      } catch {
        console.error('Error fetching assets')
      } finally {
        setLoadingAssets(false)
      }
    }

    const debounce = setTimeout(fetchAssets, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  // Fetch employees when entering step 2
  useEffect(() => {
    if (currentStep === 2 && employees.length === 0) {
      const fetchEmployees = async () => {
        setLoadingEmployees(true)
        try {
          const res = await fetch('/api/market/accounting/employees?status=active')
          const data = await res.json()
          if (data.success && data.data) {
            setEmployees(data.data.employees || [])
          }
        } catch {
          console.error('Error fetching employees')
        } finally {
          setLoadingEmployees(false)
        }
      }
      fetchEmployees()
    }
  }, [currentStep, employees.length])

  const handleSubmit = async () => {
    if (!selectedAsset || !employeeId) {
      showNotification('error', 'Error', 'Debe seleccionar un activo y un empleado')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/market/fixed-assets/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          employeeId: parseInt(employeeId),
          notes: notes.trim() || null,
          expectedReturn: expectedReturn || null
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Prestamo registrado', `Se ha registrado el prestamo del activo ${selectedAsset.assetCode}`)
        router.push('/dashboard/market/fixed-assets/checkouts')
      } else {
        showNotification('error', 'Error', data.error || 'Error al registrar el prestamo')
      }
    } catch {
      showNotification('error', 'Error de conexion', 'No se pudo registrar el prestamo')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = cn(
    'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
  )

  const labelClass = cn(
    'block text-sm font-medium mb-2',
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Back Link */}
            <Link
              href="/dashboard/market/fixed-assets/checkouts"
              className={cn(
                'inline-flex items-center gap-2 text-sm transition-colors',
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Prestamos
            </Link>

            {/* Header */}
            <div>
              <h1 className={cn(
                'text-2xl sm:text-3xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nuevo Prestamo de Activo
              </h1>
              <p className={cn(
                'text-sm mt-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Registrar el prestamo de una herramienta o activo a un empleado
              </p>
            </div>

            {/* Step Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-center">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    {/* Step circle */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={{
                          scale: currentStep === step.id ? 1.1 : 1
                        }}
                        className={cn(
                          'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-300',
                          currentStep === step.id
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : currentStep > step.id
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md shadow-green-500/20'
                              : theme === 'dark'
                                ? 'bg-gray-700 text-gray-500'
                                : 'bg-gray-200 text-gray-400'
                        )}
                      >
                        {currentStep > step.id ? (
                          <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                        ) : (
                          step.id
                        )}
                      </motion.div>
                      <p className={cn(
                        'text-xs sm:text-sm font-medium mt-2 text-center',
                        currentStep === step.id
                          ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          : currentStep > step.id
                            ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {step.title}
                      </p>
                    </div>

                    {/* Connecting line */}
                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-3 sm:mx-6 mb-6 relative">
                        <div className={cn(
                          'absolute inset-0 rounded-full',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{
                            scaleX: currentStep > step.id ? 1 : 0
                          }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                          className={cn(
                            'h-full origin-left rounded-full',
                            theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                          )}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content Card */}
            <div className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <div className="p-6 sm:p-8">
                <AnimatePresence mode="wait">
                  {/* Step 1: Select Asset */}
                  {currentStep === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <h2 className={cn(
                        'text-xl font-bold flex items-center gap-3',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Box className="w-5 h-5 text-white" />
                        </div>
                        Seleccionar Activo
                      </h2>

                      {/* Search */}
                      <div className="relative">
                        <Search className={cn(
                          'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )} />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar activo por nombre, codigo..."
                          className={cn(
                            'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Assets Grid */}
                      {loadingAssets ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                      ) : assets.length === 0 ? (
                        <div className={cn(
                          'text-center py-12',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No se encontraron activos</p>
                          <p className="text-sm mt-1">Intenta con otro termino de busqueda</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-1">
                          {assets.map((asset) => (
                            <motion.div
                              key={asset.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedAsset(
                                selectedAsset?.id === asset.id ? null : asset
                              )}
                              className={cn(
                                'p-4 rounded-xl border-2 cursor-pointer transition-all',
                                selectedAsset?.id === asset.id
                                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-900/20'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                              )}
                            >
                              {/* Asset Image or Placeholder */}
                              <div className={cn(
                                'w-full h-24 rounded-lg mb-3 flex items-center justify-center overflow-hidden',
                                theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                              )}>
                                {asset.imageUrl ? (
                                  <img
                                    src={asset.imageUrl}
                                    alt={asset.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Box className={cn(
                                    'w-10 h-10',
                                    theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                                  )} />
                                )}
                              </div>

                              {/* Asset Code */}
                              <p className={cn(
                                'text-xs font-mono mb-1',
                                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                              )}>
                                {asset.assetCode}
                              </p>

                              {/* Asset Name */}
                              <p className={cn(
                                'font-semibold text-sm truncate',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {asset.name}
                              </p>

                              {/* Category */}
                              {asset.categoryName && (
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Tag className={cn(
                                    'w-3 h-3',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <p className={cn(
                                    'text-xs truncate',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  )}>
                                    {asset.categoryName}
                                  </p>
                                </div>
                              )}

                              {/* Warehouse */}
                              {asset.warehouseName && (
                                <div className="flex items-center gap-1 mt-1">
                                  <MapPin className={cn(
                                    'w-3 h-3',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <p className={cn(
                                    'text-xs truncate',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  )}>
                                    {asset.warehouseName}
                                  </p>
                                </div>
                              )}

                              {/* Selected indicator */}
                              {selectedAsset?.id === asset.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
                                >
                                  <Check className="w-4 h-4 text-white" />
                                </motion.div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Next Button */}
                      <div className="flex justify-end pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCurrentStep(2)}
                          disabled={!selectedAsset}
                          className={cn(
                            'px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 font-medium transition-all',
                            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-blue-600'
                          )}
                        >
                          Siguiente
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Employee & Details */}
                  {currentStep === 2 && selectedAsset && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <h2 className={cn(
                        'text-xl font-bold flex items-center gap-3',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        Empleado y Detalles
                      </h2>

                      {/* Selected Asset Summary */}
                      <div className={cn(
                        'p-4 rounded-xl border flex items-center gap-4',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700'
                          : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className={cn(
                          'w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden',
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                        )}>
                          {selectedAsset.imageUrl ? (
                            <img
                              src={selectedAsset.imageUrl}
                              alt={selectedAsset.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Box className={cn(
                              'w-8 h-8',
                              theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                            )} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-semibold truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {selectedAsset.name}
                          </p>
                          <p className={cn(
                            'text-sm font-mono',
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )}>
                            {selectedAsset.assetCode}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {selectedAsset.categoryName && (
                              <span className={cn(
                                'text-xs flex items-center gap-1',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                <Tag className="w-3 h-3" />
                                {selectedAsset.categoryName}
                              </span>
                            )}
                            {selectedAsset.warehouseName && (
                              <span className={cn(
                                'text-xs flex items-center gap-1',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                <MapPin className="w-3 h-3" />
                                {selectedAsset.warehouseName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Form Fields */}
                      <div className="space-y-5">
                        {/* Employee Select */}
                        <div>
                          <label className={labelClass}>
                            <User className="w-4 h-4 inline mr-1.5" />
                            Empleado *
                          </label>
                          {loadingEmployees ? (
                            <div className="flex items-center gap-2 py-2.5">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                Cargando empleados...
                              </span>
                            </div>
                          ) : (
                            <select
                              value={employeeId}
                              onChange={(e) => setEmployeeId(e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Seleccionar empleado</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Expected Return Date */}
                        <div>
                          <label className={labelClass}>
                            <Calendar className="w-4 h-4 inline mr-1.5" />
                            Fecha esperada de devolucion
                          </label>
                          <input
                            type="date"
                            value={expectedReturn}
                            onChange={(e) => setExpectedReturn(e.target.value)}
                            className={inputClass}
                          />
                          <p className={cn(
                            'text-xs mt-1',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            Opcional. Dejar vacio si no hay fecha limite.
                          </p>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className={labelClass}>
                            <FileText className="w-4 h-4 inline mr-1.5" />
                            Notas
                          </label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas adicionales sobre el prestamo..."
                            rows={3}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-between items-center pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCurrentStep(1)}
                          className={cn(
                            'px-6 py-3 rounded-xl transition-all font-medium',
                            theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          )}
                        >
                          <ArrowLeft className="w-4 h-4 inline mr-2" />
                          Atras
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSubmit}
                          disabled={loading || !employeeId}
                          className={cn(
                            'px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 font-medium transition-all',
                            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-blue-600'
                          )}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                              Registrando...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 inline mr-2" />
                              Registrar Prestamo
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
