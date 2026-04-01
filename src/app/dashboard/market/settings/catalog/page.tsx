'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store, Phone, Globe, Save, Loader2, ExternalLink, Copy, Check,
  CheckCircle, MessageCircle, Instagram, Facebook, Send, MapPin,
  ArrowLeft, ArrowRight, Eye, Image as ImageIcon, Tag, Settings, Palette,
  Upload, Smartphone, X, Trash2
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { PhoneUploadModal } from '@/components/uploads/PhoneUploadModal'

type Step = 'store' | 'contact' | 'categories' | 'options' | 'domain'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'store', title: 'Tienda', description: 'Nombre y marca', icon: Store },
  { id: 'contact', title: 'Contacto', description: 'Datos y redes', icon: Phone },
  { id: 'categories', title: 'Categorías', description: 'Qué publicar', icon: Tag },
  { id: 'options', title: 'Opciones', description: 'Configuración', icon: Settings },
  { id: 'domain', title: 'Dominio', description: 'URL y DNS', icon: Globe }
]

interface FormData {
  storeName: string; description: string; logoUrl: string; primaryColor: string
  phone: string; whatsapp: string; email: string; address: string; city: string; province: string
  facebookUrl: string; instagramUrl: string; telegramUrl: string
  categories: string[]; showStock: boolean; showUsdPrice: boolean; showCupPrice: boolean
  customDomain: string; isActive: boolean
}

const defaultForm: FormData = {
  storeName: '', description: '', logoUrl: '', primaryColor: '#f97316',
  phone: '', whatsapp: '', email: '', address: '', city: '', province: '',
  facebookUrl: '', instagramUrl: '', telegramUrl: '',
  categories: [], showStock: true, showUsdPrice: true, showCupPrice: true,
  customDomain: '', isActive: true
}

