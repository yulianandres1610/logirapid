'use client'

import { useState } from 'react'
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
  Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { WalletCard } from '@/components/wallet-card'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'

// Mock data for branches (sucursales)
const MOCK_BRANCHES = [
  {
    id: 1,
    legalName: 'CubaExpress Vedado',
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
    einNumber: 'CU-12345678-1',
    walletBalance: 15420.50,
    transactionsCount: 342,
    usersCount: 28,
    parentCompanyId: 'CUBAEXPRESS_MAIN'
  },
  {
    id: 2,
    legalName: 'CubaExpress Miramar',
    phone: '+53 7 204 1234',
    address: 'Avenida 5ta #3402',
    city: 'La Habana',
    country: 'Cuba',
    walletNumber: '2026987654321098',
    currency: 'USD',
    isMultiCurrency: false,
    secondaryCurrencies: [],
    hasLimits: false,
    dailyLimit: '0',
    monthlyLimit: '0',
    companyType: 'agency',
    enabledServices: ['wallet', 'recharge'],
    status: 'active',
    createdAt: '2024-02-20',
    einNumber: 'CU-12345678-2',
    walletBalance: 8930.75,
    transactionsCount: 156,
    usersCount: 45,
    parentCompanyId: 'CUBAEXPRESS_MAIN'
  },
  {
    id: 3,
    legalName: 'CubaExpress Varadero',
    phone: '+53 45 661133',
    address: 'Calle 62 #215',
    city: 'Varadero',
    country: 'Cuba',
    walletNumber: '2026456789012345',
    currency: 'USD',
    isMultiCurrency: true,
    secondaryCurrencies: ['CUP', 'EUR'],
    hasLimits: true,
    dailyLimit: '10000',
    monthlyLimit: '100000',
    companyType: 'agency',
    enabledServices: ['wallet', 'recharge', 'tracker', 'marketplace'],
    status: 'active',
    createdAt: '2024-03-10',
    einNumber: 'CU-12345678-3',
    walletBalance: 45680.25,
    transactionsCount: 892,
    usersCount: 67,
    parentCompanyId: 'CUBAEXPRESS_MAIN'
  },
  {
    id: 4,
    legalName: 'CubaExpress Santiago',
    phone: '+53 22 654321',
    address: 'Avenida 24 de Febrero #567',
    city: 'Santiago de Cuba',
    country: 'Cuba',
    walletNumber: '2026789012345678',
    currency: 'USD',
    isMultiCurrency: true,
    secondaryCurrencies: ['CUP'],
    hasLimits: true,
    dailyLimit: '3000',
    monthlyLimit: '30000',
    companyType: 'agency',
    enabledServices: ['wallet', 'recharge', 'tracker'],
    status: 'active',
    createdAt: '2024-04-05',
    einNumber: 'CU-12345678-4',
    walletBalance: 12340.80,
    transactionsCount: 234,
    usersCount: 19,
    parentCompanyId: 'CUBAEXPRESS_MAIN'
  }
]

// Branch creation form components (keeping the existing logic)
const STEPS = [
  { id: 1, title: 'Información Básica', icon: Building2 },
  { id: 2, title: 'Wallet', icon: CreditCard },
  { id: 3, title: 'Servicios', icon: Settings },
  { id: 4, title: 'Precios', icon: Users },
  { id: 5, title: 'Documentación', icon: FileText },
  { id: 6, title: 'Revisión', icon: Check }
]

const SERVICES = [
  { id: 'wallet', name: 'Wallet', description: 'Gestión de billeteras digitales' },
  { id: 'recharge', name: 'Recarga', description: 'Recargas móviles y servicios' },
  { id: 'remittance', name: 'Remesa', description: 'Envío de remesas internacionales' },
  { id: 'tracker', name: 'Rastreador', description: 'Seguimiento de envíos' },
  { id: 'exchange', name: 'Tasa de Cambio', description: 'Gestión de tasas de cambio' },
  { id: 'marketplace', name: 'Mercado', description: 'Plataforma de compra y venta' },
]

