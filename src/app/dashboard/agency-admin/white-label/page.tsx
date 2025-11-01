'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette,
  Upload,
  Image as ImageIcon,
  Settings,
  FileText,
  Eye,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  CreditCard,
  Receipt
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface WhiteLabelConfig {
  // Branding
  companyName: string
  primaryColor: string
  secondaryColor: string
  lightLogo: string
  darkLogo: string
  favicon: string

  // Contact Info
  email: string
  phone: string
  address: string
  website: string

  // Ticket Configuration
  ticketHeader: string
  ticketFooter: string
  showBarcode: boolean
  showQrCode: boolean
  ticketTemplate: 'classic' | 'modern' | 'minimal'

  // UI Preferences
  enableDarkMode: boolean
  defaultTheme: 'light' | 'dark' | 'auto'
  accentColor: string
}

const defaultConfig: WhiteLabelConfig = {
  companyName: 'Mi Empresa',
  primaryColor: '#3b82f6',
  secondaryColor: '#10b981',
  lightLogo: '/images/logocolor.png',
  darkLogo: '/images/logoheader.png',
  favicon: '/favicon.ico',
  email: 'contacto@miempresa.com',
  phone: '+53 5 555 5555',
  address: 'La Habana, Cuba',
  website: 'https://miempresa.com',
  ticketHeader: 'Gracias por su compra',
  ticketFooter: 'Vuelva pronto',
  showBarcode: true,
  showQrCode: true,
  ticketTemplate: 'modern',
  enableDarkMode: true,
  defaultTheme: 'auto',
  accentColor: '#6366f1'
}

