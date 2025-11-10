'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
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
  MapPin
} from 'lucide-react'

interface Zone {
  id?: number
  name: string
  description: string
  zipCodes: string[]
  color: string
  timeSlot: string
  status: string
}

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
  { id: 'remittance', label: 'Remesas', icon: DollarSign },
  { id: 'recharge', label: 'Recargas', icon: Package },
  { id: 'marketplace', label: 'Mercado', icon: ShoppingCart },
  { id: 'package', label: 'Paquetería', icon: Truck },
]

export default function SettingsPage() {
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState('brand')
  const [zones, setZones] = useState<Zone[]>([])
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [isAddingZone, setIsAddingZone] = useState(false)
  const [isAddingSize, setIsAddingSize] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [editingSize, setEditingSize] = useState<PackageSize | null>(null)

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
    timeSlot: '8:00 AM - 12:00 PM',
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

  useEffect(() => {
    loadZones()
    loadPackageSizes()
  }, [])

  const loadZones = async () => {
    try {
      const response = await fetch('/api/zones')
      if (response.ok) {
        const data = await response.json()
        setZones(data.data || [])
      }
    } catch (error) {
      console.error('Error loading zones:', error)
    }
  }

  const loadPackageSizes = async () => {
    try {
      const response = await fetch('/api/package-sizes')
      if (response.ok) {
        const data = await response.json()
        setPackageSizes(data.data || [])
      }
    } catch (error) {
      console.error('Error loading package sizes:', error)
    }
  }

  // Funciones para manejar códigos postales
  const handleAddZipCode = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (e && e.key !== 'Enter') return

    const trimmedZip = zipCodeInput.trim()

    // Validación básica de código postal (5 dígitos)
    if (trimmedZip && /^\d{5}$/.test(trimmedZip)) {
      if (!newZone.zipCodes.includes(trimmedZip)) {
        setNewZone(prev => ({
          ...prev,
          zipCodes: [...prev.zipCodes, trimmedZip]
        }))
      }
      setZipCodeInput('')
    }
  }

  const handleRemoveZipCode = (zipToRemove: string) => {
    setNewZone(prev => ({
      ...prev,
      zipCodes: prev.zipCodes.filter(zip => zip !== zipToRemove)
    }))
  }

  const handleSaveZone = async () => {
    // Validación
    if (!newZone.name || newZone.zipCodes.length === 0) {
      alert('Por favor complete el nombre y agregue al menos un código postal')
      return
    }

    try {
      const method = editingZone ? 'PUT' : 'POST'
      const url = editingZone ? `/api/zones/${editingZone.id}` : '/api/zones'

      console.log('Saving zone:', {
        method,
        url,
        data: newZone
      })

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newZone)
      })

      const result = await response.json()
      console.log('Response:', result)

      if (response.ok) {
        await loadZones()
        setIsAddingZone(false)
        setEditingZone(null)
        setNewZone({
          name: '',
          description: '',
          zipCodes: [],
          color: '#8B5CF6',
          timeSlot: '8:00 AM - 12:00 PM',
          status: 'active'
        })
        setZipCodeInput('')
        alert('Zona guardada exitosamente')
      } else {
        console.error('Error response:', result)
        alert(result.error || 'Error al guardar la zona')
      }
    } catch (error) {
      console.error('Error saving zone:', error)
      alert('Error al guardar la zona. Revise la consola para más detalles.')
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
              <h3 className="text-xl font-semibold mb-2">Configuración de Remesas</h3>
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
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Configuración de Paquetería</h2>

            {/* Zones Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Zonas de Entrega</h3>
                <button
                  onClick={() => {
                    setIsAddingZone(true)
                    setZipCodeInput('')
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
                      <label className="block text-sm font-medium mb-1">Horario</label>
                      <select
                        value={newZone.timeSlot}
                        onChange={(e) => setNewZone({...newZone, timeSlot: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                      >
                        <option value="8:00 AM - 12:00 PM">8:00 AM - 12:00 PM</option>
                        <option value="12:00 PM - 4:00 PM">12:00 PM - 4:00 PM</option>
                        <option value="4:00 PM - 8:00 PM">4:00 PM - 8:00 PM</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Color</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={newZone.color}
                          onChange={(e) => setNewZone({...newZone, color: e.target.value})}
                          className="w-16 h-10 rounded border"
                        />
                        <input
                          type="text"
                          value={newZone.color}
                          onChange={(e) => setNewZone({...newZone, color: e.target.value})}
                          className={cn(
                            "flex-1 px-3 py-2 rounded-lg border",
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300'
                          )}
                        />
                      </div>
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
                          {newZone.zipCodes.map((zip) => (
                            <span
                              key={zip}
                              className={cn(
                                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm",
                                theme === 'dark'
                                  ? 'bg-gray-600 text-white'
                                  : 'bg-blue-100 text-blue-800'
                              )}
                            >
                              <MapPin className="w-3 h-3" />
                              {zip}
                              <button
                                type="button"
                                onClick={() => handleRemoveZipCode(zip)}
                                className={cn(
                                  "ml-1 hover:opacity-70",
                                  theme === 'dark' ? 'text-gray-300' : 'text-blue-600'
                                )}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* Input para agregar nuevos códigos */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={zipCodeInput}
                            onChange={(e) => setZipCodeInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            onKeyPress={handleAddZipCode}
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
                          timeSlot: '8:00 AM - 12:00 PM',
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

              {/* Zones List */}
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      <div>
                        <div className="font-medium">{zone.name}</div>
                        <div className="text-sm text-gray-500">
                          {zone.timeSlot} • {zone.zipCodes.length} códigos postales
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingZone(zone)
                          setNewZone(zone)
                          setIsAddingZone(false)
                          setZipCodeInput('')
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => zone.id && handleDeleteZone(zone.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Package Sizes Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Tamaños de Empaques</h3>
                <button
                  onClick={() => setIsAddingSize(true)}
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
                        step="0.01"
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
          </div>
        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Configuraciones</h1>

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
                  onClick={() => setActiveTab(tab.id)}
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