const BRANCH_TYPES = [
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

export default function BranchesPage() {
  const { theme } = useTheme()
  const [branches, setBranches] = useState(MOCK_BRANCHES)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedBranch, setSelectedBranch] = useState<typeof MOCK_BRANCHES[0] | null>(null)

  // Create branch form state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    legalName: '',
    phone: '',
    address: '',
    city: '',
    country: '',
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
    companyType: '',
    prices: { wallet: 0, recharge: 0, tracker: 0, marketplace: 0 },
    einNumber: '',
    documents: [],
  })

  const generateWalletNumber = () => {
    const timestamp = Date.now().toString().slice(-14)
    const walletNumber = `2026${timestamp}`
    setFormData((prev: any) => ({ ...prev, walletNumber }))
  }

  const filteredBranches = branches.filter(branch => {
    const matchesSearch = branch.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         branch.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         branch.country.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || branch.companyType === selectedFilter
    return matchesSearch && matchesFilter
  })

  const resetForm = () => {
    setFormData({
      legalName: '',
      phone: '',
      address: '',
      city: '',
      country: '',
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
      companyType: '',
      prices: { wallet: 0, recharge: 0, tracker: 0, marketplace: 0 },
      einNumber: '',
      documents: [],
    })
    setCurrentStep(1)
  }

  const handleCreateBranch = async () => {
    const newBranch = {
      ...formData,
      id: branches.length + 1,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      walletBalance: 0,
      transactionsCount: 0,
      usersCount: 0,
      parentCompanyId: 'CUBAEXPRESS_MAIN'
    }
    setBranches([newBranch, ...branches])
    setShowCreateForm(false)
    resetForm()
    alert('Sucursal creada exitosamente!')
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        {showCreateForm ? (
          // Branch Creation Form View
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
                    Crear Nueva Sucursal
                  </h1>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Completa el formulario para registrar una nueva sucursal en el sistema
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
                      Información Básica de la Sucursal
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Nombre de la Sucursal *
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
                          placeholder="Ej: CubaExpress Vedado"
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
                          Código de Identificación *
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
                          placeholder="CU-12345678-1"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Tipo de Sucursal *
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
                          {BRANCH_TYPES.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Dirección *
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                          placeholder="Calle 23 #456, Vedado"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Ciudad *
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                          placeholder="La Habana"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          País *
                        </label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                          placeholder="Cuba"
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
                          companyName={formData.legalName || 'Nombre de Sucursal'}
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
                      "text-xl font-bold mb-6",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Servicios Activados
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {SERVICES.map(service => (
                        <button
                          key={service.id}
                          onClick={() => {
                            const newServices = formData.enabledServices.includes(service.id)
                              ? formData.enabledServices.filter((s: string) => s !== service.id)
                              : [...formData.enabledServices, service.id]
                            setFormData({...formData, enabledServices: newServices})
                          }}
                          className={cn(
                            "p-6 rounded-xl border transition-all duration-300 text-left",
                            formData.enabledServices.includes(service.id)
                              ? theme === 'dark' ? "border-exa-secondary bg-exa-secondary/20" : "border-exa-primary bg-exa-primary/20"
                              : theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center",
                              formData.enabledServices.includes(service.id)
                                ? theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                                : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                            )}>
                              <Settings className={cn(
                                "w-6 h-6",
                                formData.enabledServices.includes(service.id) ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )} />
                            </div>
                            <div className="flex-1">
                              <h3 className={cn(
                                "font-bold text-lg mb-2",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>
                                {service.name}
                              </h3>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                {service.description}
                              </p>
                            </div>
                            {formData.enabledServices.includes(service.id) && (
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary")}>
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: Prices */}
                {currentStep === 4 && (
                  <div className={cn(
                    "backdrop-blur-sm border rounded-2xl p-8",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}>
                    <h2 className={cn(
                      "text-xl font-bold mb-6",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Configuración de Precios
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {formData.enabledServices.map((serviceId: string) => {
                        const service = SERVICES.find(s => s.id === serviceId)
                        return service ? (
                          <div key={serviceId}>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Precio para {service.name}
                            </label>
                            <div className="relative">
                              <DollarSign className={cn(
                                "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )} />
                              <input
                                type="number"
                                value={formData.prices[serviceId]}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  prices: {...formData.prices, [serviceId]: parseFloat(e.target.value) || 0}
                                })}
                                className={cn(
                                  "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                {/* Step 5: Documentation */}
                {currentStep === 5 && (
                  <div className={cn(
                    "backdrop-blur-sm border rounded-2xl p-8",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}>
                    <h2 className={cn(
                      "text-xl font-bold mb-6",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Documentación Requerida
                    </h2>

                    <div className="text-center py-12">
                      <FileText className={cn(
                        "w-16 h-16 mx-auto mb-4",
                        theme === 'dark' ? "text-gray-600" : "text-gray-400"
                      )} />
                      <p className={cn(
                        "text-lg font-medium mb-2",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Subida de Documentos
                      </p>
                      <p className={cn(
                        "text-sm mb-6",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Funcionalidad de subida de documentos próximamente
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 6: Review */}
                {currentStep === 6 && (
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
                            Información de la Sucursal
                          </h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                Nombre de la Sucursal:
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
                                Tipo de Sucursal:
                              </span>
                              <span className={cn(
                                "text-sm font-medium",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>
                                {BRANCH_TYPES.find(t => t.id === formData.companyType)?.name || 'No especificado'}
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
                  onClick={handleCreateBranch}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                    theme === 'dark'
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-green-500 text-white hover:bg-green-600"
                  )}
                >
                  <Check className="w-4 h-4" />
                  Crear Sucursal
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
          // Branches List View
          <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
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
                    Sucursales Registradas
                  </h1>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Gestiona todas las sucursales de tu empresa
                  </p>
                </div>

                <Button
                  onClick={() => setShowCreateForm(true)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                    theme === 'dark' ? "bg-exa-secondary text-white hover:bg-exa-secondary/90" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                  )}
                >
                  <Plus className="w-5 h-5" />
                  Nueva Sucursal
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                    )}>
                      <Building2 className={cn(
                        "w-6 h-6",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )} />
                    </div>
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        {branches.length}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Total Sucursales
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? "bg-green-500/20" : "bg-green-500/20"
                    )}>
                      <Activity className={cn(
                        "w-6 h-6",
                        theme === 'dark' ? "text-green-400" : "text-green-600"
                      )} />
                    </div>
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        {branches.filter((b: any) => b.status === 'active').length}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Activas
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                    )}>
                      <Users className={cn(
                        "w-6 h-6",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )} />
                    </div>
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        {branches.reduce((sum, b) => sum + b.usersCount, 0)}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Total Usuarios
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      theme === 'dark' ? "bg-purple-500/20" : "bg-purple-500/20"
                    )}>
                      <TrendingUp className={cn(
                        "w-6 h-6",
                        theme === 'dark' ? "text-purple-400" : "text-purple-600"
                      )} />
                    </div>
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        ${branches.reduce((sum, b) => sum + b.walletBalance, 0).toLocaleString()}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Balance Total
                      </p>
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
                    placeholder="Buscar sucursales..."
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
                  <Button
                    variant="outline"
                    onClick={() => setSelectedFilter('all')}
                    className={cn(
                      selectedFilter === 'all'
                        ? theme === 'dark' ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                        : theme === 'dark'
                          ? "border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                          : "border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                    )}
                  >
                    Todas
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedFilter('agency')}
                    className={cn(
                      selectedFilter === 'agency'
                        ? theme === 'dark' ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                        : theme === 'dark'
                          ? "border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                          : "border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                    )}
                  >
                    Agencias
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedFilter('market')}
                    className={cn(
                      selectedFilter === 'market'
                        ? theme === 'dark' ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                        : theme === 'dark'
                          ? "border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                          : "border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                    )}
                  >
                    Mercados
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedFilter('broker')}
                    className={cn(
                      selectedFilter === 'broker'
                        ? theme === 'dark' ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-exa-primary text-white hover:bg-exa-primary/90"
                        : theme === 'dark'
                          ? "border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                          : "border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                    )}
                  >
                    Brokers
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Branches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBranches.map((branch, index) => (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className={cn(
                    "backdrop-blur-sm border rounded-2xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                  )}
                  onClick={() => setSelectedBranch(branch)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                      )}>
                        <Building2 className={cn(
                          "w-6 h-6",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )} />
                      </div>
                      <div>
                        <h3 className={cn(
                          "font-bold text-lg",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          {branch.legalName}
                        </h3>
                        <div className="flex items-center gap-1">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            branch.status === 'active' ? "bg-green-500" : "bg-red-500"
                          )} />
                          <span className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            {branch.status === 'active' ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Globe className={cn(
                        "w-4 h-4",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )} />
                      <span className="text-xs">{branch.currency}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className={cn(
                        "w-4 h-4",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )} />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {branch.city}, {branch.country}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className={cn(
                        "w-4 h-4",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )} />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {branch.phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <CreditCard className={cn(
                        "w-4 h-4",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )} />
                      <span className={cn(
                        "text-sm font-mono",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {branch.walletNumber.slice(0, 4)}...{branch.walletNumber.slice(-4)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className={cn(
                      "p-2 rounded-lg text-center",
                      theme === 'dark' ? "bg-gray-800/50" : "bg-gray-100"
                    )}>
                      <p className={cn(
                        "text-xs font-bold",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )}>
                        ${branch.walletBalance.toLocaleString()}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Balance
                      </p>
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg text-center",
                      theme === 'dark' ? "bg-gray-800/50" : "bg-gray-100"
                    )}>
                      <p className={cn(
                        "text-xs font-bold",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )}>
                        {branch.transactionsCount}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Transacciones
                      </p>
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg text-center",
                      theme === 'dark' ? "bg-gray-800/50" : "bg-gray-100"
                    )}>
                      <p className={cn(
                        "text-xs font-bold",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )}>
                        {branch.usersCount}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Usuarios
                      </p>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="flex flex-wrap gap-1">
                    {branch.enabledServices.map((serviceId: string) => {
                      const service = SERVICES.find(s => s.id === serviceId)
                      return service ? (
                        <span
                          key={serviceId}
                          className={cn(
                            "px-2 py-1 rounded-full text-xs",
                            theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/20 text-exa-primary"
                          )}
                        >
                          {service.name}
                        </span>
                      ) : null
                    })}
                  </div>

                  {/* Features */}
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
                    {branch.isMultiCurrency && (
                      <div className="flex items-center gap-1">
                        <DollarSign className={cn(
                          "w-3 h-3",
                          theme === 'dark' ? "text-green-400" : "text-green-600"
                        )} />
                        <span className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-green-400" : "text-green-600"
                        )}>
                          Multi-moneda
                        </span>
                      </div>
                    )}

                    {branch.hasLimits && (
                      <div className="flex items-center gap-1">
                        <Shield className={cn(
                          "w-3 h-3",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )} />
                        <span className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )}>
                          Con límites
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Zap className={cn(
                        "w-3 h-3",
                        theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                      )} />
                      <span className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                      )}>
                        {BRANCH_TYPES.find(t => t.id === branch.companyType)?.name}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Branch Detail Modal */}
            <AnimatePresence>
              {selectedBranch && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => setSelectedBranch(null)}
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
                              {selectedBranch.legalName}
                            </h2>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                selectedBranch.status === 'active' ? "bg-green-500" : "bg-red-500"
                              )} />
                              <span className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                {selectedBranch.status === 'active' ? 'Activa' : 'Inactiva'}
                              </span>
                              <span className={cn(
                                "text-sm px-2 py-1 rounded-lg",
                                theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                              )}>
                                {BRANCH_TYPES.find(t => t.id === selectedBranch.companyType)?.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedBranch(null)}
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
                            Wallet de la Sucursal
                          </h3>
                          <WalletCard
                            walletNumber={selectedBranch.walletNumber}
                            companyName={selectedBranch.legalName}
                            primaryCurrency={selectedBranch.currency}
                            secondaryCurrencies={selectedBranch.secondaryCurrencies}
                            balance={selectedBranch.walletBalance}
                            showBalance={true}
                            setShowBalance={() => {}}
                            isMultiCurrency={selectedBranch.isMultiCurrency}
                            hasLimits={selectedBranch.hasLimits}
                            dailyLimit={selectedBranch.dailyLimit}
                            monthlyLimit={selectedBranch.monthlyLimit}
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
                                {selectedBranch.phone}
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
                                {selectedBranch.address}, {selectedBranch.city}, {selectedBranch.country}
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
                                contact@{selectedBranch.legalName.toLowerCase().replace(/\s+/g, '')}.com
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
                                Creada el {selectedBranch.createdAt}
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
                            ${selectedBranch.walletBalance.toLocaleString()}
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
                            {selectedBranch.transactionsCount}
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
                            {selectedBranch.usersCount}
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
                          {selectedBranch.enabledServices.map((serviceId: string) => {
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
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}