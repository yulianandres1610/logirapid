'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  CreditCard,
  Users,
  TrendingUp,
  Settings,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  DollarSign,
  Globe,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Activity,
  Zap,
  Shield,
  Star,
  Loader2,
  Palette,
  CheckCircle,
  XCircle,
  Package,
  Archive,
  Truck,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { WalletCard } from '@/components/wallet-card'
import { Button } from '@/components/ui/button'
import LogoUpload from '@/components/ui/LogoUpload'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'
import LoadingBox from '@/components/ui/LoadingBox'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ProviderCheckbox from '@/components/products/ProviderCheckbox'
import ProductPricingStep from '@/components/products/ProductPricingStep'
import { useProductCatalog } from '@/hooks/useProductCatalog'

// Placeholder while data loads
const LOADING_COMPANIES:any[] = []
const MOCK_COMPANIES_BACKUP = [
  {
    id: 1,
    legalName: 'CubaExpress S.A.',
    phone: '+53 7 832 4567',
    address: 'Calle 23 #456, Vedado',
    city: 'La Habana',
    country: 'Cuba',
    walletNumber: '2026152345678901',
    currency: 'USD',
    isMultiCurrency: true,
    secondaryCurrencies: ['CUP', 'EUR'],
    hasLimits: true,
    dailyLimit: '5000',
    monthlyLimit: '50000',
    companyType: 'agency',
    enabledServices: ['wallet', 'recharge', 'tracker'],
    status: 'active',
    createdAt: '2024-01-15',
    einNumber: 'CU-12345678',
    walletBalance: 15420.50,
    transactionsCount: 342,
    usersCount: 28
  },
  {
    id: 2,
    legalName: 'CaribbeanMarket Ltd.',
    phone: '+1 809 555 0123',
    address: 'Avenida Churchill #123',
    city: 'Santo Domingo',
    country: 'República Dominicana',
    walletNumber: '2026987654321098',
    currency: 'USD',
    isMultiCurrency: false,
    secondaryCurrencies: [],
    hasLimits: false,
    dailyLimit: '0',
    monthlyLimit: '0',
    companyType: 'market',
    enabledServices: ['wallet', 'marketplace'],
    status: 'active',
    createdAt: '2024-02-20',
    einNumber: 'RD-87654321',
    walletBalance: 8930.75,
    transactionsCount: 156,
    usersCount: 45
  },
  {
    id: 3,
    legalName: 'GlobalRemit Corp.',
    phone: '+1 305 888 9999',
    address: 'Brickell Ave #789',
    city: 'Miami',
    country: 'Estados Unidos',
    walletNumber: '2026456789012345',
    currency: 'USD',
    isMultiCurrency: true,
    secondaryCurrencies: ['CAD', 'EUR'],
    hasLimits: true,
    dailyLimit: '10000',
    monthlyLimit: '100000',
    companyType: 'broker',
    enabledServices: ['wallet', 'recharge', 'tracker', 'marketplace'],
    status: 'active',
    createdAt: '2024-03-10',
    einNumber: 'US-987654321',
    walletBalance: 45680.25,
    transactionsCount: 892,
    usersCount: 67
  }
]

// Company creation form components (keeping the existing logic)
const STEPS = [
  { id: 1, title: 'Información Básica', icon: Building2 },
  { id: 2, title: 'Wallet', icon: CreditCard },
  { id: 3, title: 'Servicios', icon: Settings },
  { id: 4, title: 'Precios de Venta', icon: Tag },
  { id: 5, title: 'Fee de Plataforma', icon: DollarSign },
  { id: 6, title: 'Branding', icon: Palette },
  { id: 7, title: 'Documentos', icon: FileText },
  { id: 8, title: 'Revisión', icon: Check }
]

const SERVICES = [
  { id: 'wallet', name: 'Wallet', description: 'Gestión de billeteras digitales' },
  { id: 'recharge', name: 'Recarga', description: 'Recargas móviles y servicios' },
  { id: 'remittance', name: 'Remesa', description: 'Envío de remesas internacionales' },
  {
    id: 'paqueteria',
    name: 'Paquetería',
    description: 'Servicio de envío y entrega de paquetes',
    hasSubmodules: true,
    submodules: [
      { id: 'paqueteria:pickup-orders', name: 'Órdenes de Recogida', description: 'Gestión de órdenes a domicilio' },
      { id: 'paqueteria:office-orders', name: 'Órdenes de Oficina', description: 'Gestión de órdenes en oficina' },
      { id: 'paqueteria:warehouses', name: 'Almacenes', description: 'Gestión de almacenes y depósitos' },
      { id: 'paqueteria:drivers', name: 'Drivers', description: 'Gestión de conductores' },
      { id: 'paqueteria:vehicles', name: 'Vehículos', description: 'Gestión de flota vehicular' },
      { id: 'paqueteria:routes', name: 'Rutas', description: 'Planificación y optimización de rutas' },
      { id: 'paqueteria:package-route', name: 'Empaque', description: 'Gestión de empaques y cajas' },
    ]
  },
  { id: 'tracker', name: 'Rastreador', description: 'Seguimiento de envíos' },
  { id: 'exchange', name: 'Tasa de Cambio', description: 'Gestión de tasas de cambio' },
  { id: 'marketplace', name: 'Mercado', description: 'Plataforma de compra y venta' },
]

const COMPANY_TYPES = [
  { id: 'agency', name: 'Agencia', description: 'Agencia de envíos y remesas' },
  { id: 'market', name: 'Mercado', description: 'Tienda o comercio electrónico' },
  { id: 'broker', name: 'Broker', description: 'Intermediario financiero' },
  { id: 'all', name: 'Todos', description: 'Todos los servicios disponibles' },
]

