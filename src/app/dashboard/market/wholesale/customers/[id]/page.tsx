'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Clock,
  Receipt
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Pricelist {
  id: number
  name: string
  currency: string
}

interface Customer {
  id: number
  code: string
  businessName: string
  legalName: string | null
  taxId: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  pricelistId: number | null
  pricelistName: string | null
  creditLimit: number
  creditDays: number
  currentBalance: number
  status: string
  notes: string | null
  salesSummary: {
    totalInvoices: number
    totalSales: number
    totalPending: number
  }
}

const STEPS = [
  { key: 'info', label: 'Información', icon: Building2 },
  { key: 'contact', label: 'Contacto', icon: User },
  { key: 'credit', label: 'Crédito', icon: CreditCard },
  { key: 'confirm', label: 'Confirmar', icon: CheckCircle }
]

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const router = useRouter()
  const resolvedParams = use(params)
  const customerId = resolvedParams.id

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [pricelists, setPricelists] = useState<Pricelist[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    businessName: '',
    legalName: '',
    taxId: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'Cuba',
    pricelistId: '',
    creditLimit: '',
    creditDays: '',
    status: 'active',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [customerId])

  const fetchData = async () => {
    try {
      const [customerRes, pricelistsRes] = await Promise.all([
        fetch(`/api/market/wholesale/customers/${customerId}`),
        fetch('/api/market/pricelists')
      ])

      if (customerRes.ok) {
        const result = await customerRes.json()
        if (result.success) {
          setCustomer(result.data)
          setFormData({
            businessName: result.data.businessName || '',
            legalName: result.data.legalName || '',
            taxId: result.data.taxId || '',
            contactName: result.data.contactName || '',
            email: result.data.email || '',
            phone: result.data.phone || '',
            address: result.data.address || '',
            city: result.data.city || '',
            state: result.data.state || '',
            country: result.data.country || 'Cuba',
            pricelistId: result.data.pricelistId?.toString() || '',
            creditLimit: result.data.creditLimit?.toString() || '',
            creditDays: result.data.creditDays?.toString() || '',
            status: result.data.status || 'active',
            notes: result.data.notes || ''
          })
        }
      }

      if (pricelistsRes.ok) {
        const result = await pricelistsRes.json()
        if (result.success) {
          setPricelists(result.data?.pricelists || [])
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.businessName.trim()) {
      setError('El nombre comercial es requerido')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/market/wholesale/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          legalName: formData.legalName || null,
          taxId: formData.taxId || null,
          contactName: formData.contactName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          country: formData.country || 'Cuba',
          pricelistId: formData.pricelistId ? parseInt(formData.pricelistId) : null,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
          creditDays: formData.creditDays ? parseInt(formData.creditDays) : 0,
          status: formData.status,
          notes: formData.notes || null
        })
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard/market/wholesale/customers')
        }, 1500)
      } else {
        const result = await response.json()
        setError(result.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error saving:', error)
      setError('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!customer) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <p className="text-lg text-gray-500">Cliente no encontrado</p>
            <Link href="/dashboard/market/wholesale/customers">
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg">
                Volver a Clientes
              </button>
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (success) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center"
            >
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </motion.div>
            <p className="text-xl font-medium text-emerald-600">Cliente actualizado exitosamente</p>
            <p className="text-gray-500">Redirigiendo...</p>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          'min-h-screen p-6',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Link href="/dashboard/market/wholesale/customers">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'
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
                  Editar Cliente
                </h1>
                <p className="text-gray-500">{customer.code} - {customer.businessName}</p>
              </div>
            </div>

            {/* Customer Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-500">Total Facturas</span>
                </div>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {customer.salesSummary.totalInvoices}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-sm text-gray-500">Total Ventas</span>
                </div>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {formatCurrency(customer.salesSummary.totalSales)}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="text-sm text-gray-500">Pendiente</span>
                </div>
                <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {formatCurrency(customer.salesSummary.totalPending)}
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon
                const isActive = index === currentStep
                const isCompleted = index < currentStep

                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <motion.button
                      onClick={() => setCurrentStep(index)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                          : isCompleted
                            ? 'bg-emerald-100 text-emerald-700'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <StepIcon className="w-5 h-5" />
                      <span className="hidden md:inline font-medium">{step.label}</span>
                    </motion.button>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        'flex-1 h-0.5 mx-2',
                        index < currentStep ? 'bg-emerald-500' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Form Card */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'rounded-2xl border p-6',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              {/* Step 0: Business Info */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <h2 className={cn('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Información del Negocio
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Nombre Comercial *
                      </label>
                      <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                        placeholder="Nombre del negocio"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Razón Social</label>
                      <input
                        type="text"
                        value={formData.legalName}
                        onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">NIT / RUC</label>
                      <input
                        type="text"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Lista de Precios</label>
                      <select
                        value={formData.pricelistId}
                        onChange={(e) => setFormData({ ...formData, pricelistId: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      >
                        <option value="">Sin asignar</option>
                        {pricelists.map(pl => (
                          <option key={pl.id} value={pl.id}>{pl.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Estado</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Contact Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className={cn('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Información de Contacto
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <User className="w-4 h-4 inline mr-1" />
                        Nombre de Contacto
                      </label>
                      <input
                        type="text"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <Phone className="w-4 h-4 inline mr-1" />
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <Mail className="w-4 h-4 inline mr-1" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Dirección
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Ciudad</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Estado/Provincia</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Credit Info */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className={cn('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Configuración de Crédito
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <DollarSign className="w-4 h-4 inline mr-1" />
                        Límite de Crédito ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.creditLimit}
                        onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Días de Crédito
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.creditDays}
                        onChange={(e) => setFormData({ ...formData, creditDays: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        <FileText className="w-4 h-4 inline mr-1" />
                        Notas
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={4}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                        placeholder="Notas internas sobre el cliente..."
                      />
                    </div>
                  </div>
                  <div className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <p className="text-sm text-gray-500 mb-2">Balance Actual del Cliente</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      customer.currentBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
                    )}>
                      {formatCurrency(customer.currentBalance)}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Confirm */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className={cn('text-xl font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Confirmar Cambios
                  </h2>
                  <div className={cn(
                    'rounded-xl border p-4 space-y-4',
                    theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  )}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Nombre Comercial</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.businessName || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Razón Social</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.legalName || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Contacto</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.contactName || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Teléfono</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.phone || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.email || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Ciudad</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.city || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Límite de Crédito</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.creditLimit ? formatCurrency(parseFloat(formData.creditLimit)) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Días de Crédito</p>
                        <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.creditDays || '0'} días
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Estado</p>
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          formData.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-700'
                        )}>
                          {formData.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 rounded-xl bg-red-100 text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className={cn(
                    'px-6 py-3 rounded-xl font-medium transition-all',
                    currentStep === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  Anterior
                </button>

                {currentStep < STEPS.length - 1 ? (
                  <button
                    onClick={nextStep}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
