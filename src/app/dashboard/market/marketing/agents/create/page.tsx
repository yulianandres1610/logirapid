'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Package, Radio, Check, ArrowLeft, ArrowRight, Search, X, Loader2,
  Eye, Target, ShoppingBag, Megaphone, Shield, Wrench, Copy, AlertTriangle,
  MessageCircle, Send as SendIcon, Globe, Mail, CheckCircle, XCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'basics' | 'products' | 'channels' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'basics', title: 'Tipo', description: 'Datos basicos', icon: Bot },
  { id: 'products', title: 'Productos', description: 'Categorias', icon: Package },
  { id: 'channels', title: 'Canales', description: 'Plataformas', icon: Radio },
  { id: 'review', title: 'Revision', description: 'Crear agente', icon: Check }
]

const AGENT_TYPES = [
  { value: 'investigator', label: 'Investigador', description: 'Busca precios en redes y grupos', icon: Eye, gradient: 'from-blue-500 to-blue-600' },
  { value: 'strategist', label: 'Estratega', description: 'Analiza datos y sugiere campanas', icon: Target, gradient: 'from-purple-500 to-purple-600' },
  { value: 'seller', label: 'Vendedor', description: 'Vende por WhatsApp y Telegram', icon: ShoppingBag, gradient: 'from-emerald-500 to-emerald-600' },
  { value: 'publisher', label: 'Publicador', description: 'Publica contenido en redes', icon: Megaphone, gradient: 'from-amber-500 to-amber-600' },
  { value: 'auditor', label: 'Auditor', description: 'Verifica trabajo de otros agentes', icon: Shield, gradient: 'from-red-500 to-red-600' },
  { value: 'custom', label: 'Personalizado', description: 'Define tareas especificas', icon: Wrench, gradient: 'from-gray-500 to-gray-600' }
]

const PLATFORM_CONFIG: Record<string, { label: string; icon: any; gradient: string; fields: string[] }> = {
  facebook: { label: 'Facebook', icon: Globe, gradient: 'from-indigo-500 to-indigo-600', fields: ['access_token', 'page_id', 'cookies'] },
  instagram: { label: 'Instagram', icon: Globe, gradient: 'from-pink-500 to-pink-600', fields: ['session_id', 'cookies'] },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, gradient: 'from-green-500 to-green-600', fields: ['phone_number', 'api_key'] },
  telegram: { label: 'Telegram', icon: SendIcon, gradient: 'from-blue-400 to-blue-500', fields: ['bot_token', 'api_id', 'api_hash'] }
}

interface Product {
  id: number
  name: string
  sku: string
  category: string
  sellingPrice: number
  currency: string
}

interface PlatformStatus {
  platform: string
  configured: boolean
  status: string | null
}