const WALLET_CURRENCIES = [
  { code: 'USD', name: 'Dólar Americano', symbol: '$', flag: '🇺🇸' },
  { code: 'CUP', name: 'Peso Cubano', symbol: '$', flag: '🇨🇺' },
  { code: 'MNX', name: 'Peso Mexicano', symbol: 'M$', flag: '🇲🇽' },
  { code: 'CAD', name: 'Dólar Canadiense', symbol: 'C$', flag: '🇨🇦' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' }
]

const getPrimaryCurrencyForCountry = (country: string) => {
  switch (country.toLowerCase()) {
    case 'cuba':
      return 'CUP'
    case 'méjico':
    case 'mexico':
      return 'MNX'
    case 'canadá':
    case 'canada':
      return 'CAD'
    case 'españa':
      return 'EUR'
    default:
      return 'USD'
  }
}

export default function CompaniesPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  // Fetch product catalog for pricing step
  const { data: productCatalog, loading: loadingCatalog } = useProductCatalog()

  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [companyDrivers, setCompanyDrivers] = useState<any[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    type: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  })

  // Create company form state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    legalName: '',
    phone: '',
    customerServicePhone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    walletNumber: '',
    currency: '',
    isMultiCurrency: false,
    secondaryCurrencies: [],
    hasLimits: false,
    dailyLimit: '',
    monthlyLimit: '',
    rechargeLimits: { daily: '', monthly: '' },
    transferLimits: { daily: '', monthly: '' },
    enabledServices: [],
    isProvider: false,
    providerType: null as 'products' | 'services' | 'both' | null,
    providerCategories: [] as string[],
    providerServices: [],
    productPrices: [] as Array<{ productId: number; sellPrice: number }>,
    companyType: '',
    serviceFees: {},
    servicePrices: {} as Record<string, { buyPrice: number; sellPrice: number }>,
    prices: { wallet: 0, recharge: 0, tracker: 0, marketplace: 0, paqueteria: 0 },
    einNumber: '',
    documents: [],
    logoUrl: '',
    labelLogoUrl: '',
    subdomain: '',
    primaryColor: '#CC0A46',
    secondaryColor: '#0A46CC',
    latitude: null,
    longitude: null,
  })

  // Load companies from API on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/companies?includeBranches=true')
        const data = await response.json()

        if (data.success) {
          setCompanies(data.data)
        }
      } catch (error) {
        console.error('Error loading companies:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()
  }, [])

  // Fetch drivers when a company is selected
  useEffect(() => {
    const fetchCompanyDrivers = async () => {
      if (!selectedCompany?.id) {
        setCompanyDrivers([])
        return
      }

      try {
        setLoadingDrivers(true)
        const response = await fetch(`/api/drivers?companyId=${selectedCompany.id}&limit=100`)
        const data = await response.json()

        if (data.success) {
          setCompanyDrivers(data.data || [])
        }
      } catch (error) {
        console.error('Error loading company drivers:', error)
        setCompanyDrivers([])
      } finally {
        setLoadingDrivers(false)
      }
    }

    fetchCompanyDrivers()
  }, [selectedCompany?.id])

  const generateWalletNumber = () => {
    const timestamp = Date.now().toString().slice(-14)
    const walletNumber = `2026${timestamp}`
    setFormData((prev: any) => ({ ...prev, walletNumber }))
  }

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.country.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || company.companyType === selectedFilter
    return matchesSearch && matchesFilter
  })

  const resetForm = () => {
    setFormData({
      legalName: '',
      phone: '',
      customerServicePhone: '',
      email: '',
      website: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      walletNumber: '',
      currency: '',
      isMultiCurrency: false,
      secondaryCurrencies: [],
      hasLimits: false,
      dailyLimit: '',
      monthlyLimit: '',
      rechargeLimits: { daily: '', monthly: '' },
      transferLimits: { daily: '', monthly: '' },
      enabledServices: [],
      isProvider: false,
      providerType: null,
      providerCategories: [],
      providerServices: [],
      productPrices: [],
      companyType: '',
      serviceFees: {},
      servicePrices: {},
      prices: { wallet: 0, recharge: 0, tracker: 0, marketplace: 0, paqueteria: 0 },
      einNumber: '',
      documents: [],
      logoUrl: '',
      labelLogoUrl: '',
      subdomain: '',
      primaryColor: '#CC0A46',
      secondaryColor: '#0A46CC',
    })
    setCurrentStep(1)
  }

  const handleCreateCompany = async () => {
    try {
      setLoading(true)

      // Create company via API
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || 'Error al crear empresa')
        return
      }

      const companyId = data.data.id

      // Upload documents if any
      if (formData.documents && formData.documents.length > 0) {
        try {
          const documentsFormData = new FormData()

          // Add company ID
          documentsFormData.append('companyId', companyId.toString())

          // Add all documents
          formData.documents.forEach((doc: File) => {
            documentsFormData.append('documents', doc)
          })

          const docsResponse = await fetch('/api/upload/documents', {
            method: 'POST',
            body: documentsFormData
          })

          const docsData = await docsResponse.json()

          if (!docsData.success) {
            console.error('Error uploading documents:', docsData.error)
            showNotification('warning', 'Advertencia', 'Empresa creada pero hubo un error al subir los documentos. Puedes subirlos más tarde.')
          }
        } catch (error) {
          console.error('Error uploading documents:', error)
          showNotification('warning', 'Advertencia', 'Empresa creada pero hubo un error al subir los documentos. Puedes subirlos más tarde.')
        }
      }

      // If it's a market type company, also create in marketplaces API
      if (formData.companyType === 'market') {
        try {
          await fetch('/api/admin/marketplaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.legalName,
              address: formData.address,
              province: formData.city.toLowerCase().includes('la habana') ? 'la-habana' : 'matanzas',
              municipality: 'vedado',
              phone: formData.phone,
              description: `Empresa tipo mercado: ${formData.legalName}`,
              categories: ['Mercado'],
              schedule: 'Lun-Dom: 8:00 AM - 8:00 PM',
              deliveryTime: '30-45 min',
              deliveryCost: 2.50
            })
          })
        } catch (error) {
          console.error('Error creating marketplace:', error)
        }
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      setShowCreateForm(false)
      resetForm()
      showNotification('success', '¡Éxito!', 'Empresa creada exitosamente')

    } catch (error) {
      console.error('Error creating company:', error)
      showNotification('error', 'Error', 'Error al crear empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  // Función para formatear moneda de forma segura
  const formatCurrency = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return '$0.00'

    const numValue = typeof value === 'string' ? parseFloat(value) : value

    if (isNaN(numValue)) return '$0.00'

    return `$${numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  // Función para cambiar el estado de la empresa (activar/desactivar)
  const handleToggleStatus = async (companyId: number, companyName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const action = newStatus === 'inactive' ? 'desactivar' : 'activar'

    setConfirmDialog({
      isOpen: true,
      title: `${action === 'desactivar' ? 'Desactivar' : 'Activar'} Empresa`,
      message: `¿Estás seguro de ${action} la empresa "${companyName}"?`,
      type: newStatus === 'inactive' ? 'warning' : 'info',
      onConfirm: async () => {
        await executeToggleStatus(companyId, companyName, newStatus, action)
      }
    })
  }

  const executeToggleStatus = async (companyId: number, companyName: string, newStatus: string, action: string) => {

    try {
      setLoading(true)

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || `Error al ${action} empresa`)
        return
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      showNotification('success', '¡Éxito!', `Empresa ${action === 'desactivar' ? 'desactivada' : 'activada'} exitosamente`)

    } catch (error) {
      console.error(`Error ${action} company:`, error)
      showNotification('error', 'Error', `Error al ${action} empresa. Por favor intenta de nuevo`)
    } finally {
      setLoading(false)
    }
  }

  // Función para eliminar permanentemente la empresa (solo si está inactiva)
  const handleDeleteCompany = async (companyId: number, companyName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '⚠️ Eliminar Empresa',
      message: `¿Estás seguro de eliminar PERMANENTEMENTE la empresa "${companyName}"?\n\nEsta acción NO se puede deshacer y eliminará todos los datos relacionados.`,
      type: 'danger',
      onConfirm: async () => {
        await executeDeleteCompany(companyId, companyName)
      }
    })
  }

  const executeDeleteCompany = async (companyId: number, companyName: string) => {

    try {
      setLoading(true)

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      // Try to parse JSON response, but handle empty responses
      let data: any = {}
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.log('No JSON response from DELETE')
      }

      if (!response.ok || !data.success) {
        showNotification('error', 'Error', data.error || 'Error al eliminar empresa')
        return
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      showNotification('success', '¡Éxito!', data.message || 'Empresa eliminada exitosamente')

    } catch (error) {
      console.error('Error deleting company:', error)
      showNotification('error', 'Error', 'Error al eliminar empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCompany = async (companyId: number) => {
    try {
      setLoading(true)

      // Obtener datos de la empresa
      const response = await fetch(`/api/companies/${companyId}`)
      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || 'Error al cargar empresa')
        return
      }

      const company = data.data

      // Cargar datos en el formulario
      setFormData({
        legalName: company.legalName || '',
        phone: company.phone || '',
        customerServicePhone: company.customerServicePhone || '',
        email: company.email || '',
        website: company.website || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        country: company.country || '',
        zipCode: company.zipCode || '',
        walletNumber: company.walletNumber || '',
        currency: company.currency || 'USD',
        isMultiCurrency: company.isMultiCurrency || false,
        secondaryCurrencies: company.secondaryCurrencies || [],
        hasLimits: company.hasLimits || false,
        dailyLimit: company.dailyLimit || '',
        monthlyLimit: company.monthlyLimit || '',
        rechargeLimits: { daily: '', monthly: '' },
        transferLimits: { daily: '', monthly: '' },
        enabledServices: Array.isArray(company.enabledServices) ? company.enabledServices : [],
        companyType: company.companyType || '',
        serviceFees: company.serviceFees || {},
        servicePrices: company.servicePrices || {},
        prices: {},
        einNumber: company.einNumber || '',
        documents: [],
        logoUrl: company.logoUrl || '',
        labelLogoUrl: company.labelLogoUrl || '',
        subdomain: company.subdomain || '',
        primaryColor: company.primaryColor || '#CC0A46',
        secondaryColor: company.secondaryColor || '#0A46CC',
        editMode: true,
        editId: companyId
      })

      // Abrir el formulario
      setShowCreateForm(true)
      setCurrentStep(1)

    } catch (error) {
      console.error('Error loading company:', error)
      showNotification('error', 'Error', 'Error al cargar empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCompany = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/companies/${formData.editId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || 'Error al actualizar empresa')
        return
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      setShowCreateForm(false)
      resetForm()
      showNotification('success', '¡Éxito!', 'Empresa actualizada exitosamente')

    } catch (error) {
      console.error('Error updating company:', error)
      showNotification('error', 'Error', 'Error al actualizar empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      {showCreateForm ? (
        // Company Creation Form View
        <div className="max-w-6xl mx-auto p-6">
          {/* Form Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className={cn(
                  "text-3xl font-bold mb-2",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>
                  {formData.editMode ? 'Editar Empresa' : 'Crear Nueva Empresa'}
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {formData.editMode
                    ? 'Actualiza la información de la empresa'
                    : 'Completa el formulario para registrar una nueva empresa en el sistema'
                  }
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  resetForm()
                }}
                className={cn(
                  theme === 'dark' ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>

            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex items-center">
                      <motion.div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                          currentStep === step.id
                            ? theme === 'dark' ? "bg-blue-600 text-white" : "bg-exa-primary text-white"
                            : currentStep > step.id
                              ? theme === 'dark' ? "bg-green-500 text-white" : "bg-green-500 text-white"
                              : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
                        )}
                        whileHover={{ scale: 1.1 }}
                      >
                        {currentStep > step.id ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <step.icon className="w-5 h-5" />
                        )}
                      </motion.div>
                      <div className="ml-3 hidden sm:block">
                        <p className={cn(
                          "text-xs font-medium",
                          currentStep === step.id
                            ? theme === 'dark' ? "text-white" : "text-black"
                            : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {step.title}
                        </p>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-1 mx-4",
                        currentStep > step.id
                          ? theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                          : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Información Básica de la Empresa
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Nombre Legal *
                      </label>
                      <input
                        type="text"
                        value={formData.legalName}
                        onChange={(e) => setFormData({...formData, legalName: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="Ej: CubaExpress S.A."
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Teléfono *
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="+53 7 832 4567"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Teléfono de Soporte
                      </label>
                      <input
                        type="tel"
                        value={formData.customerServicePhone}
                        onChange={(e) => setFormData({...formData, customerServicePhone: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="+53 7 800 0000"
                      />
                      <p className={cn(
                        "mt-1 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Número de contacto para soporte al cliente (opcional)
                      </p>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                    )}
                    placeholder="contacto@empresa.com"
                  />
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                      theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                        : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                    )}
                    placeholder="https://empresa.com"
                  />
                  <p className={cn(
                    "mt-1 text-xs",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    Se mostrará en las etiquetas y comunicación al cliente.
                  </p>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                        EIN / Número de Identificación *
                      </label>
                      <input
                        type="text"
                        value={formData.einNumber}
                        onChange={(e) => setFormData({...formData, einNumber: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="CU-12345678"
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Tipo de Empresa *
                      </label>
                      <select
                        value={formData.companyType}
                        onChange={(e) => setFormData({...formData, companyType: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                      >
                        <option value="">Seleccionar tipo</option>
                        {COMPANY_TYPES.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dirección con Mapbox Autofill */}
                    <div className="md:col-span-2">
                      <MapboxAddressAutofill
                        value={{
                          street: formData.address || '',
                          apartment: '',
                          city: formData.city || '',
                          state: formData.state || '',
                          zipCode: formData.zipCode || '',
                          country: formData.country || ''
                        }}
                        onChange={(addressData) => {
                          setFormData({
                            ...formData,
                            address: addressData.street,
                            city: addressData.city,
                            state: addressData.state,
                            zipCode: addressData.zipCode,
                            country: addressData.country
                          })
                        }}
                        onCoordinatesChange={(coordinates) => {
                          if (coordinates) {
                            setFormData({
                              ...formData,
                              latitude: coordinates.latitude,
                              longitude: coordinates.longitude
                            })
                          }
                        }}
                        required={true}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Wallet Configuration */}
              {currentStep === 2 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Configuración de Wallet
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Wallet Card Preview */}
                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Vista Previa de Wallet
                      </h3>
                      <WalletCard
                        walletNumber={formData.walletNumber || '2026123456789012'}
                        companyName={formData.legalName || 'Nombre de Empresa'}
                        primaryCurrency={formData.currency || 'USD'}
                        secondaryCurrencies={formData.secondaryCurrencies}
                        balance={0}
                        showBalance={true}
                        setShowBalance={() => {}}
                        isMultiCurrency={formData.isMultiCurrency}
                        hasLimits={formData.hasLimits}
                        dailyLimit={formData.dailyLimit || '0'}
                        monthlyLimit={formData.monthlyLimit || '0'}
                      />
                    </div>

                    {/* Wallet Configuration */}
                    <div className="space-y-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Moneda Principal
                        </label>
                        <div className={cn(
                          "p-4 rounded-xl border",
                          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-12 h-12 rounded-lg flex items-center justify-center",
                              theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                            )}>
                              <DollarSign className={cn(
                                "w-6 h-6",
                                theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "font-bold text-lg",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>
                                {formData.currency || 'USD'}
                              </p>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                Basada en el país: {formData.country || 'No seleccionado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Multi-moneda
                          </label>
                          <button
                            onClick={() => setFormData({...formData, isMultiCurrency: !formData.isMultiCurrency})}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                              formData.isMultiCurrency ? (theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary") : "bg-gray-300"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              formData.isMultiCurrency ? "translate-x-6" : "translate-x-1"
                            )} />
                          </button>
                        </div>

                        {formData.isMultiCurrency && (
                          <div className="space-y-3">
                            <p className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Monedas Secundarias
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {WALLET_CURRENCIES.filter(curr => curr.code !== formData.currency).map(currency => (
                                <button
                                  key={currency.code}
                                  onClick={() => {
                                    const newCurrencies = formData.secondaryCurrencies.includes(currency.code)
                                      ? formData.secondaryCurrencies.filter((c: string) => c !== currency.code)
                                      : [...formData.secondaryCurrencies, currency.code]
                                    setFormData({...formData, secondaryCurrencies: newCurrencies})
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border transition-all duration-300",
                                    formData.secondaryCurrencies.includes(currency.code)
                                      ? theme === 'dark' ? "border-exa-secondary bg-exa-secondary/20" : "border-exa-primary bg-exa-primary/10"
                                      : theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{currency.flag}</span>
                                    <div className="text-left">
                                      <p className={cn(
                                        "font-medium text-sm",
                                        theme === 'dark' ? "text-white" : "text-black"
                                      )}>
                                        {currency.code}
                                      </p>
                                      <p className={cn(
                                        "text-xs",
                                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                      )}>
                                        {currency.name}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Configurar Límites
                          </label>
                          <button
                            onClick={() => setFormData({...formData, hasLimits: !formData.hasLimits})}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                              formData.hasLimits ? (theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary") : "bg-gray-300"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              formData.hasLimits ? "translate-x-6" : "translate-x-1"
                            )} />
                          </button>
                        </div>

                        {formData.hasLimits && (
                          <div className="space-y-4">
                            <div>
                              <label className={cn(
                                "block text-sm font-medium mb-2",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Límite Diario
                              </label>
                              <input
                                type="text"
                                value={formData.dailyLimit}
                                onChange={(e) => setFormData({...formData, dailyLimit: e.target.value})}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="1000"
                              />
                            </div>
                            <div>
                              <label className={cn(
                                "block text-sm font-medium mb-2",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Límite Mensual
                              </label>
                              <input
                                type="text"
                                value={formData.monthlyLimit}
                                onChange={(e) => setFormData({...formData, monthlyLimit: e.target.value})}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="10000"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Services */}
              {currentStep === 3 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Servicios Activados
                  </h2>

                  {/* Checkbox para marcar como proveedor - usa componente ProviderCheckbox */}
                  <div className="mb-6">
                    <ProviderCheckbox
                      isProvider={formData.isProvider}
                      providerType={formData.providerType}
                      providerCategories={formData.providerCategories || []}
                      onProviderChange={(isProvider) => {
                        setFormData({
                          ...formData,
                          isProvider,
                          providerType: isProvider ? 'both' : null,
                          providerCategories: [],
                          providerServices: isProvider ? formData.enabledServices : []
                        })
                      }}
                      onProviderTypeChange={(type) => {
                        setFormData({ ...formData, providerType: type })
                      }}
                      onCategoriesChange={(categories) => {
                        setFormData({ ...formData, providerCategories: categories })
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SERVICES.map(service => {
                      const isServiceEnabled = formData.enabledServices.some((s: string) =>
                        s === service.id || s.startsWith(`${service.id}:`)
                      )
                      const hasSubmodules = (service as any).hasSubmodules
                      const submodules = (service as any).submodules || []

                      // Contar submódulos seleccionados
                      const selectedSubmodules = hasSubmodules
                        ? formData.enabledServices.filter((s: string) => s.startsWith(`${service.id}:`))
                        : []

                      return (
                        <div key={service.id} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (hasSubmodules) {
                                // Para servicios con submódulos, seleccionar/deseleccionar todos
                                const allSubmoduleIds = submodules.map((sub: any) => sub.id)
                                const hasAnySubmodule = formData.enabledServices.some((s: string) =>
                                  allSubmoduleIds.includes(s)
                                )

                                if (hasAnySubmodule) {
                                  // Deseleccionar todos los submódulos
                                  const newServices = formData.enabledServices.filter((s: string) =>
                                    !s.startsWith(`${service.id}:`)
                                  )
                                  setFormData({...formData, enabledServices: newServices})
                                } else {
                                  // Seleccionar todos los submódulos
                                  const newServices = [
                                    ...formData.enabledServices.filter((s: string) => !s.startsWith(`${service.id}:`)),
                                    ...allSubmoduleIds
                                  ]
                                  setFormData({...formData, enabledServices: newServices})
                                }
                              } else {
                                // Para servicios sin submódulos, toggle normal
                                const newServices = formData.enabledServices.includes(service.id)
                                  ? formData.enabledServices.filter((s: string) => s !== service.id)
                                  : [...formData.enabledServices, service.id]
                                setFormData({...formData, enabledServices: newServices})
                              }
                            }}
                            className={cn(
                              "w-full p-6 rounded-xl border transition-all duration-300 text-left",
                              isServiceEnabled
                                ? theme === 'dark' ? "border-exa-secondary bg-exa-secondary/20" : "border-exa-primary bg-exa-primary/20"
                                : theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center",
                                isServiceEnabled
                                  ? theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                                  : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                              )}>
                                <Settings className={cn(
                                  "w-6 h-6",
                                  isServiceEnabled ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )} />
                              </div>
                              <div className="flex-1">
                                <h3 className={cn(
                                  "font-bold text-lg mb-1",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {service.name}
                                  {hasSubmodules && selectedSubmodules.length > 0 && (
                                    <span className={cn(
                                      "ml-2 text-sm font-normal",
                                      theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                    )}>
                                      ({selectedSubmodules.length}/{submodules.length} módulos)
                                    </span>
                                  )}
                                </h3>
                                <p className={cn(
                                  "text-sm",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {service.description}
                                </p>
                              </div>
                              {isServiceEnabled && (
                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary")}>
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </button>

                          {/* Submódulos de paquetería */}
                          {hasSubmodules && isServiceEnabled && (
                            <div className={cn(
                              "ml-4 p-4 rounded-lg border space-y-2",
                              theme === 'dark' ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200"
                            )}>
                              <p className={cn(
                                "text-xs font-medium mb-3",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Selecciona los módulos específicos:
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                {submodules.map((submodule: any) => {
                                  const isSubmoduleEnabled = formData.enabledServices.includes(submodule.id)
                                  return (
                                    <button
                                      key={submodule.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const newServices = isSubmoduleEnabled
                                          ? formData.enabledServices.filter((s: string) => s !== submodule.id)
                                          : [...formData.enabledServices, submodule.id]
                                        setFormData({...formData, enabledServices: newServices})
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                        isSubmoduleEnabled
                                          ? theme === 'dark'
                                            ? "border-exa-secondary/50 bg-exa-secondary/10"
                                            : "border-exa-primary/50 bg-exa-primary/10"
                                          : theme === 'dark'
                                            ? "border-gray-600 bg-gray-700/30 hover:bg-gray-700/50"
                                            : "border-gray-300 bg-white hover:bg-gray-100"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                        isSubmoduleEnabled
                                          ? theme === 'dark'
                                            ? "bg-exa-secondary border-exa-secondary"
                                            : "bg-exa-primary border-exa-primary"
                                          : theme === 'dark'
                                            ? "border-gray-500"
                                            : "border-gray-400"
                                      )}>
                                        {isSubmoduleEnabled && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <div className="flex-1 text-left">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-white" : "text-gray-900"
                                        )}>
                                          {submodule.name}
                                        </span>
                                        <p className={cn(
                                          "text-xs",
                                          theme === 'dark' ? "text-gray-500" : "text-gray-500"
                                        )}>
                                          {submodule.description}
                                        </p>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Precios de Venta */}
              {currentStep === 4 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Precios de Productos
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Configura los precios de venta de los productos del catálogo según los servicios habilitados.
                    {formData.isProvider && formData.providerCategories && formData.providerCategories.length > 0 && (
                      <span className="block mt-1 text-amber-600 dark:text-amber-400">
                        Como proveedor, puedes editar el costo de los productos en las categorías donde eres proveedor.
                      </span>
                    )}
                  </p>

                  {/* Product Catalog Pricing */}
                  {loadingCatalog ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-500">Cargando catálogo de productos...</span>
                    </div>
                  ) : productCatalog && productCatalog.products && productCatalog.products.length > 0 ? (
                    <ProductPricingStep
                      products={productCatalog.products.map(p => ({
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        serviceCategory: p.serviceCategory,
                        productType: p.productType,
                        unitType: p.unitType,
                        pricingModel: p.pricingModel,
                        costPrice: p.platformPrice,
                        minPrice: p.minPrice
                      }))}
                      prices={formData.productPrices}
                      onChange={(prices) => {
                        setFormData({ ...formData, productPrices: prices })
                      }}
                      enabledCategories={Array.isArray(formData.enabledServices) ? formData.enabledServices : []}
                      isProvider={formData.isProvider}
                      providerCategories={formData.providerCategories || []}
                    />
                  ) : (
                    <div className={cn(
                      "p-8 text-center rounded-xl border-2 border-dashed",
                      theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
                    )}>
                      <Tag className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? "text-gray-600" : "text-gray-400")} />
                      <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                        No hay productos en el catálogo. Puedes continuar al siguiente paso.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Platform Fees */}
              {currentStep === 5 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Fee de Plataforma
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Configura las comisiones que se cobrarán por cada transacción de servicio
                  </p>

                  <div className="space-y-6">
                    {formData.enabledServices.map((serviceId: string) => {
                      const service = SERVICES.find(s => s.id === serviceId)
                      if (!service) return null

                      // Inicializar fee si no existe
                      if (!formData.serviceFees[serviceId]) {
                        formData.serviceFees[serviceId] = {
                          type: 'none',
                          percentage: 0,
                          fixed: 0
                        }
                      }

                      const fee = formData.serviceFees[serviceId]
                      const exampleAmount = 100 // Monto de ejemplo para el preview

                      // Calcular fee total para preview
                      const calculateFee = () => {
                        let total = 0
                        if (fee.type === 'percentage' || fee.type === 'both') {
                          total += (exampleAmount * (fee.percentage || 0)) / 100
                        }
                        if (fee.type === 'fixed' || fee.type === 'both') {
                          total += fee.fixed || 0
                        }
                        return total.toFixed(2)
                      }

                      return (
                        <div
                          key={serviceId}
                          className={cn(
                            "p-6 rounded-xl border",
                            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                          )}
                        >
                          {/* Service Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                              )}>
                                <Settings className={cn(
                                  "w-5 h-5",
                                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                )} />
                              </div>
                              <div>
                                <h3 className={cn(
                                  "font-semibold",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {service.name}
                                </h3>
                                <p className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {service.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Fee Type Selector */}
                          <div className="mb-4">
                            <label className={cn(
                              "block text-sm font-medium mb-3",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Tipo de Fee
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                { value: 'none', label: 'Sin Fee', icon: 'X' },
                                { value: 'percentage', label: 'Porcentaje (%)', icon: '%' },
                                { value: 'fixed', label: 'Monto Fijo ($)', icon: '$' },
                                { value: 'both', label: 'Ambos', icon: '$%' },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      serviceFees: {
                                        ...formData.serviceFees,
                                        [serviceId]: { ...fee, type: option.value }
                                      }
                                    })
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-300",
                                    fee.type === option.value
                                      ? theme === 'dark'
                                        ? "border-exa-secondary bg-exa-secondary/20 text-exa-secondary"
                                        : "border-exa-primary bg-exa-primary/20 text-exa-primary"
                                      : theme === 'dark'
                                        ? "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600"
                                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                                  )}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Fee Inputs */}
                          {fee.type !== 'none' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              {/* Percentage Input */}
                              {(fee.type === 'percentage' || fee.type === 'both') && (
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Porcentaje (%)
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={fee.percentage || 0}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          serviceFees: {
                                            ...formData.serviceFees,
                                            [serviceId]: {
                                              ...fee,
                                              percentage: parseFloat(e.target.value) || 0
                                            }
                                          }
                                        })
                                      }}
                                      className={cn(
                                        "w-full px-4 py-3 pr-10 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                        theme === 'dark'
                                          ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                          : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                      )}
                                      placeholder="2.5"
                                    />
                                    <span className={cn(
                                      "absolute right-4 top-1/2 transform -translate-y-1/2 text-sm font-medium",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                    )}>
                                      %
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Fixed Amount Input */}
                              {(fee.type === 'fixed' || fee.type === 'both') && (
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Monto Fijo ($)
                                  </label>
                                  <div className="relative">
                                    <DollarSign className={cn(
                                      "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                    )} />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={fee.fixed || 0}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          serviceFees: {
                                            ...formData.serviceFees,
                                            [serviceId]: {
                                              ...fee,
                                              fixed: parseFloat(e.target.value) || 0
                                            }
                                          }
                                        })
                                      }}
                                      className={cn(
                                        "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                        theme === 'dark'
                                          ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                          : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                      )}
                                      placeholder="1.50"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fee Preview */}
                          {fee.type !== 'none' && (
                            <div className={cn(
                              "p-4 rounded-lg border",
                              theme === 'dark' ? "bg-gray-900/50 border-gray-600" : "bg-blue-50 border-blue-200"
                            )}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={cn(
                                    "text-xs font-medium mb-1",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    Ejemplo: Transacción de ${exampleAmount.toFixed(2)}
                                  </p>
                                  <p className={cn(
                                    "text-sm",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    {fee.type === 'percentage' && `${fee.percentage}% = $${calculateFee()}`}
                                    {fee.type === 'fixed' && `Fijo = $${calculateFee()}`}
                                    {fee.type === 'both' && `${fee.percentage}% + $${fee.fixed} = $${calculateFee()}`}
                                  </p>
                                </div>
                                <div className={cn(
                                  "px-4 py-2 rounded-lg",
                                  theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                                )}>
                                  <p className={cn(
                                    "text-xs font-medium",
                                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                  )}>
                                    Fee Total
                                  </p>
                                  <p className={cn(
                                    "text-lg font-bold",
                                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                  )}>
                                    ${calculateFee()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {formData.enabledServices.length === 0 && (
                      <div className="text-center py-12">
                        <Settings className={cn(
                          "w-16 h-16 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          No hay servicios activados. Vuelve al paso anterior para seleccionar servicios.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 6: Branding */}
              {currentStep === 6 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Branding de la Empresa
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Configure la identidad visual de la empresa para personalizar su dashboard
                  </p>

                  <div className="space-y-8">
                    {/* Logo Upload */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Logo de la Empresa (Color)
                      </label>
                      <LogoUpload
                        value={formData.logoUrl}
                        onChange={(url) => setFormData({...formData, logoUrl: url})}
                        label="Logo de la empresa"
                      />
                      <p className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Logo a color para la aplicación y sitio web. Formatos: PNG, JPG, SVG, WEBP (máx. 5MB)
                      </p>
                    </div>

                    {/* Label Logo Upload */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Logo de Etiqueta (Blanco y Negro)
                      </label>
                      <LogoUpload
                        value={formData.labelLogoUrl}
                        onChange={(url) => setFormData({...formData, labelLogoUrl: url})}
                        uploadEndpoint="/api/upload/label-logo"
                        label="Logo de etiqueta"
                      />
                      <p className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Logo en blanco y negro para etiquetas de envío e impresión. Formatos: PNG, JPG, SVG, WEBP (máx. 5MB)
                      </p>
                    </div>

                    {/* Color Pickers */}
                    <div>
                      <h3 className={cn(
                        "text-sm font-medium mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Colores de Marca
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Primary Color */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-3",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Color Primario
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="color"
                              value={formData.primaryColor}
                              onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                              className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                            />
                            <div className="flex-1">
                              <input
                                type="text"
                                value={formData.primaryColor}
                                onChange={(e) => {
                                  const hex = e.target.value
                                  if (/^#[0-9A-F]{6}$/i.test(hex) || hex === '') {
                                    setFormData({...formData, primaryColor: hex})
                                  }
                                }}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 font-mono",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="#CC0A46"
                              />
                              <p className={cn(
                                "mt-1 text-xs",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Usado en botones principales y acentos
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Secondary Color */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-3",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Color Secundario
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="color"
                              value={formData.secondaryColor}
                              onChange={(e) => setFormData({...formData, secondaryColor: e.target.value})}
                              className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                            />
                            <div className="flex-1">
                              <input
                                type="text"
                                value={formData.secondaryColor}
                                onChange={(e) => {
                                  const hex = e.target.value
                                  if (/^#[0-9A-F]{6}$/i.test(hex) || hex === '') {
                                    setFormData({...formData, secondaryColor: hex})
                                  }
                                }}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 font-mono",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="#0A46CC"
                              />
                              <p className={cn(
                                "mt-1 text-xs",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Usado en elementos secundarios y highlights
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className={cn(
                      "p-6 rounded-xl border",
                      theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                    )}>
                      <h3 className={cn(
                        "text-sm font-medium mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Vista Previa de Colores
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Primary Preview */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            style={{ backgroundColor: formData.primaryColor }}
                            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-transform hover:scale-105"
                          >
                            Botón Primario
                          </button>
                          <div
                            style={{ backgroundColor: formData.primaryColor + '20', borderColor: formData.primaryColor }}
                            className="p-3 rounded-lg border-2 text-center"
                          >
                            <span style={{ color: formData.primaryColor }} className="text-sm font-medium">
                              Badge Primario
                            </span>
                          </div>
                        </div>

                        {/* Secondary Preview */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            style={{ backgroundColor: formData.secondaryColor }}
                            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-transform hover:scale-105"
                          >
                            Botón Secundario
                          </button>
                          <div
                            style={{ backgroundColor: formData.secondaryColor + '20', borderColor: formData.secondaryColor }}
                            className="p-3 rounded-lg border-2 text-center"
                          >
                            <span style={{ color: formData.secondaryColor }} className="text-sm font-medium">
                              Badge Secundario
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subdomain Configuration */}
                    <div>
                      <h3 className={cn(
                        "text-sm font-medium mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Subdominio Personalizado
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Subdominio
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={formData.subdomain}
                              onChange={(e) => {
                                // Solo permitir alfanuméricos y guiones, convertir a minúsculas
                                const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                setFormData({...formData, subdomain: value})
                              }}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 font-mono",
                                theme === 'dark'
                                  ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                  : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                              )}
                              placeholder="mi-empresa"
                            />
                            <span className={cn(
                              "text-sm font-medium whitespace-nowrap",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              .logirapid.com
                            </span>
                          </div>
                          <p className={cn(
                            "mt-2 text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            Solo letras minúsculas, números y guiones. Ejemplo: acme-logistics
                          </p>
                        </div>

                        {/* Subdomain Preview */}
                        {formData.subdomain && (
                          <div className={cn(
                            "p-4 rounded-lg border",
                            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                          )}>
                            <div className="flex items-center gap-3">
                              <Globe className={cn(
                                "w-5 h-5",
                                theme === 'dark' ? "text-blue-400" : "text-blue-500"
                              )} />
                              <div className="flex-1">
                                <p className={cn(
                                  "text-xs font-medium mb-1",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  URL de Dashboard Personalizado
                                </p>
                                <p className={cn(
                                  "text-sm font-mono font-medium",
                                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                )}>
                                  https://{formData.subdomain}.logirapid.com
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className={cn(
                      "p-4 rounded-lg border-l-4",
                      theme === 'dark'
                        ? "bg-blue-900/20 border-blue-500"
                        : "bg-blue-50 border-blue-500"
                    )}>
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className={cn(
                            "text-sm font-medium mb-1",
                            theme === 'dark' ? "text-blue-300" : "text-blue-900"
                          )}>
                            Personalización Completa
                          </p>
                          <p className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-blue-200/70" : "text-blue-800/70"
                          )}>
                            El logo, colores y subdominio se aplicarán automáticamente cuando los usuarios de esta empresa inicien sesión, creando una experiencia completamente personalizada con su marca.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7: Documents */}
              {currentStep === 7 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Documentos de la Empresa
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Sube documentos legales y oficiales de la empresa. Estos archivos se almacenarán de forma segura y privada.
                  </p>

                  <div className="space-y-6">
                    {/* Document Upload Area */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Subir Documentos
                      </label>

                      <div className={cn(
                        "border-2 border-dashed rounded-lg p-8 transition-colors text-center",
                        theme === 'dark'
                          ? "border-gray-600 hover:border-gray-500"
                          : "border-gray-300 hover:border-gray-400"
                      )}>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            if (e.target.files) {
                              const newFiles = Array.from(e.target.files)
                              setFormData({
                                ...formData,
                                documents: [...(formData.documents || []), ...newFiles]
                              })
                            }
                          }}
                          className="hidden"
                          id="document-upload"
                        />

                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <label
                              htmlFor="document-upload"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline cursor-pointer"
                            >
                              Haz clic para subir
                            </label>
                            {' '}o arrastra los documentos aquí
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PDF, DOC, DOCX, JPG, PNG (máx. 5GB por archivo)
                          </p>
                        </div>
                      </div>

                      <p className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Documentos sugeridos: EIN, Licencia de negocio, Certificado de incorporación, Contratos, etc.
                      </p>
                    </div>

                    {/* Uploaded Documents List */}
                    {formData.documents && formData.documents.length > 0 && (
                      <div>
                        <h3 className={cn(
                          "text-sm font-medium mb-3",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Documentos Seleccionados ({formData.documents.length})
                        </h3>
                        <div className="space-y-2">
                          {formData.documents.map((doc: File, index: number) => (
                            <div
                              key={index}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border",
                                theme === 'dark'
                                  ? "bg-gray-800/50 border-gray-700"
                                  : "bg-gray-50 border-gray-200"
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center",
                                  theme === 'dark' ? "bg-blue-900/20" : "bg-blue-100"
                                )}>
                                  <FileText className="w-5 h-5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm font-medium truncate",
                                    theme === 'dark' ? "text-white" : "text-black"
                                  )}>
                                    {doc.name}
                                  </p>
                                  <p className={cn(
                                    "text-xs",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    {(doc.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newDocs = formData.documents.filter((_: any, i: number) => i !== index)
                                  setFormData({...formData, documents: newDocs})
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Info Boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Security Info */}
                      <div className={cn(
                        "p-4 rounded-lg border-l-4",
                        theme === 'dark'
                          ? "bg-green-900/20 border-green-500"
                          : "bg-green-50 border-green-500"
                      )}>
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-green-300" : "text-green-900"
                            )}>
                              Almacenamiento Seguro
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-green-200/70" : "text-green-800/70"
                            )}>
                              Los documentos se guardan en un bucket privado con acceso restringido. Solo usuarios autorizados pueden ver estos archivos.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Optional Info */}
                      <div className={cn(
                        "p-4 rounded-lg border-l-4",
                        theme === 'dark'
                          ? "bg-blue-900/20 border-blue-500"
                          : "bg-blue-50 border-blue-500"
                      )}>
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-blue-300" : "text-blue-900"
                            )}>
                              Opcional
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-blue-200/70" : "text-blue-800/70"
                            )}>
                              Puedes omitir este paso y agregar documentos más tarde desde la configuración de la empresa.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 8: Review */}
              {currentStep === 8 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Revisión Final
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información de la Empresa
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Nombre Legal:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.legalName || 'No especificado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Teléfono:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.phone || 'No especificado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Dirección:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.address || 'No especificado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Tipo de Empresa:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {COMPANY_TYPES.find(t => t.id === formData.companyType)?.name || 'No especificado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Configuración de Wallet
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Número de Wallet:
                            </span>
                            <span className={cn(
                              "text-sm font-medium font-mono",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.walletNumber || 'No generado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Moneda Principal:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.currency || 'USD'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Multi-moneda:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.isMultiCurrency ? 'Sí' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Límites Configurados:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.hasLimits ? 'Sí' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Servicios Activados
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {formData.enabledServices.map((serviceId: string) => {
                          const service = SERVICES.find(s => s.id === serviceId)
                          return service ? (
                            <span
                              key={serviceId}
                              className={cn(
                                "px-3 py-1 rounded-full text-sm",
                                theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/10 text-exa-primary"
                              )}
                            >
                              {service.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <motion.button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={currentStep === 1}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                currentStep === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : theme === 'dark'
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </motion.button>

            {currentStep === STEPS.length ? (
              <motion.button
                onClick={formData.editMode ? handleUpdateCompany : handleCreateCompany}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                <Check className="w-4 h-4" />
                {formData.editMode ? 'Actualizar Empresa' : 'Crear Empresa'}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => {
                  if (currentStep === 1 && !formData.walletNumber) {
                    generateWalletNumber()
                    if (formData.country && !formData.currency) {
                      const defaultCurrency = getPrimaryCurrencyForCountry(formData.country)
                      setFormData((prev: any) => ({
                        ...prev,
                        currency: defaultCurrency,
                        dailyLimit: '1000',
                        monthlyLimit: '10000'
                      }))
                    }
                  }
                  setCurrentStep(Math.min(STEPS.length, currentStep + 1))
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-exa-secondary text-white hover:bg-exa-primary"
                    : "bg-exa-primary text-white hover:bg-exa-secondary"
                )}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      ) : (
        // Companies List View
        <div className="p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-5">
            {/* Total Empresas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Empresas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{companies.length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Registradas</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Activas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Activity className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Activas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{companies.filter((c: any) => c.status === 'active').length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>En operación</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Total Usuarios */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                        : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <Users className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Usuarios</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{companies.reduce((sum, c) => sum + c.usersCount, 0)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Totales</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Balance Total */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-violet-900/30 border border-violet-800/50'
                        : 'bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200'
                    )}>
                      <TrendingUp className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Balance Total</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>${companies.reduce((sum, c) => sum + (parseFloat(c.walletBalance) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Acumulado</span>
                  </div>
                </div>
              </div>
            </motion.div>
            </div>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "backdrop-blur-sm border rounded-2xl p-6 mb-6",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
            )}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className={cn(
                  "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <input
                  type="text"
                  placeholder="Buscar empresas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-exa-secondary focus:ring-exa-secondary/20"
                      : "bg-white border-gray-300 text-black focus:border-exa-primary focus:ring-exa-primary/20"
                  )}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'all'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Todas
                </button>
                <button
                  onClick={() => setSelectedFilter('agency')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'agency'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Agencias
                </button>
                <button
                  onClick={() => setSelectedFilter('market')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'market'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Mercados
                </button>
                <button
                  onClick={() => setSelectedFilter('broker')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'broker'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Brokers
                </button>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                  Crear Empresa
                </button>
              </div>
            </div>
          </motion.div>

          {/* Companies Cards */}
          {loading && companies.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <LoadingBox text="Cargando empresas..." size="md" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className={cn(
              'rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <Building2 className="w-12 h-12 mx-auto text-gray-400" />
              <p className="mt-2 text-black dark:text-gray-400">
                {searchTerm ? 'No se encontraron empresas con los filtros aplicados' : 'No hay empresas registradas'}
              </p>
            </div>
          ) : (
            <div className="max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCompanies.map((company, index) => {
                  const isBranch = company.isBranch || false
                  const badgeLabel = isBranch ? 'Sucursal' : 'Matriz'
                  const branchCount = companies.filter((c: any) => c.parentCompanyId === company.id).length
                  const borderColor = isBranch ? 'border-l-red-500' : 'border-l-blue-500'
                  const badgeBorderColor = isBranch ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-blue-500 text-blue-600 dark:text-blue-400'

                  return (
                    <motion.div
                      key={company.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 border-l-4 overflow-hidden',
                        borderColor
                      )}
                    >
                      {/* Header */}
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Building2 className={cn(
                            "w-5 h-5 flex-shrink-0",
                            isBranch ? "text-red-500" : "text-blue-500"
                          )} />
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                            {company.legalName}
                          </h3>
                        </div>
                        <span className={cn(
                          "inline-block px-2 py-0.5 rounded text-xs font-medium border",
                          badgeBorderColor
                        )}>
                          {badgeLabel}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {company.city || 'N/A'}, {company.state || ''} {company.country || ''}
                          </span>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Balance */}
                          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Balance</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              ${(company.walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Usuarios */}
                          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Usuarios</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              {company.usersCount || 0}
                            </div>
                          </div>

                          {/* Sucursales - Only show for parent companies */}
                          {!isBranch && (
                            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2 col-span-2">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Sucursales</div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white">
                                {branchCount}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer - Status Badge and Actions */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                        {/* Status Badge */}
                        <span className={cn(
                          "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                          company.status === 'active'
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                            : "bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                        )}>
                          {company.status === 'active' ? "Activo" : "Inactivo"}
                        </span>

                        {/* Action Buttons */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSelectedCompany(company)}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditCompany(company.id)}
                            disabled={loading}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(company.id, company.legalName, company.status)}
                            disabled={loading}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors disabled:opacity-50",
                              company.status === 'active'
                                ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                : "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            )}
                            title={company.status === 'active' ? 'Desactivar' : 'Activar'}
                          >
                            {company.status === 'active' ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {company.status !== 'active' && (
                            <button
                              onClick={() => handleDeleteCompany(company.id, company.legalName)}
                              disabled={loading}
                              className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Company Detail Modal */}
          <AnimatePresence>
            {selectedCompany && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedCompany(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6",
                    theme === 'dark' ? "bg-gray-900" : "bg-white"
                  )}
                >
                  {/* Detail Modal Content */}
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                        )}>
                          <Building2 className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                          )} />
                        </div>
                        <div>
                          <h2 className={cn(
                            "text-2xl font-bold",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            {selectedCompany.legalName}
                          </h2>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              selectedCompany.status === 'active' ? "bg-green-500" : "bg-red-500"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {selectedCompany.status === 'active' ? 'Activa' : 'Inactiva'}
                            </span>
                            <span className={cn(
                              "text-sm px-2 py-1 rounded-lg",
                              theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                            )}>
                              {COMPANY_TYPES.find(t => t.id === selectedCompany.companyType)?.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedCompany(null)}
                        className={cn(
                          "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        )}
                      >
                        <X className={cn(
                          "w-5 h-5",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )} />
                      </button>
                    </div>

                    {/* Wallet Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Wallet de la Empresa
                        </h3>
                        <WalletCard
                          walletNumber={selectedCompany.walletNumber}
                          companyName={selectedCompany.legalName}
                          primaryCurrency={selectedCompany.currency}
                          secondaryCurrencies={selectedCompany.secondaryCurrencies}
                          balance={selectedCompany.walletBalance}
                          showBalance={true}
                          setShowBalance={() => {}}
                          isMultiCurrency={selectedCompany.isMultiCurrency}
                          hasLimits={selectedCompany.hasLimits}
                          dailyLimit={selectedCompany.dailyLimit}
                          monthlyLimit={selectedCompany.monthlyLimit}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información de Contacto
                        </h3>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Phone className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedCompany.phone}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <MapPin className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedCompany.address}, {selectedCompany.city}, {selectedCompany.country}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Mail className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              contact@{selectedCompany.legalName.toLowerCase().replace(/\s+/g, '')}.com
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Calendar className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Creada el {selectedCompany.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <DollarSign className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-green-400" : "text-green-600"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          ${selectedCompany.walletBalance.toLocaleString()}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Balance Actual
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <Activity className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          {selectedCompany.transactionsCount}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Transacciones
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <Users className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-purple-400" : "text-purple-600"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          {selectedCompany.usersCount}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Usuarios
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <Star className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          4.8
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Rating
                        </p>
                      </div>
                    </div>

                    {/* Services */}
                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Servicios Activados
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCompany.enabledServices.map((serviceId: string) => {
                          const service = SERVICES.find(s => s.id === serviceId)
                          return service ? (
                            <div
                              key={serviceId}
                              className={cn(
                                "px-4 py-2 rounded-xl border flex items-center gap-2",
                                theme === 'dark' ? "border-gray-700" : "border-gray-200"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                              )}>
                                <Settings className={cn(
                                  "w-3 h-3",
                                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                )} />
                              </div>
                              <div>
                                <p className={cn(
                                  "font-medium text-sm",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {service.name}
                                </p>
                                <p className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {service.description}
                                </p>
                              </div>
                            </div>
                          ) : null
                        })}
                      </div>
                    </div>

                    {/* Drivers Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={cn(
                          "text-lg font-semibold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Drivers de la Empresa
                        </h3>
                        <span className={cn(
                          "text-sm px-3 py-1 rounded-full",
                          theme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
                        )}>
                          {companyDrivers.length} drivers
                        </span>
                      </div>

                      {loadingDrivers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                          <span className={cn(
                            "ml-2 text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            Cargando drivers...
                          </span>
                        </div>
                      ) : companyDrivers.length === 0 ? (
                        <div className={cn(
                          "text-center py-8 rounded-xl border",
                          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                        )}>
                          <Truck className={cn(
                            "w-10 h-10 mx-auto mb-2",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )} />
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            No hay drivers registrados para esta empresa
                          </p>
                        </div>
                      ) : (
                        <div className={cn(
                          "rounded-xl border overflow-hidden",
                          theme === 'dark' ? "border-gray-700" : "border-gray-200"
                        )}>
                          <table className="w-full">
                            <thead className={cn(
                              "border-b",
                              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                            )}>
                              <tr>
                                <th className={cn(
                                  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Driver
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Contacto
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Estado
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Cajas Vacías
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Bultos
                                </th>
                              </tr>
                            </thead>
                            <tbody className={cn(
                              "divide-y",
                              theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                            )}>
                              {companyDrivers.map((driver) => (
                                <tr
                                  key={driver.id}
                                  className={cn(
                                    "transition-colors",
                                    theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                                  )}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                                      )}>
                                        <Users className="w-4 h-4 text-gray-500" />
                                      </div>
                                      <div>
                                        <div className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-white" : "text-black"
                                        )}>
                                          {driver.firstName} {driver.lastName}
                                        </div>
                                        <div className={cn(
                                          "text-xs",
                                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                        )}>
                                          ID: {driver.id}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={cn(
                                      "text-sm",
                                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                    )}>
                                      {driver.email}
                                    </div>
                                    {driver.phone && (
                                      <div className={cn(
                                        "text-xs",
                                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                      )}>
                                        {driver.phone}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                      driver.isActive
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                    )}>
                                      {driver.isActive ? (
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                      ) : (
                                        <XCircle className="w-3 h-3 mr-1" />
                                      )}
                                      {driver.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-center text-xs">
                                        <span className={cn(
                                          "font-medium",
                                          theme === 'dark' ? "text-white" : "text-black"
                                        )}>
                                          {driver.cajas_vacias_count || 0}
                                        </span>
                                      </div>
                                      <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-1.5">
                                        <div
                                          className="h-1.5 rounded-full bg-purple-500 transition-all duration-300"
                                          style={{
                                            width: `${(driver.cajas_vacias_capacity || 50) > 0 ? ((driver.cajas_vacias_count || 0) / (driver.cajas_vacias_capacity || 50) * 100) : 0}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-center text-xs">
                                        <span className={cn(
                                          "font-medium",
                                          theme === 'dark' ? "text-white" : "text-black"
                                        )}>
                                          {driver.bultos_count || 0}
                                        </span>
                                      </div>
                                      <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-1.5">
                                        <div
                                          className="h-1.5 rounded-full bg-amber-500 transition-all duration-300"
                                          style={{
                                            width: `${(driver.bultos_capacity || 100) > 0 ? ((driver.bultos_count || 0) / (driver.bultos_capacity || 100) * 100) : 0}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm Dialog */}
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            onConfirm={confirmDialog.onConfirm}
            title={confirmDialog.title}
            message={confirmDialog.message}
            type={confirmDialog.type}
            theme={theme}
            confirmText="Confirmar"
            cancelText="Cancelar"
          />
        </div>
      )}
    </DashboardLayout>
  )
}