export default function WhiteLabelPage() {
  const { theme } = useTheme()
  const [config, setConfig] = useState<WhiteLabelConfig>(defaultConfig)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('branding')
  const [preview, setPreview] = useState<'mobile' | 'desktop'>('mobile')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Load saved config
  useEffect(() => {
    const savedConfig = localStorage.getItem('whiteLabelConfig')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig({ ...defaultConfig, ...parsed })
      } catch (error) {
        console.error('Error loading config:', error)
      }
    }
  }, [])

  // Save config
  const saveConfig = async () => {
    setSaving(true)
    setSaveStatus('idle')

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      localStorage.setItem('whiteLabelConfig', JSON.stringify(config))
      setSaveStatus('success')

      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      console.error('Error saving config:', error)
      setSaveStatus('error')

      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }

  // Reset config
  const resetConfig = () => {
    setConfig(defaultConfig)
    localStorage.removeItem('whiteLabelConfig')
  }

  // Handle file upload
  const handleFileUpload = (type: 'lightLogo' | 'darkLogo' | 'favicon', file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') {
        setConfig(prev => ({ ...prev, [type]: result }))
      }
    }
    reader.readAsDataURL(file)
  }

  // Update config
  const updateConfig = (key: keyof WhiteLabelConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'contact', label: 'Contacto', icon: Building2 },
    { id: 'ticket', label: 'Tickets', icon: Receipt },
    { id: 'ui', label: 'Interfaz', icon: Settings }
  ]

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Configuración de Marca Blanca
              </h1>
              <p className={cn(
                "mt-2 text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Personaliza la apariencia y funcionamiento del sistema
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreview('mobile')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    preview === 'mobile'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white"
                        : "bg-exa-primary text-white"
                      : theme === 'dark'
                        ? "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  )}
                >
                  Móvil
                </button>
                <button
                  onClick={() => setPreview('desktop')}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    preview === 'desktop'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white"
                        : "bg-exa-primary text-white"
                      : theme === 'dark'
                        ? "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  )}
                >
                  Escritorio
                </button>
              </div>

              <button
                onClick={resetConfig}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                  theme === 'dark'
                    ? "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Restablecer
              </button>

              <button
                onClick={saveConfig}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  saving && "opacity-50",
                  theme === 'dark'
                    ? "bg-exa-secondary text-white hover:bg-exa-primary"
                    : "bg-exa-primary text-white hover:bg-exa-secondary"
                )}
              >
                {saving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </motion.div>

          {/* Save Status */}
          <AnimatePresence>
            {saveStatus !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={cn(
                  "p-4 rounded-lg flex items-center gap-3",
                  saveStatus === 'success'
                    ? theme === 'dark'
                      ? "bg-green-900/20 border border-green-800 text-green-400"
                      : "bg-green-50 border border-green-200 text-green-700"
                    : theme === 'dark'
                      ? "bg-red-900/20 border border-red-800 text-red-400"
                      : "bg-red-50 border border-red-200 text-red-700"
                )}
              >
                {saveStatus === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span>
                  {saveStatus === 'success'
                    ? 'Configuración guardada exitosamente'
                    : 'Error al guardar la configuración'
                  }
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "rounded-xl border",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                {/* Tabs */}
                <div className={cn(
                  "flex border-b",
                  theme === 'dark' ? "border-gray-700" : "border-gray-200"
                )}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-4 font-medium transition-all relative",
                        activeTab === tab.id
                          ? theme === 'dark'
                            ? "text-exa-secondary"
                            : "text-exa-primary"
                          : theme === 'dark'
                            ? "text-gray-400 hover:text-gray-300"
                            : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          className={cn(
                            "absolute bottom-0 left-0 right-0 h-0.5",
                            theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                          )}
                          layoutId="activeTab"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {/* Branding Tab */}
                  {activeTab === 'branding' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Nombre de la Empresa
                        </label>
                        <input
                          type="text"
                          value={config.companyName}
                          onChange={(e) => updateConfig('companyName', e.target.value)}
                          className={cn(
                            "w-full p-3 rounded-lg border",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          placeholder="Mi Empresa"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Color Primario
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={config.primaryColor}
                              onChange={(e) => updateConfig('primaryColor', e.target.value)}
                              className="w-12 h-12 rounded-lg border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={config.primaryColor}
                              onChange={(e) => updateConfig('primaryColor', e.target.value)}
                              className={cn(
                                "flex-1 p-3 rounded-lg border",
                                theme === 'dark'
                                  ? "bg-gray-700 border-gray-600 text-white"
                                  : "bg-white border-gray-300 text-gray-900"
                              )}
                              placeholder="#3b82f6"
                            />
                          </div>
                        </div>

                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Color Secundario
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={config.secondaryColor}
                              onChange={(e) => updateConfig('secondaryColor', e.target.value)}
                              className="w-12 h-12 rounded-lg border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={config.secondaryColor}
                              onChange={(e) => updateConfig('secondaryColor', e.target.value)}
                              className={cn(
                                "flex-1 p-3 rounded-lg border",
                                theme === 'dark'
                                  ? "bg-gray-700 border-gray-600 text-white"
                                  : "bg-white border-gray-300 text-gray-900"
                              )}
                              placeholder="#10b981"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Logos</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Logo (Modo Claro)
                            </label>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden",
                                theme === 'dark' ? "border-gray-600" : "border-gray-300"
                              )}>
                                {config.lightLogo ? (
                                  <img
                                    src={config.lightLogo}
                                    alt="Logo claro"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className={cn(
                                    "w-6 h-6",
                                    theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                  )} />
                                )}
                              </div>
                              <label className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => e.target.files?.[0] && handleFileUpload('lightLogo', e.target.files[0])}
                                  className="hidden"
                                />
                                <div className={cn(
                                  "p-3 rounded-lg border cursor-pointer text-center transition-all",
                                  theme === 'dark'
                                    ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                                    : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                                )}>
                                  <Upload className="w-4 h-4 mx-auto mb-1" />
                                  <span className="text-sm">Subir Logo</span>
                                </div>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Logo (Modo Oscuro)
                            </label>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden",
                                theme === 'dark' ? "border-gray-600" : "border-gray-300"
                              )}>
                                {config.darkLogo ? (
                                  <img
                                    src={config.darkLogo}
                                    alt="Logo oscuro"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className={cn(
                                    "w-6 h-6",
                                    theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                  )} />
                                )}
                              </div>
                              <label className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => e.target.files?.[0] && handleFileUpload('darkLogo', e.target.files[0])}
                                  className="hidden"
                                />
                                <div className={cn(
                                  "p-3 rounded-lg border cursor-pointer text-center transition-all",
                                  theme === 'dark'
                                    ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                                    : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                                )}>
                                  <Upload className="w-4 h-4 mx-auto mb-1" />
                                  <span className="text-sm">Subir Logo</span>
                                </div>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Contact Tab */}
                  {activeTab === 'contact' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            <Mail className="inline w-4 h-4 mr-2" />
                            Correo Electrónico
                          </label>
                          <input
                            type="email"
                            value={config.email}
                            onChange={(e) => updateConfig('email', e.target.value)}
                            className={cn(
                              "w-full p-3 rounded-lg border",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            )}
                            placeholder="contacto@empresa.com"
                          />
                        </div>

                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            <Phone className="inline w-4 h-4 mr-2" />
                            Teléfono
                          </label>
                          <input
                            type="tel"
                            value={config.phone}
                            onChange={(e) => updateConfig('phone', e.target.value)}
                            className={cn(
                              "w-full p-3 rounded-lg border",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            )}
                            placeholder="+53 5 555 5555"
                          />
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          <MapPin className="inline w-4 h-4 mr-2" />
                          Dirección
                        </label>
                        <input
                          type="text"
                          value={config.address}
                          onChange={(e) => updateConfig('address', e.target.value)}
                          className={cn(
                            "w-full p-3 rounded-lg border",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          placeholder="La Habana, Cuba"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          <Globe className="inline w-4 h-4 mr-2" />
                          Sitio Web
                        </label>
                        <input
                          type="url"
                          value={config.website}
                          onChange={(e) => updateConfig('website', e.target.value)}
                          className={cn(
                            "w-full p-3 rounded-lg border",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          placeholder="https://empresa.com"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Ticket Tab */}
                  {activeTab === 'ticket' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Encabezado del Ticket
                        </label>
                        <input
                          type="text"
                          value={config.ticketHeader}
                          onChange={(e) => updateConfig('ticketHeader', e.target.value)}
                          className={cn(
                            "w-full p-3 rounded-lg border",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          placeholder="Gracias por su compra"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Pie del Ticket
                        </label>
                        <input
                          type="text"
                          value={config.ticketFooter}
                          onChange={(e) => updateConfig('ticketFooter', e.target.value)}
                          className={cn(
                            "w-full p-3 rounded-lg border",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                          placeholder="Vuelva pronto"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Plantilla de Ticket
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {(['classic', 'modern', 'minimal'] as const).map((template) => (
                            <button
                              key={template}
                              onClick={() => updateConfig('ticketTemplate', template)}
                              className={cn(
                                "p-4 rounded-lg border transition-all",
                                config.ticketTemplate === template
                                  ? theme === 'dark'
                                    ? "border-exa-secondary bg-exa-secondary/10"
                                    : "border-exa-primary bg-exa-primary/10"
                                  : theme === 'dark'
                                    ? "border-gray-600 hover:border-gray-500"
                                    : "border-gray-300 hover:border-gray-400"
                              )}
                            >
                              <div className="text-center">
                                <Receipt className="w-6 h-6 mx-auto mb-2" />
                                <span className="text-sm font-medium capitalize">
                                  {template === 'classic' ? 'Clásica' :
                                   template === 'modern' ? 'Moderna' : 'Minimalista'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Opciones de Ticket</h3>

                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.showBarcode}
                              onChange={(e) => updateConfig('showBarcode', e.target.checked)}
                              className="w-5 h-5 rounded border-gray-300 text-exa-primary focus:ring-exa-primary"
                            />
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Mostrar Código de Barras
                            </span>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.showQrCode}
                              onChange={(e) => updateConfig('showQrCode', e.target.checked)}
                              className="w-5 h-5 rounded border-gray-300 text-exa-primary focus:ring-exa-primary"
                            />
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Mostrar Código QR
                            </span>
                          </label>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* UI Tab */}
                  {activeTab === 'ui' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.enableDarkMode}
                            onChange={(e) => updateConfig('enableDarkMode', e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-exa-primary focus:ring-exa-primary"
                          />
                          <span className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Habilitar Modo Oscuro
                          </span>
                        </label>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Tema Predeterminado
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {(['light', 'dark', 'auto'] as const).map((themeOption) => (
                            <button
                              key={themeOption}
                              onClick={() => updateConfig('defaultTheme', themeOption)}
                              className={cn(
                                "p-3 rounded-lg border transition-all",
                                config.defaultTheme === themeOption
                                  ? theme === 'dark'
                                    ? "border-exa-secondary bg-exa-secondary/10"
                                    : "border-exa-primary bg-exa-primary/10"
                                  : theme === 'dark'
                                    ? "border-gray-600 hover:border-gray-500"
                                    : "border-gray-300 hover:border-gray-400"
                              )}
                            >
                              <span className="text-sm font-medium capitalize">
                                {themeOption === 'light' ? 'Claro' :
                                 themeOption === 'dark' ? 'Oscuro' : 'Automático'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Color de Acento
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={config.accentColor}
                            onChange={(e) => updateConfig('accentColor', e.target.value)}
                            className="w-12 h-12 rounded-lg border cursor-pointer"
                          />
                          <input
                            type="text"
                            value={config.accentColor}
                            onChange={(e) => updateConfig('accentColor', e.target.value)}
                            className={cn(
                              "flex-1 p-3 rounded-lg border",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white"
                                : "bg-white border-gray-300 text-gray-900"
                            )}
                            placeholder="#6366f1"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "rounded-xl border sticky top-6",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                <div className={cn(
                  "p-4 border-b flex items-center justify-between",
                  theme === 'dark' ? "border-gray-700" : "border-gray-200"
                )}>
                  <h3 className={cn(
                    "font-semibold flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Eye className="w-4 h-4" />
                    Vista Previa
                  </h3>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded",
                    theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                  )}>
                    {preview === 'mobile' ? 'Móvil' : 'Escritorio'}
                  </span>
                </div>

                <div className="p-6">
                  {/* Exchange Rates Preview */}
                  <div className="space-y-4">
                    <h4 className={cn(
                      "text-sm font-semibold",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Tasas de Cambio
                    </h4>

                    <div className="space-y-2">
                      {[
                        { currency: 'USD', rate: 470, flag: '🇺🇸', color: 'blue' },
                        { currency: 'EUR', rate: 525, flag: '🇪🇺', color: 'green' },
                        { currency: 'MLC', rate: 200, flag: '💳', color: 'purple' }
                      ].map((item, index) => (
                        <motion.div
                          key={item.currency}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={cn(
                            "rounded-lg p-3 border relative overflow-hidden",
                            theme === 'dark'
                              ? "bg-gray-700 border-gray-600"
                              : "bg-white border-gray-200"
                          )}
                          style={{
                            background: `linear-gradient(135deg, ${
                              theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                            }, transparent)`,
                            borderColor: config.primaryColor + '40'
                          }}
                        >
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                style={{
                                  backgroundColor: config.primaryColor + '20',
                                  color: config.primaryColor
                                }}
                              >
                                {item.flag}
                              </div>
                              <div>
                                <div className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {item.currency} / CUP
                                </div>
                                <motion.div
                                  className="text-lg font-bold"
                                  style={{ color: config.primaryColor }}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                                >
                                  ${item.rate}
                                </motion.div>
                              </div>
                            </div>

                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: index * 0.1 + 0.3 }}
                            >
                              <CheckCircle
                                className="w-4 h-4"
                                style={{ color: config.primaryColor }}
                              />
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Ticket Preview */}
                    <div className="mt-6">
                      <h4 className={cn(
                        "text-sm font-semibold mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Vista Previa de Ticket
                      </h4>

                      <div
                        className={cn(
                          "rounded-lg p-4 border-2 border-dashed text-center",
                          theme === 'dark' ? "border-gray-600" : "border-gray-300"
                        )}
                        style={{
                          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          borderColor: config.primaryColor + '60'
                        }}
                      >
                        <div className="space-y-3">
                          {config.lightLogo && (
                            <img
                              src={config.lightLogo}
                              alt="Logo"
                              className="h-8 mx-auto"
                            />
                          )}

                          <h3
                            className="text-lg font-bold"
                            style={{ color: config.primaryColor }}
                          >
                            {config.companyName}
                          </h3>

                          <div className={cn(
                            "text-xs space-y-1",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            <p>{config.ticketHeader}</p>
                            <p>Recarga: $10.00 USD</p>
                            <p>Tel: +53 5XXXXXX</p>
                            <p className="border-t pt-2">{config.ticketFooter}</p>
                          </div>

                          {config.showBarcode && (
                            <div className="mt-3 h-8 bg-black/10 rounded flex items-center justify-center">
                              <span className="text-xs">||||| ||||| |||||</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}