'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import ServicesManagement from '@/components/settings/ServicesManagement'
import ContentTypesManagement from '@/components/settings/ContentTypesManagement'
import CompanySelector from '@/components/settings/CompanySelector'
import { PaymentSettings } from '@/components/settings/PaymentSettings'
import { useAuth } from '@/hooks/useAuth'
import {
  Palette,
  Package,
  DollarSign,
  ShoppingCart,
  Truck,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Upload,
  MapPin,
  FileText,
  Image,
  Maximize2,
  Tag,
  Ruler,
  CreditCard
} from 'lucide-react'

interface Zone {
  id?: number
  name: string
  description: string
  zipCodes: string[]
  color: string
  timeSlots: string[]  // Cambiado a array para permitir múltiples horarios
  status: string
}

// Opciones de horarios disponibles
const TIME_SLOT_OPTIONS = [
  { value: '8-12', label: 'Mañana', time: '8:00 AM - 12:00 PM', icon: '🌅' },
  { value: '12-16', label: 'Tarde', time: '12:00 PM - 4:00 PM', icon: '☀️' },
  { value: '16-20', label: 'Noche', time: '4:00 PM - 8:00 PM', icon: '🌙' }
]

interface PackageSize {
  id?: number
  name: string
  dimensions: string
  weight: number
  price: number
  description: string
  isDefault: boolean
  status: string
}

const tabs = [
  { id: 'brand', label: 'Diseño de Compañía', icon: Palette },
  { id: 'remittance', label: 'Cupones Familiares', icon: DollarSign },
  { id: 'recharge', label: 'Recargas', icon: Package },
  { id: 'marketplace', label: 'Mercado', icon: ShoppingCart },
  { id: 'package', label: 'Paquetería', icon: Truck },
  { id: 'payments', label: 'Pagos', icon: CreditCard },
]

// Force dynamic rendering to avoid static generation issues with useSearchParams
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'