export default function CatalogSettingsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [form, setForm] = useState<FormData>(defaultForm)
  const [currentStep, setCurrentStep] = useState<Step>('store')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [catalogUrl, setCatalogUrl] = useState('')
  const [catalogSlug, setCatalogSlug] = useState('')
  const [dnsInstructions, setDnsInstructions] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [catalogExists, setCatalogExists] = useState(false)
  const [showPhoneUpload, setShowPhoneUpload] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  useEffect(() => { fetchConfig() }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/catalog/config')
      const data = await res.json()
      if (data.success && data.data) {
        setAvailableCategories(data.data.availableCategories || [])
        if (data.data.exists) {
          setCatalogExists(true)
          setCatalogSlug(data.data.slug || '')
          setCatalogUrl(data.data.catalogUrl || data.data.publicUrl || '')
          setDnsInstructions(data.data.dns_instructions)
          setForm({
            storeName: data.data.store_name || '',
            description: data.data.description || '',
            logoUrl: data.data.logo_url || '',
            primaryColor: data.data.primary_color || '#f97316',
            phone: data.data.phone || '',
            whatsapp: data.data.whatsapp || '',
            email: data.data.email || '',
            address: data.data.address || '',
            city: data.data.city || '',
            province: data.data.province || '',
            facebookUrl: data.data.facebook_url || '',
            instagramUrl: data.data.instagram_url || '',
            telegramUrl: data.data.telegram_url || '',
            categories: data.data.categories || [],
            showStock: data.data.show_stock !== false,
            showUsdPrice: data.data.show_usd_price !== false,
            showCupPrice: data.data.show_cup_price !== false,
            customDomain: data.data.custom_domain || '',
            isActive: data.data.is_active !== false
          })
        }
      }
    } catch {} finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!form.storeName.trim()) return
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/market/catalog/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, bannerUrl: null })
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setCatalogUrl(data.data.catalogUrl)
        setCatalogSlug(data.data.slug)
        setDnsInstructions(data.data.dnsInstructions)
        setCatalogExists(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {} finally { setSaving(false) }
  }

  const goNext = () => {
    const next = currentStepIndex + 1
    if (next < STEPS.length) setCurrentStep(STEPS[next].id)
    else handleSave()
  }

  const goPrev = () => {
    const prev = currentStepIndex - 1
    if (prev >= 0) setCurrentStep(STEPS[prev].id)
  }

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputClass = cn(
    'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all',
    isDark ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
  )

  if (loading) return (
    <ProtectedRoute><DashboardLayout>
      <div className="flex items-center justify-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
    </DashboardLayout></ProtectedRoute>
  )

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/market/settings">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl', isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  <ArrowLeft className="w-4 h-4" /><span className="font-medium">Volver</span>
                </motion.button>
              </Link>
              <div>
                <h1 className={cn('text-xl sm:text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Catálogo Digital</h1>
                <p className="text-xs sm:text-sm text-gray-500">Tu tienda online para redes sociales</p>
              </div>
            </div>
            {catalogExists && catalogUrl && (
              <a href={catalogUrl.startsWith('http') ? catalogUrl : catalogUrl} target="_blank" rel="noopener"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 text-xs sm:text-sm font-medium">
                <Eye className="w-4 h-4" /> Ver
              </a>
            )}
          </div>

          {/* Success */}
          <AnimatePresence>
            {saved && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700 dark:text-green-300 text-sm font-medium">Catálogo guardado exitosamente</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => setCurrentStep(step.id)}>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14">
                      {currentStep === step.id && (
                        <motion.div className="absolute inset-0 rounded-full"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ background: 'rgba(249, 115, 22, 0.4)' }} />
                      )}
                      <motion.div
                        animate={{
                          scale: currentStep === step.id ? 1.1 : 1,
                          backgroundColor: currentStep === step.id
                            ? '#f97316'
                            : currentStepIndex > index
                              ? '#10B981'
                              : isDark ? '#374151' : '#E5E7EB'
                        }}
                        className={cn(
                          'w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center relative z-10 transition-shadow',
                          currentStep === step.id && 'shadow-lg shadow-orange-500/40',
                          currentStepIndex > index && 'shadow-md shadow-green-500/30'
                        )}
                      >
                        {currentStepIndex > index ? (
                          <Check className="w-6 h-6 text-white" />
                        ) : (
                          <step.icon className={cn('w-6 h-6', currentStep === step.id ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400')} />
                        )}
                      </motion.div>
                    </div>
                    <p className={cn('mt-2 text-[10px] sm:text-xs font-semibold text-center',
                      currentStep === step.id ? 'text-orange-500' : currentStepIndex > index ? 'text-green-600' : 'text-gray-400'
                    )}>{step.title}</p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn('flex-1 h-1 rounded-full mx-1 sm:mx-2 mt-[-20px]',
                      currentStepIndex > index ? 'bg-green-500' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className={cn('rounded-2xl border p-6', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm')}>

              {/* Step: Store */}
              {currentStep === 'store' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Store className="w-5 h-5 text-orange-500" /></div>
                    <div><h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Datos de la Tienda</h2>
                      <p className="text-xs text-gray-500">Nombre, logo y marca de tu catálogo</p></div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">Nombre de la Tienda *</label>
                    <input value={form.storeName} onChange={e => setForm({ ...form, storeName: e.target.value })} placeholder="Ej: ServiSumic Ferretería" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">Descripción</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Tu ferretería de confianza en La Habana..." className={inputClass} />
                  </div>

                  {/* Logo Upload */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Logo de la Tienda</label>
                    {form.logoUrl ? (
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 relative">
                          <Image src={form.logoUrl} alt="Logo" fill className="object-cover" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => setForm({ ...form, logoUrl: '' })}
                            className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600',
                              isDark ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-red-50 hover:bg-red-100')}>
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                          <label className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer',
                            isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}>
                            <Upload className="w-4 h-4" /> Cambiar
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setUploadingLogo(true)
                              try {
                                const formData = new FormData()
                                formData.append('file', file)
                                formData.append('folder', 'catalog-logos')
                                const res = await fetch('/api/upload/image', { method: 'POST', body: formData })
                                const data = await res.json()
                                if (data.success && data.url) setForm(prev => ({ ...prev, logoUrl: data.url }))
                              } catch {} finally { setUploadingLogo(false) }
                            }} />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Drag & Drop area */}
                        <label className={cn(
                          'flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                          uploadingLogo ? 'opacity-60' :
                          isDark ? 'border-gray-600 hover:border-orange-500 bg-gray-900/30' : 'border-gray-300 hover:border-orange-500 bg-gray-50'
                        )}>
                          {uploadingLogo ? (
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-gray-400 mb-2" />
                              <p className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Arrastra o haz clic para subir</p>
                              <p className="text-xs text-gray-400 mt-1">PNG, JPG o WEBP</p>
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploadingLogo(true)
                            try {
                              const fd = new FormData()
                              fd.append('file', file)
                              fd.append('folder', 'catalog-logos')
                              const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
                              const data = await res.json()
                              if (data.success && data.url) setForm(prev => ({ ...prev, logoUrl: data.url }))
                            } catch {} finally { setUploadingLogo(false) }
                          }} />
                        </label>

                        {/* Phone upload button */}
                        <button onClick={() => setShowPhoneUpload(true)}
                          className={cn('w-full py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm border transition-all',
                            isDark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
                          <Smartphone className="w-4 h-4" />
                          Subir desde el teléfono
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Color Principal</label>
                    <div className="flex gap-3 items-center">
                      <input type="color" value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="w-12 h-12 rounded-xl border-2 cursor-pointer" />
                      <input value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className={cn(inputClass, 'flex-1')} />
                      <div className="w-20 h-12 rounded-xl" style={{ backgroundColor: form.primaryColor }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Contact */}
              {currentStep === 'contact' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Phone className="w-5 h-5 text-orange-500" /></div>
                    <div><h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Contacto y Ubicación</h2>
                      <p className="text-xs text-gray-500">Cómo te contactan tus clientes</p></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-1 block">Teléfono</label>
                      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+53 5555 5555" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-green-500" /> WhatsApp</label>
                      <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="+53 5555 5555" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-1 block">Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="info@mitienda.com" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Dirección</label>
                      <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Calle 23 #456" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-1 block">Ciudad</label>
                      <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="La Habana" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-1 block">Provincia</label>
                      <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} placeholder="La Habana" className={inputClass} />
                    </div>
                  </div>
                  <div className="border-t pt-4 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-500 mb-3">Redes Sociales</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</label>
                        <input value={form.instagramUrl} onChange={e => setForm({ ...form, instagramUrl: e.target.value })} placeholder="https://instagram.com/..." className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Facebook className="w-3 h-3" /> Facebook</label>
                        <input value={form.facebookUrl} onChange={e => setForm({ ...form, facebookUrl: e.target.value })} placeholder="https://facebook.com/..." className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Send className="w-3 h-3" /> Telegram</label>
                        <input value={form.telegramUrl} onChange={e => setForm({ ...form, telegramUrl: e.target.value })} placeholder="https://t.me/..." className={inputClass} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Categories */}
              {currentStep === 'categories' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Tag className="w-5 h-5 text-orange-500" /></div>
                    <div><h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Categorías a Publicar</h2>
                      <p className="text-xs text-gray-500">Selecciona qué categorías mostrar en el catálogo. Si no seleccionas ninguna, se muestran todas.</p></div>
                  </div>

                  {availableCategories.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">{form.categories.length === 0 ? 'Todas las categorías' : `${form.categories.length} seleccionadas`}</span>
                        <button onClick={() => setForm({ ...form, categories: form.categories.length === availableCategories.length ? [] : [...availableCategories] })}
                          className="text-xs text-orange-500 font-medium hover:text-orange-600">
                          {form.categories.length === availableCategories.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableCategories.map(cat => (
                          <motion.button key={cat} whileTap={{ scale: 0.97 }}
                            onClick={() => toggleCategory(cat)}
                            className={cn('px-4 py-3 rounded-xl text-sm font-medium transition-all border text-left',
                              form.categories.includes(cat)
                                ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                                : isDark ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-500'
                            )}>
                            <span className="flex items-center gap-2">
                              {form.categories.includes(cat) && <Check className="w-4 h-4" />}
                              {cat}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Tag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No hay categorías en el inventario</p>
                      <p className="text-xs text-gray-400 mt-1">Agrega categorías a tus productos en el inventario primero</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step: Options */}
              {currentStep === 'options' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Settings className="w-5 h-5 text-orange-500" /></div>
                    <div><h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Opciones de Visualización</h2>
                      <p className="text-xs text-gray-500">Configura qué información mostrar en el catálogo</p></div>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: 'showStock' as keyof FormData, label: 'Mostrar cantidad disponible', desc: 'Los clientes verán cuántas unidades hay en stock' },
                      { key: 'showUsdPrice' as keyof FormData, label: 'Mostrar precio en USD', desc: 'Muestra el precio en dólares americanos' },
                      { key: 'showCupPrice' as keyof FormData, label: 'Mostrar precio en CUP', desc: 'Muestra el precio convertido a pesos cubanos' },
                      { key: 'isActive' as keyof FormData, label: 'Catálogo activo', desc: 'Cuando está desactivado, el catálogo no es visible al público' }
                    ].map(opt => (
                      <label key={opt.key} className={cn('flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all',
                        (form as any)[opt.key]
                          ? isDark ? 'border-orange-700 bg-orange-900/10' : 'border-orange-300 bg-orange-50'
                          : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                      )}>
                        <input type="checkbox" checked={(form as any)[opt.key]}
                          onChange={e => setForm({ ...form, [opt.key]: e.target.checked })}
                          className="w-5 h-5 mt-0.5 rounded accent-orange-500" />
                        <div>
                          <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>{opt.label}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step: Domain */}
              {currentStep === 'domain' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Globe className="w-5 h-5 text-orange-500" /></div>
                    <div><h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Dominio y URL</h2>
                      <p className="text-xs text-gray-500">Configura la dirección web de tu catálogo</p></div>
                  </div>

                  {/* Current URL */}
                  {(catalogExists || catalogSlug) && (
                    <div className={cn('p-4 rounded-xl', isDark ? 'bg-gray-700/50' : 'bg-orange-50')}>
                      <p className="text-xs text-gray-500 mb-1">URL de tu catálogo</p>
                      <div className="flex items-center gap-2">
                        <code className={cn('text-sm font-mono font-bold flex-1 break-all', isDark ? 'text-orange-400' : 'text-orange-600')}>
                          {catalogUrl || `/catalog/${catalogSlug}`}
                        </code>
                        <button onClick={() => copyToClipboard(`${window.location.origin}${catalogUrl.startsWith('/') ? catalogUrl : `/catalog/${catalogSlug}`}`)}
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 shrink-0">
                          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        </button>
                        <a href={catalogUrl.startsWith('http') ? catalogUrl : `/catalog/${catalogSlug}`} target="_blank" rel="noopener"
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 shrink-0">
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">Dominio Propio (opcional)</label>
                    <input value={form.customDomain} onChange={e => setForm({ ...form, customDomain: e.target.value })} placeholder="mitienda.com" className={inputClass} />
                    <p className="text-xs text-gray-400 mt-1">Si tienes un dominio propio, escríbelo aquí. Al guardar te daremos las instrucciones DNS.</p>
                  </div>

                  {/* DNS Instructions */}
                  {(dnsInstructions) && (
                    <div className={cn('p-4 rounded-xl border', isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <h3 className={cn('font-semibold text-sm mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                        Instrucciones DNS para {dnsInstructions.domain}
                      </h3>
                      <div className="space-y-2">
                        {(dnsInstructions.records || []).map((r: any, i: number) => (
                          <div key={i} className={cn('p-3 rounded-lg font-mono text-xs', isDark ? 'bg-gray-800' : 'bg-white border')}>
                            <div className="grid grid-cols-3 gap-2">
                              <div><span className="text-gray-400">Tipo:</span> <span className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{r.type}</span></div>
                              <div><span className="text-gray-400">Nombre:</span> <span className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{r.name}</span></div>
                              <div><span className="text-gray-400">Valor:</span> <span className="font-bold text-orange-500">{r.value}</span></div>
                            </div>
                            {r.note && <p className="text-gray-400 mt-1 text-[10px]">{r.note}</p>}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">{dnsInstructions.note}</p>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={goPrev}
              disabled={currentStepIndex === 0}
              className={cn('flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all disabled:opacity-30',
                isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <ArrowLeft className="w-4 h-4" /> Anterior
            </motion.button>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={goNext}
              disabled={saving || (currentStepIndex === 0 && !form.storeName.trim())}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 shadow-lg shadow-orange-500/20">
              {currentStepIndex === STEPS.length - 1 ? (
                saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4" /> Guardar Catálogo</>
              ) : (
                <>Siguiente <ArrowRight className="w-4 h-4" /></>
              )}
            </motion.button>
          </div>

        </div>
      </div>
    </DashboardLayout>

    {/* Phone Upload Modal */}
    <PhoneUploadModal
      isOpen={showPhoneUpload}
      onClose={() => setShowPhoneUpload(false)}
      purpose="product_image"
      onUploadComplete={async (fileUrl: string) => {
        setShowPhoneUpload(false)
        setUploadingLogo(true)
        try {
          const response = await fetch(`/api/upload/image?path=${encodeURIComponent(fileUrl)}&bucket=company-private-documents`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.url) {
              setForm(prev => ({ ...prev, logoUrl: data.url }))
            }
          }
        } catch {} finally { setUploadingLogo(false) }
      }}
    />
    </ProtectedRoute>
  )
}
