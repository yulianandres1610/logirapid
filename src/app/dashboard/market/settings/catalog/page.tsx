'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Store, Image as ImageIcon, Phone, Globe, Save, Loader2, ExternalLink, Copy,
  CheckCircle, MessageCircle, Instagram, Facebook, Send, MapPin, Mail, ArrowLeft, Eye
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface CatalogConfig {
  id?: number
  slug?: string
  store_name: string
  description: string
  logo_url: string
  banner_url: string
  primary_color: string
  phone: string
  whatsapp: string
  email: string
  address: string
  city: string
  province: string
  facebook_url: string
  instagram_url: string
  telegram_url: string
  categories: string[]
  show_stock: boolean
  show_usd_price: boolean
  show_cup_price: boolean
  custom_domain: string
  is_active: boolean
  availableCategories?: string[]
  catalogUrl?: string
  publicUrl?: string
  dns_instructions?: any
}

const defaultConfig: CatalogConfig = {
  store_name: '', description: '', logo_url: '', banner_url: '', primary_color: '#f97316',
  phone: '', whatsapp: '', email: '', address: '', city: '', province: '',
  facebook_url: '', instagram_url: '', telegram_url: '',
  categories: [], show_stock: true, show_usd_price: true, show_cup_price: true,
  custom_domain: '', is_active: true
}