export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const basePath = pathname?.startsWith('/dashboard/agency-admin')
    ? '/dashboard/agency-admin/settings'
    : '/dashboard/admin/settings'

  const { user } = useAuth()

  // Initialize activeTab from URL query parameter if present
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab')
    const validTabs = ['brand', 'remittance', 'recharge', 'marketplace', 'package', 'payments']
    return tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'brand'
  })
  const [packageSubTab, setPackageSubTab] = useState<'zones' | 'sizes' | 'services' | 'content-types'>('zones')
  const [zones, setZones] = useState<Zone[]>([])
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [isAddingZone, setIsAddingZone] = useState(false)
  const [isAddingSize, setIsAddingSize] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [editingSize, setEditingSize] = useState<PackageSize | null>(null)
  const [isSavingZone, setIsSavingZone] = useState(false)
  const [isSavingSize, setIsSavingSize] = useState(false)
  const [isLoadingZones, setIsLoadingZones] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  // Estado para marca blanca
  const [brandSettings, setBrandSettings] = useState({
    logo: '',
    primaryColor: '#8B5CF6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B',
  })

  // Estados para el formulario de zona
  const [newZone, setNewZone] = useState<Zone>({
    name: '',
    description: '',
    zipCodes: [],
    color: '#8B5CF6',
    timeSlots: [],  // Array vacío para permitir múltiples selecciones
    status: 'active'
  })

  // Estado para el input temporal de código postal
  const [zipCodeInput, setZipCodeInput] = useState('')

  // Estados para el formulario de tamaño
  const [newSize, setNewSize] = useState<PackageSize>({
    name: '',
    dimensions: '',
    weight: 0,
    price: 0,
    description: '',
    isDefault: false,
    status: 'active'
  })

  // Function to handle tab changes and update URL
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    router.push(`${basePath}?tab=${tabId}`, { scroll: false })
  }

  useEffect(() => {
    loadZones()
    loadPackageSizes()
  }, [selectedCompanyId])

  const loadZones = async () => {
    setIsLoadingZones(true)
    try {
      const url = selectedCompanyId
        ? `/api/zones?companyId=${selectedCompanyId}`
        : '/api/zones'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setZones(data.data || [])
      }
    } catch (error) {
      console.error('Error loading zones:', error)
    } finally {
      setIsLoadingZones(false)
    }
  }

  const loadPackageSizes = async () => {
    try {
      const url = selectedCompanyId
        ? `/api/package-sizes?companyId=${selectedCompanyId}`
        : '/api/package-sizes'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPackageSizes(data.data || [])
      }
    } catch (error) {
      console.error('Error loading package sizes:', error)
    }
  }

  // Función helper para verificar si un zipcode ya existe en otra zona
  const isZipCodeInOtherZone = (zipCode: string): { exists: boolean; zoneName?: string } => {
    for (const zone of zones) {
      // Si estamos editando, ignorar la zona actual
      if (editingZone && zone.id === editingZone.id) continue

      const zoneZipCodes = Array.isArray(zone.zipCodes) ? zone.zipCodes : []
      if (zoneZipCodes.includes(zipCode)) {
        return { exists: true, zoneName: zone.name }
      }
    }
    return { exists: false }
  }

  // Funciones para manejar códigos postales
  const handleAddZipCode = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (e && e.key !== 'Enter') return

    const trimmedZip = zipCodeInput.trim()

    // Validación básica de código postal (5 dígitos)
    if (trimmedZip && /^\d{5}$/.test(trimmedZip)) {
      // Verificar si ya está en la zona actual
      if (newZone.zipCodes.includes(trimmedZip)) {
        showNotification('warning', 'Código postal duplicado', 'Este código postal ya está en la zona actual')
        return
      }

      // Verificar si ya existe en otra zona (permitir agregar pero mostrar advertencia)
      const { exists, zoneName } = isZipCodeInOtherZone(trimmedZip)
      if (exists) {
        showNotification('warning', 'Código postal en uso', `El código postal ${trimmedZip} ya pertenece a la zona "${zoneName}". Se mostrará en rojo y no podrás guardar hasta que lo elimines.`)
      }

      // Agregar el zipcode (incluso si está duplicado, para que se vea en rojo)
      setNewZone(prev => ({
        ...prev,
        zipCodes: [...prev.zipCodes, trimmedZip]
      }))
      setZipCodeInput('')
    } else if (trimmedZip) {
      showNotification('warning', 'Código postal inválido', 'El código postal debe tener exactamente 5 dígitos')
    }
  }

  const handleRemoveZipCode = (zipToRemove: string) => {
    setNewZone(prev => ({
      ...prev,
      zipCodes: prev.zipCodes.filter(zip => zip !== zipToRemove)
    }))
  }

  // Función para toggle de horarios
  const handleToggleTimeSlot = (value: string) => {
    setNewZone(prev => {
      const isSelected = prev.timeSlots.includes(value)
      if (isSelected) {
        // Remover el horario
        return {
          ...prev,
          timeSlots: prev.timeSlots.filter(slot => slot !== value)
        }
      } else {
        // Agregar el horario
        return {
          ...prev,
          timeSlots: [...prev.timeSlots, value]
        }
      }
    })
  }

  const handleSaveZone = async () => {
    // Validación
    if (!newZone.name || newZone.zipCodes.length === 0) {
      showNotification('warning', 'Datos incompletos', 'Por favor complete el nombre y agregue al menos un código postal')
      return
    }

    // Verificar que ningún zipcode esté en otra zona
    const duplicateZipCodes: Array<{ zipCode: string; zoneName: string }> = []
    for (const zipCode of newZone.zipCodes) {
      const { exists, zoneName } = isZipCodeInOtherZone(zipCode)
      if (exists && zoneName) {
        duplicateZipCodes.push({ zipCode, zoneName })
      }
    }

    if (duplicateZipCodes.length > 0) {
      const duplicateList = duplicateZipCodes
        .map(d => `${d.zipCode} (en "${d.zoneName}")`)
        .join(', ')
      showNotification(
        'error',
        'Códigos postales duplicados',
        `Los siguientes códigos postales ya están en uso: ${duplicateList}`
      )
      return
    }

    setIsSavingZone(true)
    try {
      const method = editingZone ? 'PUT' : 'POST'
      const url = editingZone ? `/api/zones/${editingZone.id}` : '/api/zones'

      // Limpiar los datos: solo enviar los campos que el API espera
      const cleanData = {
        name: newZone.name,
        description: newZone.description || '',
        zipCodes: newZone.zipCodes,
        color: newZone.color || '#8B5CF6',
        timeSlots: newZone.timeSlots || [],
        status: newZone.status || 'active'
      }

      console.log('Saving zone:', {
        method,
        url,
        data: cleanData
      })

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      })

      // Verificar si la respuesta es JSON válida
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Respuesta no es JSON. Status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Response:', result)

      if (response.ok && result.success) {
        await loadZones()
        setIsAddingZone(false)
        setEditingZone(null)
        setNewZone({
          name: '',
          description: '',
          zipCodes: [],
          color: '#8B5CF6',
          timeSlots: [],
          status: 'active'
        })
        setZipCodeInput('')
        showNotification('success', 'Zona guardada', `La zona "${newZone.name}" se guardó exitosamente con ${newZone.zipCodes.length} códigos postales`)
      } else {
        console.error('Error response:', result)
        showNotification('error', 'Error al guardar', result.error || 'Error al guardar la zona')
      }
    } catch (error) {
      console.error('Error saving zone:', error)
      showNotification('error', 'Error del sistema', `Error al guardar la zona: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsSavingZone(false)
    }
  }

  const handleSaveSize = async () => {
    try {
      const method = editingSize ? 'PUT' : 'POST'
      const url = editingSize ? `/api/package-sizes/${editingSize.id}` : '/api/package-sizes'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSize)
      })

      if (response.ok) {
        loadPackageSizes()
        setIsAddingSize(false)
        setEditingSize(null)
        setNewSize({
          name: '',
          dimensions: '',
          weight: 0,
          price: 0,
          description: '',
          isDefault: false,
          status: 'active'
        })
      }
    } catch (error) {
      console.error('Error saving package size:', error)
    }
  }

  const handleDeleteZone = async (id: number) => {
    if (confirm('¿Está seguro de eliminar esta zona?')) {
      try {
        const response = await fetch(`/api/zones/${id}`, { method: 'DELETE' })
        if (response.ok) {
          loadZones()
        }
      } catch (error) {
        console.error('Error deleting zone:', error)
      }
    }
  }

  const handleDeleteSize = async (id: number) => {
    if (confirm('¿Está seguro de eliminar este tamaño de empaque?')) {
      try {
        const response = await fetch(`/api/package-sizes/${id}`, { method: 'DELETE' })
        if (response.ok) {
          loadPackageSizes()
        }
      } catch (error) {
        console.error('Error deleting package size:', error)
      }
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'brand':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Diseño de Compañía</h2>

            {/* Logo Upload */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Logo de la Empresa</h3>
              <div className="flex items-center space-x-6">
                <div className={cn(
                  "w-32 h-32 rounded-lg border-2 border-dashed flex items-center justify-center",
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                )}>
                  {brandSettings.logo ? (
                    <img src={brandSettings.logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <button className={cn(
                    "px-4 py-2 rounded-lg font-medium",
                    "bg-exa-primary text-white hover:opacity-90 transition-opacity"
                  )}>
                    Subir Logo
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    Formatos permitidos: PNG, JPG, SVG. Tamaño máximo: 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Colors Configuration */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Colores de la Marca</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Color Primario</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={brandSettings.primaryColor}
                      onChange={(e) => setBrandSettings({...brandSettings, primaryColor: e.target.value})}
                      className="w-16 h-10 rounded border"
                    />
                    <input
                      type="text"
                      value={brandSettings.primaryColor}
                      onChange={(e) => setBrandSettings({...brandSettings, primaryColor: e.target.value})}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300'
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Color Secundario</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={brandSettings.secondaryColor}
                      onChange={(e) => setBrandSettings({...brandSettings, secondaryColor: e.target.value})}
                      className="w-16 h-10 rounded border"
                    />
                    <input
                      type="text"
                      value={brandSettings.secondaryColor}
                      onChange={(e) => setBrandSettings({...brandSettings, secondaryColor: e.target.value})}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300'
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Color de Acento</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={brandSettings.accentColor}
                      onChange={(e) => setBrandSettings({...brandSettings, accentColor: e.target.value})}
                      className="w-16 h-10 rounded border"
                    />
                    <input
                      type="text"
                      value={brandSettings.accentColor}
                      onChange={(e) => setBrandSettings({...brandSettings, accentColor: e.target.value})}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg border",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300'
                      )}
                    />
                  </div>
                </div>
              </div>

              <button className={cn(
                "mt-6 px-6 py-2 rounded-lg font-medium",
                "bg-exa-primary text-white hover:opacity-90 transition-opacity"
              )}>
                Guardar Cambios
              </button>
            </div>
          </div>
        )

      case 'remittance':
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Configuración de Cupones Familiares</h3>
              <p className="text-gray-500">En desarrollo</p>
            </div>
          </div>
        )

      case 'recharge':
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Configuración de Recargas</h3>
              <p className="text-gray-500">En desarrollo</p>
            </div>
          </div>
        )

      case 'marketplace':
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Configuración de Mercado</h3>
              <p className="text-gray-500">En desarrollo</p>
            </div>
          </div>
        )

      case 'package':
        const packageSubTabs = [
          { id: 'zones', label: 'Zonas', icon: MapPin },
          { id: 'sizes', label: 'Tamaños', icon: Ruler },
          { id: 'services', label: 'Servicios', icon: Package },
          { id: 'content-types', label: 'Tipos de Contenido', icon: Tag }
        ]

        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Configuración de Paquetería</h2>

            {/* Package Sub-Tabs */}
            <div className="mb-6">
              <div className={cn(
                "flex space-x-1 p-1 rounded-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                {packageSubTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setPackageSubTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all",
                        packageSubTab === tab.id
                          ? theme === 'dark'
                            ? 'bg-gray-700 text-white shadow-sm'
                            : 'bg-white text-gray-900 shadow-sm'
                          : theme === 'dark'
                            ? 'text-gray-400 hover:text-gray-200'
                            : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Services Tab */}
            {packageSubTab === 'services' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <ServicesManagement />
              </div>
            )}

            {/* Content Types Tab */}
            {packageSubTab === 'content-types' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
                <ContentTypesManagement />
              </div>
            )}

            {/* Zones Section */}
            {packageSubTab === 'zones' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Zonas de Entrega</h3>
                <button
                  onClick={() => {
                    setIsAddingZone(true)
                    setZipCodeInput('')
                    // Scroll suave hacia el formulario de creación
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }, 100)
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium flex items-center gap-2",
                    "bg-exa-primary text-white hover:opacity-90 transition-opacity"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Nueva Zona
                </button>
              </div>

              {/* Zone Form */}
              {(isAddingZone || editingZone) && (
                <div className="border rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-700/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nombre</label>
                      <input
                        type="text"
                        value={newZone.name}
                        onChange={(e) => setNewZone({...newZone, name: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        placeholder="Zona Norte"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Color de la Zona</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={newZone.color}
                          onChange={(e) => setNewZone({...newZone, color: e.target.value})}
                          className={cn(
                            "w-16 h-10 rounded-lg border-2 cursor-pointer",
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'bg-white border-gray-300'
                          )}
                          title="Seleccione un color"
                        />
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm"
                            style={{ backgroundColor: newZone.color }}
                          />
                          <span className={cn(
                            "text-sm font-mono",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            {newZone.color.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">Horarios Disponibles</label>
                      <div className="flex flex-wrap gap-3">
                        {TIME_SLOT_OPTIONS.map((slot) => {
                          const isSelected = newZone.timeSlots.includes(slot.value)
                          return (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => handleToggleTimeSlot(slot.value)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all border-2",
                                isSelected
                                  ? theme === 'dark'
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                  : theme === 'dark'
                                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                              )}
                            >
                              <span className="text-xl">{slot.icon}</span>
                              <div className="text-left">
                                <div className="font-semibold">{slot.label}</div>
                                <div className="text-xs opacity-80">{slot.time}</div>
                              </div>
                              {isSelected && (
                                <div className="ml-2">
                                  <div className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center",
                                    theme === 'dark' ? 'bg-blue-700' : 'bg-blue-600'
                                  )}>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {newZone.timeSlots.length === 0 && (
                        <p className={cn(
                          "mt-2 text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          Seleccione al menos un horario para esta zona
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Códigos Postales</label>
                      <div className={cn(
                        "p-3 rounded-lg border min-h-[100px]",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-gray-50 border-gray-300'
                      )}>
                        {/* Píldoras de códigos postales */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {newZone.zipCodes.map((zip) => {
                            const { exists, zoneName } = isZipCodeInOtherZone(zip)
                            return (
                              <div key={zip} className="flex flex-col">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm",
                                    exists
                                      ? theme === 'dark'
                                        ? 'bg-red-900 text-red-200 border-2 border-red-500'
                                        : 'bg-red-100 text-red-800 border-2 border-red-500'
                                      : theme === 'dark'
                                        ? 'bg-gray-600 text-white'
                                        : 'bg-blue-100 text-blue-800'
                                  )}
                                >
                                  {exists ? (
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <MapPin className="w-3 h-3" />
                                  )}
                                  {zip}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveZipCode(zip)}
                                    className={cn(
                                      "ml-1 hover:opacity-70",
                                      exists
                                        ? 'text-red-600'
                                        : theme === 'dark' ? 'text-gray-300' : 'text-blue-600'
                                    )}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                                {exists && (
                                  <span className={cn(
                                    "text-xs mt-1 pl-2",
                                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                                  )}>
                                    Ya está en "{zoneName}"
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Input para agregar nuevos códigos */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={zipCodeInput}
                            onChange={(e) => setZipCodeInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddZipCode()
                              }
                            }}
                            placeholder="Escriba un código postal (5 dígitos) y presione Enter"
                            className={cn(
                              "flex-1 px-3 py-2 rounded-lg border",
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                                : 'bg-white border-gray-300 placeholder-gray-500'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddZipCode()}
                            disabled={!zipCodeInput || zipCodeInput.length !== 5}
                            className={cn(
                              "px-4 py-2 rounded-lg font-medium transition-all",
                              zipCodeInput && zipCodeInput.length === 5
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            )}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        {newZone.zipCodes.length === 0 && (
                          <p className={cn(
                            "mt-2 text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Agregue al menos un código postal para esta zona
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Descripción</label>
                      <textarea
                        value={newZone.description}
                        onChange={(e) => setNewZone({...newZone, description: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        rows={2}
                        placeholder="Descripción de la zona..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => {
                        setIsAddingZone(false)
                        setEditingZone(null)
                        setNewZone({
                          name: '',
                          description: '',
                          zipCodes: [],
                          color: '#8B5CF6',
                          timeSlots: [],
                          status: 'active'
                        })
                        setZipCodeInput('')
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium",
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      )}
                    >
                      <X className="w-4 h-4 inline mr-1" />
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveZone}
                      disabled={isSavingZone}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium flex items-center gap-2",
                        isSavingZone
                          ? "bg-green-400 text-white cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      )}
                    >
                      {isSavingZone ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Guardar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Zones List */}
              <div className="space-y-3">
                {isLoadingZones ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Cargando zonas...
                      </p>
                    </div>
                  </div>
                ) : zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0 mt-1 border-2 border-gray-200"
                          style={{ backgroundColor: zone.color || '#8B5CF6' }}
                        />
                        <div>
                          <div className="font-medium text-lg">{zone.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingZone(zone)
                            setNewZone({
                              ...zone,
                              color: zone.color || '#8B5CF6' // Ensure color exists
                            })
                            setIsAddingZone(false)
                            setZipCodeInput('')
                            // Scroll suave hacia el formulario de edición
                            setTimeout(() => {
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }, 100)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => zone.id && handleDeleteZone(zone.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Horarios */}
                    {zone.timeSlots && zone.timeSlots.length > 0 && (
                      <div className="mt-3">
                        <div className={cn(
                          "text-xs font-medium mb-2",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Horarios de Entrega
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {zone.timeSlots.map((timeSlot, index) => {
                            const slotInfo = TIME_SLOT_OPTIONS.find(opt => opt.value === timeSlot)
                            return slotInfo ? (
                              <span
                                key={index}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                                  theme === 'dark'
                                    ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                                    : 'bg-green-50 text-green-700 border border-green-200'
                                )}
                              >
                                <span className="text-base">{slotInfo.icon}</span>
                                {slotInfo.label} ({slotInfo.time})
                              </span>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}

                    {/* Códigos Postales */}
                    <div className="mt-3">
                      <div className={cn(
                        "text-xs font-medium mb-2",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Códigos Postales ({zone.zipCodes.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {zone.zipCodes.map((zip, index) => (
                          <span
                            key={index}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                              theme === 'dark'
                                ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            )}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {zip}
                          </span>
                        ))}
                      </div>
                    </div>

                    {zone.description && (
                      <div className={cn(
                        "mt-3 pt-3 border-t text-sm",
                        theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
                      )}>
                        {zone.description}
                      </div>
                    )}
                  </div>
                ))
}
              </div>
            </div>
            )}

            {/* Package Sizes Section */}
            {packageSubTab === 'sizes' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Tamaños de Empaques</h3>
                <button
                  onClick={() => {
                    setIsAddingSize(true)
                    // Scroll suave hacia el formulario de creación
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }, 100)
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium flex items-center gap-2",
                    "bg-exa-primary text-white hover:opacity-90 transition-opacity"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Tamaño
                </button>
              </div>

              {/* Size Form */}
              {(isAddingSize || editingSize) && (
                <div className="border rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-700/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nombre</label>
                      <input
                        type="text"
                        value={newSize.name}
                        onChange={(e) => setNewSize({...newSize, name: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        placeholder="Caja Pequeña"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Dimensiones (pulgadas)</label>
                      <input
                        type="text"
                        value={newSize.dimensions}
                        onChange={(e) => setNewSize({...newSize, dimensions: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        placeholder="12x10x8"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Peso Máximo (lbs)</label>
                      <input
                        type="number"
                        value={newSize.weight}
                        onChange={(e) => setNewSize({...newSize, weight: parseFloat(e.target.value)})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        placeholder="25"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Precio ($)</label>
                      <input
                        type="number"
                        value={newSize.price}
                        onChange={(e) => setNewSize({...newSize, price: parseFloat(e.target.value)})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        placeholder="15.00"
                        step="0.0001"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Descripción</label>
                      <textarea
                        value={newSize.description}
                        onChange={(e) => setNewSize({...newSize, description: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                        rows={2}
                        placeholder="Ideal para artículos pequeños..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newSize.isDefault}
                          onChange={(e) => setNewSize({...newSize, isDefault: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm">Establecer como tamaño predeterminado</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => {
                        setIsAddingSize(false)
                        setEditingSize(null)
                        setNewSize({
                          name: '',
                          dimensions: '',
                          weight: 0,
                          price: 0,
                          description: '',
                          isDefault: false,
                          status: 'active'
                        })
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium",
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      )}
                    >
                      <X className="w-4 h-4 inline mr-1" />
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveSize}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium",
                        "bg-green-600 text-white hover:bg-green-700"
                      )}
                    >
                      <Save className="w-4 h-4 inline mr-1" />
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              {/* Package Sizes List */}
              <div className="space-y-2">
                {packageSizes.map((size) => (
                  <div
                    key={size.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}
                  >
                    <div>
                      <div className="font-medium">
                        {size.name}
                        {size.isDefault && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded">
                            Predeterminado
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {size.dimensions} • Hasta {size.weight} lbs • ${size.price}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingSize(size)
                          setNewSize(size)
                          setIsAddingSize(false)
                          // Scroll suave hacia el formulario de edición
                          setTimeout(() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }, 100)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => size.id && handleDeleteSize(size.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

          </div>
        )

      case 'payments':
        return (
          <PaymentSettings
            role={user?.role || 'USER'}
            companyId={user?.companyId ? Number(user.companyId) : undefined}
          />
        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Configuraciones</h1>

        {/* Company Selector for SUPER_ADMIN */}
        <CompanySelector
          selectedCompanyId={selectedCompanyId}
          onCompanyChange={setSelectedCompanyId}
        />

        {/* Tabs */}
        <div className="mb-6">
          <div className={cn(
            "flex space-x-1 p-1 rounded-xl",
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
          )}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all",
                    activeTab === tab.id
                      ? theme === 'dark'
                        ? 'bg-gray-700 text-white shadow-sm'
                        : 'bg-white text-gray-900 shadow-sm'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>{renderTabContent()}</div>
      </div>
    </DashboardLayout>
  )
}