export default function CreateAgentPage() {
  const router = useRouter()
  const { theme } = useTheme()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>('basics')
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Step 1: Basics
  const [agentType, setAgentType] = useState('')
  const [agentId, setAgentId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentDescription, setAgentDescription] = useState('')

  // Step 2: Products
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState(false)

  // Step 3: Channels
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [loadingPlatforms, setLoadingPlatforms] = useState(false)

  // Step 4: Review
  const [creating, setCreating] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  // Load categories on step 2
  useEffect(() => {
    if (currentStep === 'products' && categories.length === 0) {
      fetchCategories()
    }
  }, [currentStep])

  // Load platform statuses on step 3
  useEffect(() => {
    if (currentStep === 'channels' && platformStatuses.length === 0) {
      fetchPlatformStatuses()
    }
  }, [currentStep])

  // Product search debounce
  useEffect(() => {
    if (currentStep !== 'products') return
    const timer = setTimeout(() => {
      fetchProducts(productSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, currentStep])

  const fetchCategories = async () => {
    setLoadingCategories(true)
    try {
      const res = await fetch('/api/market/categories')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const cats = (data.data?.categories || data.data || []).map((c: any) => c.name || c)
          setCategories(cats.filter((c: string) => c))
        }
      }
    } catch {} finally { setLoadingCategories(false) }
  }

  const fetchProducts = async (search: string) => {
    setLoadingProducts(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/mkt/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) setProducts(data.data || [])
      }
    } catch {} finally { setLoadingProducts(false) }
  }

  const fetchPlatformStatuses = async () => {
    setLoadingPlatforms(true)
    try {
      const res = await fetch('/api/mkt/settings/integrations')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setPlatformStatuses(data.data?.platforms || [])
      }
    } catch {} finally { setLoadingPlatforms(false) }
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  const toggleProduct = (product: Product) => {
    setSelectedProducts(prev =>
      prev.find(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    )
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform])
  }

  const validateStep = (step: Step): boolean => {
    switch (step) {
      case 'basics': return !!agentType && !!agentId.trim() && !!agentName.trim()
      case 'products': return true // optional
      case 'channels': return true // optional
      case 'review': return true
      default: return false
    }
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const config: Record<string, any> = {}
      if (selectedProducts.length > 0) config.targetProducts = selectedProducts.map(p => p.id)
      if (selectedCategories.length > 0) config.targetCategories = selectedCategories
      if (selectedPlatforms.length > 0) {
        config.platformAuth = {}
        for (const p of selectedPlatforms) {
          config.platformAuth[p] = { useCompanyCredentials: true }
        }
      }

      const res = await fetch('/api/mkt/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentId.trim(),
          name: agentName.trim(),
          type: agentType,
          description: agentDescription.trim() || null,
          channels: selectedPlatforms,
          config
        })
      })

      const data = await res.json()
      if (data.success) {
        setCreatedToken(data.data?.token || null)
      } else {
        alert(data.error || 'Error al crear agente')
      }
    } catch {
      alert('Error de conexion')
    } finally {
      setCreating(false)
    }
  }

  const copyToken = () => {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href="/dashboard/market/marketing/agents">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn('p-2 rounded-xl', theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')}
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crear Agente</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configura tu agente de marketing IA</p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8 sm:mb-10">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14">
                      {currentStep === step.id && !createdToken && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          style={{ background: theme === 'dark' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(5, 150, 105, 0.5)' }}
                        />
                      )}
                      <motion.div
                        initial={false}
                        animate={{
                          scale: currentStep === step.id ? 1.1 : 1,
                          backgroundColor: currentStep === step.id
                            ? theme === 'dark' ? '#10B981' : '#059669'
                            : currentStepIndex > index || createdToken
                              ? theme === 'dark' ? '#10B981' : '#059669'
                              : theme === 'dark' ? '#374151' : '#E5E7EB'
                        }}
                        transition={{ scale: { duration: 0.3 }, backgroundColor: { duration: 0.3 } }}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center relative z-10 transition-shadow duration-300",
                          currentStep === step.id && (theme === 'dark' ? 'shadow-lg shadow-emerald-500/50' : 'shadow-lg shadow-emerald-400/50'),
                          (currentStepIndex > index || createdToken) && (theme === 'dark' ? 'shadow-md shadow-emerald-500/30' : 'shadow-md shadow-emerald-400/30')
                        )}
                      >
                        {currentStepIndex > index || createdToken ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
                            <Check className="w-7 h-7 text-white" />
                          </motion.div>
                        ) : (
                          <step.icon className={cn("w-7 h-7", currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        )}
                      </motion.div>
                    </div>
                    <div className="mt-3 text-center">
                      <p className={cn("text-xs sm:text-sm font-semibold",
                        currentStep === step.id ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          : currentStepIndex > index || createdToken ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>{step.title}</p>
                      <p className={cn("text-xs hidden sm:block mt-0.5", theme === 'dark' ? 'text-gray-600' : 'text-gray-500')}>{step.description}</p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                      <div className={cn("absolute inset-0 rounded-full", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                      <motion.div
                        initial={false}
                        animate={{ scaleX: currentStepIndex > index || createdToken ? 1 : 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className={cn("h-full origin-left rounded-full", theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600')}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <motion.div className={cn(
            "rounded-2xl border p-6 shadow-lg",
            theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white border-gray-200'
          )}>
            <AnimatePresence mode="wait">
              {/* STEP 1: Basics */}
              {currentStep === 'basics' && (
                <motion.div key="basics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Tipo de Agente</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Selecciona el rol que tendra este agente</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {AGENT_TYPES.map(t => {
                      const Icon = t.icon
                      const selected = agentType === t.value
                      return (
                        <motion.button
                          key={t.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setAgentType(t.value)}
                          className={cn(
                            'p-4 rounded-xl border-2 text-left transition-all',
                            selected
                              ? 'border-emerald-500 shadow-lg shadow-emerald-500/20'
                              : theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-gradient-to-br', t.gradient)}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{t.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
                        </motion.button>
                      )
                    })}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID del Agente *</label>
                        <input
                          type="text" value={agentId} onChange={e => setAgentId(e.target.value)}
                          placeholder="ej: price-hunter-01"
                          className={cn('w-full px-3 py-2.5 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                        <input
                          type="text" value={agentName} onChange={e => setAgentName(e.target.value)}
                          placeholder="ej: Investigador de Precios"
                          className={cn('w-full px-3 py-2.5 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripcion</label>
                      <textarea
                        value={agentDescription} onChange={e => setAgentDescription(e.target.value)}
                        placeholder="Que hara este agente..."
                        rows={2}
                        className={cn('w-full px-3 py-2.5 rounded-xl border text-sm resize-none', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Products & Categories */}
              {currentStep === 'products' && (
                <motion.div key="products" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Productos y Categorias</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Selecciona los productos o categorias que el agente debe monitorear</p>

                  {/* Selected chips */}
                  {(selectedCategories.length > 0 || selectedProducts.length > 0) && (
                    <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                      {selectedCategories.map(cat => (
                        <span key={`cat-${cat}`} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">
                          {cat}
                          <button onClick={() => toggleCategory(cat)}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      {selectedProducts.map(p => (
                        <span key={`prod-${p.id}`} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                          {p.name}
                          <button onClick={() => toggleProduct(p)}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Categories */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Categorias</h3>
                      <div className={cn('rounded-xl border p-3 max-h-64 overflow-y-auto', theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                        {loadingCategories ? (
                          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                        ) : categories.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">Sin categorias disponibles</p>
                        ) : categories.map(cat => (
                          <label key={cat} className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm',
                            theme === 'dark' ? 'hover:bg-gray-600/50' : 'hover:bg-gray-100'
                          )}>
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(cat)}
                              onChange={() => toggleCategory(cat)}
                              className="rounded text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="text-gray-700 dark:text-gray-300">{cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Products */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Productos</h3>
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                          placeholder="Buscar producto..."
                          className={cn('w-full pl-8 pr-3 py-2 rounded-xl border text-sm', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200')}
                        />
                      </div>
                      <div className={cn('rounded-xl border max-h-52 overflow-y-auto', theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                        {loadingProducts ? (
                          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                        ) : products.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
                        ) : products.map(p => {
                          const isSelected = selectedProducts.some(sp => sp.id === p.id)
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggleProduct(p)}
                              className={cn(
                                'w-full flex items-center justify-between px-3 py-2 text-left transition-colors border-b last:border-b-0',
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30'
                                  : theme === 'dark' ? 'hover:bg-gray-600/50 border-gray-600/50' : 'hover:bg-gray-100 border-gray-100'
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</p>
                                <p className="text-xs text-gray-400">{p.sku} {p.category && `· ${p.category}`}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">${p.sellingPrice.toFixed(2)}</span>
                                {isSelected && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Channels */}
              {currentStep === 'channels' && (
                <motion.div key="channels" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Canales y Plataformas</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Selecciona las plataformas donde operara el agente</p>

                  {loadingPlatforms ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(PLATFORM_CONFIG).map(([key, conf]) => {
                        const Icon = conf.icon
                        const status = platformStatuses.find(p => p.platform === key)
                        const isConfigured = status?.configured || false
                        const isSelected = selectedPlatforms.includes(key)

                        return (
                          <motion.div
                            key={key}
                            whileHover={{ scale: 1.01 }}
                            className={cn(
                              'rounded-xl border-2 overflow-hidden transition-all',
                              isSelected
                                ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
                                : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                            )}
                          >
                            <div className={cn('bg-gradient-to-r px-4 py-3 flex items-center justify-between', conf.gradient)}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-5 h-5 text-white" />
                                <span className="font-semibold text-white text-sm">{conf.label}</span>
                              </div>
                              <button
                                onClick={() => togglePlatform(key)}
                                className={cn(
                                  'w-10 h-6 rounded-full transition-colors relative',
                                  isSelected ? 'bg-white/30' : 'bg-white/10'
                                )}
                              >
                                <motion.div
                                  animate={{ x: isSelected ? 16 : 2 }}
                                  className="w-5 h-5 rounded-full bg-white shadow absolute top-0.5"
                                />
                              </button>
                            </div>
                            <div className={cn('px-4 py-3', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                              <div className="flex items-center gap-2">
                                {isConfigured ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" /> Credenciales configuradas
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Sin configurar
                                  </span>
                                )}
                              </div>
                              {!isConfigured && (
                                <Link
                                  href="/dashboard/market/marketing/settings"
                                  className="text-xs text-blue-500 hover:text-blue-600 mt-1 inline-block"
                                >
                                  Configurar en Ajustes →
                                </Link>
                              )}
                              {isConfigured && isSelected && (
                                <p className="text-xs text-gray-400 mt-1">Usara las credenciales de la empresa</p>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 4: Review */}
              {currentStep === 'review' && !createdToken && (
                <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Revision Final</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Verifica la configuracion del agente</p>

                  <div className="space-y-4">
                    {/* Agent Info */}
                    <div className={cn('rounded-xl border p-4', theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <div className="flex items-center gap-3 mb-3">
                        {(() => {
                          const t = AGENT_TYPES.find(at => at.value === agentType)
                          if (!t) return null
                          const Icon = t.icon
                          return (
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', t.gradient)}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                          )
                        })()}
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{agentName}</p>
                          <p className="text-xs text-gray-400">{agentId} · {AGENT_TYPES.find(t => t.value === agentType)?.label}</p>
                        </div>
                      </div>
                      {agentDescription && <p className="text-sm text-gray-500 dark:text-gray-400">{agentDescription}</p>}
                    </div>

                    {/* Products */}
                    <div className={cn('rounded-xl border p-4', theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Productos y Categorias</p>
                      {selectedCategories.length === 0 && selectedProducts.length === 0 ? (
                        <p className="text-xs text-gray-400">Todos los productos (sin filtro especifico)</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCategories.map(c => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{c}</span>
                          ))}
                          {selectedProducts.map(p => (
                            <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{p.name}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Channels */}
                    <div className={cn('rounded-xl border p-4', theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Plataformas</p>
                      {selectedPlatforms.length === 0 ? (
                        <p className="text-xs text-gray-400">Ninguna plataforma seleccionada</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedPlatforms.map(p => {
                            const conf = PLATFORM_CONFIG[p]
                            const Icon = conf?.icon || Globe
                            return (
                              <span key={p} className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full text-white font-medium bg-gradient-to-r', conf?.gradient || 'from-gray-500 to-gray-600')}>
                                <Icon className="w-3.5 h-3.5" />
                                {conf?.label || p}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreate}
                    disabled={creating}
                    className="w-full mt-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/25 transition-all"
                  >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Crear Agente'}
                  </motion.button>
                </motion.div>
              )}

              {/* Token Display */}
              {createdToken && (
                <motion.div key="token" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30"
                    >
                      <Check className="w-8 h-8 text-white" />
                    </motion.div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Agente Creado</h2>
                    <p className="text-sm text-red-500 dark:text-red-400 font-medium mb-4">Este token solo se mostrara UNA VEZ. Copialo ahora.</p>

                    <div className={cn('p-4 rounded-xl border font-mono text-sm break-all text-left', theme === 'dark' ? 'bg-gray-700 border-gray-600 text-green-400' : 'bg-gray-50 border-gray-200 text-gray-800')}>
                      {createdToken}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={copyToken}
                      className={cn(
                        'w-full mt-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all',
                        tokenCopied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                      )}
                    >
                      {tokenCopied ? <><Check className="w-5 h-5" /> Copiado</> : <><Copy className="w-5 h-5" /> Copiar Token</>}
                    </motion.button>

                    <button
                      onClick={() => router.push('/dashboard/market/marketing/agents')}
                      className={cn('w-full mt-2 py-3 rounded-xl text-sm font-medium border', theme === 'dark' ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
                    >
                      Volver a Agentes
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Navigation Buttons */}
          {!createdToken && (
            <div className="flex items-center justify-between mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all',
                  currentStepIndex === 0 ? 'opacity-30 cursor-not-allowed' : '',
                  theme === 'dark' ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <ArrowLeft className="w-4 h-4" /> Anterior
              </motion.button>

              {currentStep !== 'review' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  disabled={!validateStep(currentStep)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-500/25 transition-all"
                >
                  Siguiente <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