export default function CatalogSettingsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [config, setConfig] = useState<CatalogConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [catalogUrl, setCatalogUrl] = useState('')
  const [dnsInstructions, setDnsInstructions] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/catalog/config')
      const data = await res.json()
      if (data.success && data.data) {
        setConfig({
          ...defaultConfig,
          ...data.data,
          store_name: data.data.store_name || '',
          description: data.data.description || '',
          logo_url: data.data.logo_url || '',
          banner_url: data.data.banner_url || '',
          primary_color: data.data.primary_color || '#f97316',
          phone: data.data.phone || '',
          whatsapp: data.data.whatsapp || '',
          email: data.data.email || '',
          address: data.data.address || '',
          city: data.data.city || '',
          province: data.data.province || '',
          facebook_url: data.data.facebook_url || '',
          instagram_url: data.data.instagram_url || '',
          telegram_url: data.data.telegram_url || '',
          categories: data.data.categories || [],
          custom_domain: data.data.custom_domain || '',
          dns_instructions: data.data.dns_instructions
        })
        setAvailableCategories(data.data.availableCategories || [])
        setCatalogUrl(data.data.catalogUrl || data.data.publicUrl || '')
        setDnsInstructions(data.data.dns_instructions)
      } else {
        // No catalog yet, fetch categories
        const catRes = await fetch('/api/market/catalog/config')
        const catData = await catRes.json()
        if (catData.success && catData.data?.availableCategories) {
          setAvailableCategories(catData.data.availableCategories)
        }
      }
    } catch {} finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!config.store_name.trim()) return
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/market/catalog/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: config.store_name,
          description: config.description,
          logoUrl: config.logo_url,
          bannerUrl: config.banner_url,
          primaryColor: config.primary_color,
          phone: config.phone,
          whatsapp: config.whatsapp,
          email: config.email,
          address: config.address,
          city: config.city,
          province: config.province,
          facebookUrl: config.facebook_url,
          instagramUrl: config.instagram_url,
          telegramUrl: config.telegram_url,
          categories: config.categories,
          showStock: config.show_stock,
          showUsdPrice: config.show_usd_price,
          showCupPrice: config.show_cup_price,
          customDomain: config.custom_domain,
          isActive: config.is_active
        })
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setCatalogUrl(data.data.catalogUrl)
        setDnsInstructions(data.data.dnsInstructions)
        setTimeout(() => setSaved(false), 3000)
        fetchConfig()
      }
    } catch {} finally { setSaving(false) }
  }

  const toggleCategory = (cat: string) => {
    setConfig(prev => ({
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
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/market/settings">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl', isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  <ArrowLeft className="w-4 h-4" /><span>Volver</span>
                </motion.button>
              </Link>
              <div>
                <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Catálogo Digital</h1>
                <p className="text-sm text-gray-500">Configura tu tienda online para redes sociales</p>
              </div>
            </div>
            {catalogUrl && (
              <a href={catalogUrl.startsWith('http') ? catalogUrl : `${window.location.origin}${catalogUrl}`} target="_blank" rel="noopener"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 text-sm font-medium">
                <Eye className="w-4 h-4" /> Ver Catálogo
              </a>
            )}
          </div>

          {/* Success */}
          {saved && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-700 dark:text-green-300 text-sm font-medium">Catálogo guardado exitosamente</span>
            </motion.div>
          )}

          <div className="space-y-6">

            {/* Store Info */}
            <div className={cn('p-6 rounded-2xl border', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
              <h2 className={cn('font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Store className="w-5 h-5 text-orange-500" /> Datos de la Tienda
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Nombre de la Tienda *</label>
                  <input value={config.store_name} onChange={e => setConfig({ ...config, store_name: e.target.value })} placeholder="Mi Ferretería" className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Descripción</label>
                  <textarea value={config.description} onChange={e => setConfig({ ...config, description: e.target.value })} rows={2} placeholder="Tu ferretería de confianza..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">URL del Logo</label>
                  <input value={config.logo_url} onChange={e => setConfig({ ...config, logo_url: e.target.value })} placeholder="https://..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">URL del Banner</label>
                  <input value={config.banner_url} onChange={e => setConfig({ ...config, banner_url: e.target.value })} placeholder="https://..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Color Principal</label>
                  <div className="flex gap-2">
                    <input type="color" value={config.primary_color} onChange={e => setConfig({ ...config, primary_color: e.target.value })} className="w-12 h-12 rounded-xl border cursor-pointer" />
                    <input value={config.primary_color} onChange={e => setConfig({ ...config, primary_color: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className={cn('p-6 rounded-2xl border', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
              <h2 className={cn('font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Phone className="w-5 h-5 text-orange-500" /> Contacto y Ubicación
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Teléfono</label>
                  <input value={config.phone} onChange={e => setConfig({ ...config, phone: e.target.value })} placeholder="+53 5555 5555" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">WhatsApp</label>
                  <input value={config.whatsapp} onChange={e => setConfig({ ...config, whatsapp: e.target.value })} placeholder="+53 5555 5555" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Email</label>
                  <input type="email" value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} placeholder="info@mitienda.com" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Dirección</label>
                  <input value={config.address} onChange={e => setConfig({ ...config, address: e.target.value })} placeholder="Calle 23 #456" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Ciudad</label>
                  <input value={config.city} onChange={e => setConfig({ ...config, city: e.target.value })} placeholder="La Habana" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Provincia</label>
                  <input value={config.province} onChange={e => setConfig({ ...config, province: e.target.value })} placeholder="La Habana" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</label>
                  <input value={config.instagram_url} onChange={e => setConfig({ ...config, instagram_url: e.target.value })} placeholder="https://instagram.com/..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><Facebook className="w-3.5 h-3.5" /> Facebook</label>
                  <input value={config.facebook_url} onChange={e => setConfig({ ...config, facebook_url: e.target.value })} placeholder="https://facebook.com/..." className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><Send className="w-3.5 h-3.5" /> Telegram</label>
                  <input value={config.telegram_url} onChange={e => setConfig({ ...config, telegram_url: e.target.value })} placeholder="https://t.me/..." className={inputClass} />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className={cn('p-6 rounded-2xl border', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
              <h2 className={cn('font-semibold mb-2 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <ImageIcon className="w-5 h-5 text-orange-500" /> Categorías a Publicar
              </h2>
              <p className="text-xs text-gray-500 mb-4">Selecciona qué categorías del inventario mostrar. Si no seleccionas ninguna, se muestran todas.</p>
              {availableCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map(cat => (
                    <button key={cat} onClick={() => toggleCategory(cat)}
                      className={cn('px-4 py-2 rounded-full text-sm font-medium transition-all border',
                        config.categories.includes(cat)
                          ? 'bg-orange-500 text-white border-orange-500'
                          : isDark ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-500'
                      )}>
                      {cat}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No hay categorías en el inventario. Agrega categorías a tus productos primero.</p>
              )}
            </div>

            {/* Display Options */}
            <div className={cn('p-6 rounded-2xl border', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
              <h2 className={cn('font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Opciones de Visualización</h2>
              <div className="space-y-3">
                {[
                  { key: 'show_stock', label: 'Mostrar cantidad disponible' },
                  { key: 'show_usd_price', label: 'Mostrar precio en USD' },
                  { key: 'show_cup_price', label: 'Mostrar precio en CUP' },
                  { key: 'is_active', label: 'Catálogo activo (visible al público)' }
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={(config as any)[opt.key]}
                      onChange={e => setConfig({ ...config, [opt.key]: e.target.checked })}
                      className="w-5 h-5 rounded accent-orange-500" />
                    <span className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Domain */}
            <div className={cn('p-6 rounded-2xl border', isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
              <h2 className={cn('font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Globe className="w-5 h-5 text-orange-500" /> Dominio
              </h2>

              {config.slug && (
                <div className={cn('p-4 rounded-xl mb-4', isDark ? 'bg-gray-700/50' : 'bg-orange-50')}>
                  <p className="text-xs text-gray-500 mb-1">URL de tu catálogo</p>
                  <div className="flex items-center gap-2">
                    <code className={cn('text-sm font-mono font-bold flex-1', isDark ? 'text-orange-400' : 'text-orange-600')}>
                      {catalogUrl || `/catalog/${config.slug}`}
                    </code>
                    <button onClick={() => copyToClipboard(catalogUrl.startsWith('http') ? catalogUrl : `${window.location.origin}/catalog/${config.slug}`)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                      {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                    <a href={catalogUrl.startsWith('http') ? catalogUrl : `/catalog/${config.slug}`} target="_blank" rel="noopener"
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-500 mb-1 block">Dominio Propio (opcional)</label>
                <input value={config.custom_domain} onChange={e => setConfig({ ...config, custom_domain: e.target.value })} placeholder="mitienda.com" className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">Si tienes un dominio propio, escríbelo aquí y te daremos las instrucciones DNS</p>
              </div>

              {/* DNS Instructions */}
              {(dnsInstructions || config.dns_instructions) && (
                <div className={cn('mt-4 p-4 rounded-xl border', isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                  <h3 className={cn('font-semibold text-sm mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                    Instrucciones DNS para {(dnsInstructions || config.dns_instructions)?.domain}
                  </h3>
                  <div className="space-y-2">
                    {((dnsInstructions || config.dns_instructions)?.records || []).map((r: any, i: number) => (
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
                  <p className="text-xs text-gray-400 mt-3">{(dnsInstructions || config.dns_instructions)?.note}</p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={handleSave} disabled={saving || !config.store_name.trim()}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-orange-500/20">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Guardando...' : 'Guardar Catálogo'}
            </motion.button>

          </div>
        </div>
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
