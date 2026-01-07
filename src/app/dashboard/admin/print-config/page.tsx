'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Printer,
  Settings,
  Warehouse,
  Monitor,
  Globe,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import LoadingBox from '@/components/ui/LoadingBox'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

interface PrintServicePrinter {
  id: number
  printerName: string
  printerType: string
  isOnline: boolean
}

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: 'pending' | 'active' | 'offline' | 'disabled'
  lastSeenAt: string | null
  printers: PrintServicePrinter[]
}

interface PrintConfiguration {
  id: number
  documentType: string
  copies: number
  autoPrint: boolean
  isActive: boolean
  priority: number
  warehouseId: number | null
  warehouseName: string | null
  posTerminalId: number | null
  terminalName: string | null
  printServiceId: number
  serviceName: string
  printerId: number
  printerName: string
}

interface Warehouse {
  id: number
  name: string
  code: string
}

interface POSTerminal {
  id: number
  name: string
  code: string
  warehouseId: number
  warehouseName: string
}

const DOCUMENT_TYPES = [
  { value: 'pos_receipt', label: 'Recibo POS', printerType: 'thermal_80mm' },
  { value: 'product_label', label: 'Etiqueta de Producto', printerType: 'label' },
  { value: 'purchase_invoice', label: 'Factura de Compra', printerType: 'thermal_80mm' },
  { value: 'consignment_receipt', label: 'Recibo de Consignacion', printerType: 'thermal_80mm' },
  { value: 'unified_reception', label: 'Recepcion de Almacen', printerType: 'thermal_80mm' },
  { value: 'shipping_label', label: 'Etiqueta de Envio', printerType: 'label' },
  { value: 'invoice', label: 'Factura General', printerType: 'standard' }
]

type TabType = 'warehouses' | 'terminals' | 'global'

export default function PrintConfigPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [activeTab, setActiveTab] = useState<TabType>('warehouses')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data
  const [services, setServices] = useState<PrintService[]>([])
  const [configurations, setConfigurations] = useState<PrintConfiguration[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [terminals, setTerminals] = useState<POSTerminal[]>([])

  // UI State
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<number>>(new Set())
  const [expandedTerminals, setExpandedTerminals] = useState<Set<number>>(new Set())

  // New config form
  const [newConfigForm, setNewConfigForm] = useState<{
    documentType: string
    printServiceId: number | null
    printerId: number | null
    copies: number
    autoPrint: boolean
    warehouseId?: number | null
    posTerminalId?: number | null
  } | null>(null)

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const [servicesRes, configsRes, warehousesRes, terminalsRes] = await Promise.all([
        fetch('/api/print/services'),
        fetch('/api/print/configurations'),
        fetch('/api/market/warehouses'),
        fetch('/api/market/pos/terminals')
      ])

      if (servicesRes.ok) {
        const data = await servicesRes.json()
        setServices(data.data?.services || [])
      }

      if (configsRes.ok) {
        const data = await configsRes.json()
        setConfigurations(data.data?.configurations || [])
      }

      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        setWarehouses(data.data?.warehouses || data.data || [])
      }

      if (terminalsRes.ok) {
        const data = await terminalsRes.json()
        setTerminals(data.data?.terminals || data.data || [])
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Get configurations for a specific warehouse
  const getWarehouseConfigs = (warehouseId: number) => {
    return configurations.filter(c => c.warehouseId === warehouseId)
  }

  // Get configurations for a specific terminal
  const getTerminalConfigs = (terminalId: number) => {
    return configurations.filter(c => c.posTerminalId === terminalId)
  }

  // Get global configurations (no warehouse or terminal)
  const getGlobalConfigs = () => {
    return configurations.filter(c => !c.warehouseId && !c.posTerminalId)
  }

  // Get printers from a service
  const getServicePrinters = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId)
    return service?.printers || []
  }

  // Check if service is online
  const isServiceOnline = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId)
    return service?.status === 'active'
  }

  // Create new configuration
  const handleCreateConfig = async () => {
    if (!newConfigForm || !newConfigForm.documentType || !newConfigForm.printServiceId || !newConfigForm.printerId) {
      showNotification('error', 'Error', 'Complete todos los campos requeridos')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/print/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: newConfigForm.documentType,
          printServiceId: newConfigForm.printServiceId,
          printerId: newConfigForm.printerId,
          copies: newConfigForm.copies,
          autoPrint: newConfigForm.autoPrint,
          warehouseId: newConfigForm.warehouseId || null,
          posTerminalId: newConfigForm.posTerminalId || null
        })
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Configuracion creada correctamente')
        setNewConfigForm(null)
        fetchData()
      } else {
        showNotification('error', 'Error', data.error || 'No se pudo crear la configuracion')
      }
    } catch (error) {
      console.error('Error creating config:', error)
      showNotification('error', 'Error', 'Error al crear configuracion')
    } finally {
      setSaving(false)
    }
  }

  // Delete configuration
  const handleDeleteConfig = async (configId: number) => {
    if (!confirm('¿Estas seguro de eliminar esta configuracion?')) return

    try {
      const response = await fetch(`/api/print/configurations/${configId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Configuracion eliminada')
        fetchData()
      } else {
        showNotification('error', 'Error', data.error || 'No se pudo eliminar')
      }
    } catch (error) {
      console.error('Error deleting config:', error)
      showNotification('error', 'Error', 'Error al eliminar configuracion')
    }
  }

  // Toggle auto-print
  const handleToggleAutoPrint = async (config: PrintConfiguration) => {
    try {
      const response = await fetch(`/api/print/configurations/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoPrint: !config.autoPrint
        })
      })

      const data = await response.json()

      if (data.success) {
        fetchData()
      } else {
        showNotification('error', 'Error', data.error || 'No se pudo actualizar')
      }
    } catch (error) {
      console.error('Error updating config:', error)
    }
  }

  // Render configuration row
  const renderConfigRow = (config: PrintConfiguration) => {
    const docType = DOCUMENT_TYPES.find(d => d.value === config.documentType)
    const isOnline = isServiceOnline(config.printServiceId)

    return (
      <div
        key={config.id}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          theme === 'dark' ? 'bg-zinc-800/50' : 'bg-gray-50'
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-zinc-200' : 'text-gray-700'
            )}>
              {docType?.label || config.documentType}
            </span>
          </div>
          <div className={cn(
            "text-xs px-2 py-1 rounded",
            theme === 'dark' ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-200 text-gray-600'
          )}>
            {config.printerName}
          </div>
          <div className={cn(
            "text-xs",
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>
            {config.copies} copia{config.copies > 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoPrint}
              onChange={() => handleToggleAutoPrint(config)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={cn(
              "text-xs",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
            )}>
              Auto-imprimir
            </span>
          </label>
          <button
            onClick={() => handleDeleteConfig(config.id)}
            className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Render add config form
  const renderAddConfigForm = (scope: { warehouseId?: number; posTerminalId?: number }) => {
    const isOpen = newConfigForm &&
      newConfigForm.warehouseId === (scope.warehouseId || null) &&
      newConfigForm.posTerminalId === (scope.posTerminalId || null)

    if (!isOpen) {
      return (
        <button
          onClick={() => setNewConfigForm({
            documentType: '',
            printServiceId: null,
            printerId: null,
            copies: 1,
            autoPrint: true,
            warehouseId: scope.warehouseId || null,
            posTerminalId: scope.posTerminalId || null
          })}
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg border-2 border-dashed w-full",
            "hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors",
            theme === 'dark' ? 'border-zinc-700 text-zinc-400' : 'border-gray-300 text-gray-500'
          )}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Agregar configuracion</span>
        </button>
      )
    }

    const selectedPrinters = newConfigForm?.printServiceId
      ? getServicePrinters(newConfigForm.printServiceId)
      : []

    return (
      <div className={cn(
        "p-4 rounded-lg border",
        theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'
      )}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={cn(
              "block text-xs font-medium mb-1",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              Tipo de Documento
            </label>
            <select
              value={newConfigForm?.documentType || ''}
              onChange={(e) => setNewConfigForm(prev => prev ? { ...prev, documentType: e.target.value } : null)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="">Seleccionar...</option>
              {DOCUMENT_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={cn(
              "block text-xs font-medium mb-1",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              Servicio de Impresion
            </label>
            <select
              value={newConfigForm?.printServiceId || ''}
              onChange={(e) => setNewConfigForm(prev => prev ? {
                ...prev,
                printServiceId: parseInt(e.target.value) || null,
                printerId: null
              } : null)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="">Seleccionar...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.serviceName} {s.status === 'active' ? '(Online)' : '(Offline)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={cn(
              "block text-xs font-medium mb-1",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              Impresora
            </label>
            <select
              value={newConfigForm?.printerId || ''}
              onChange={(e) => setNewConfigForm(prev => prev ? { ...prev, printerId: parseInt(e.target.value) || null } : null)}
              disabled={!newConfigForm?.printServiceId}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  : 'bg-white border-gray-300 text-gray-900',
                !newConfigForm?.printServiceId && 'opacity-50'
              )}
            >
              <option value="">Seleccionar...</option>
              {selectedPrinters.map(p => (
                <option key={p.id} value={p.id}>
                  {p.printerName} ({p.printerType})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className={cn(
                "block text-xs font-medium mb-1",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>
                Copias
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={newConfigForm?.copies || 1}
                onChange={(e) => setNewConfigForm(prev => prev ? { ...prev, copies: parseInt(e.target.value) || 1 } : null)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm",
                  theme === 'dark'
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                    : 'bg-white border-gray-300 text-gray-900'
                )}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newConfigForm?.autoPrint || false}
                  onChange={(e) => setNewConfigForm(prev => prev ? { ...prev, autoPrint: e.target.checked } : null)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                )}>
                  Auto-imprimir
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewConfigForm(null)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleCreateConfig}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    )
  }

  // Render warehouse section
  const renderWarehouseSection = (warehouse: Warehouse) => {
    const isExpanded = expandedWarehouses.has(warehouse.id)
    const configs = getWarehouseConfigs(warehouse.id)

    return (
      <div
        key={warehouse.id}
        className={cn(
          "rounded-xl border overflow-hidden",
          theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-white'
        )}
      >
        <button
          onClick={() => {
            const newExpanded = new Set(expandedWarehouses)
            if (isExpanded) {
              newExpanded.delete(warehouse.id)
            } else {
              newExpanded.add(warehouse.id)
            }
            setExpandedWarehouses(newExpanded)
          }}
          className={cn(
            "w-full flex items-center justify-between p-4",
            "hover:bg-black/5 transition-colors",
            theme === 'dark' ? 'hover:bg-white/5' : ''
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br from-amber-500 to-orange-600"
            )}>
              <Warehouse className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h3 className={cn(
                "font-semibold",
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              )}>
                {warehouse.name}
              </h3>
              <p className={cn(
                "text-xs",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                {configs.length} configuracion{configs.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className={cn(
            "p-4 border-t space-y-3",
            theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
          )}>
            {configs.map(renderConfigRow)}
            {renderAddConfigForm({ warehouseId: warehouse.id })}
          </div>
        )}
      </div>
    )
  }

  // Render terminal section
  const renderTerminalSection = (terminal: POSTerminal) => {
    const isExpanded = expandedTerminals.has(terminal.id)
    const configs = getTerminalConfigs(terminal.id)

    return (
      <div
        key={terminal.id}
        className={cn(
          "rounded-xl border overflow-hidden",
          theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-white'
        )}
      >
        <button
          onClick={() => {
            const newExpanded = new Set(expandedTerminals)
            if (isExpanded) {
              newExpanded.delete(terminal.id)
            } else {
              newExpanded.add(terminal.id)
            }
            setExpandedTerminals(newExpanded)
          }}
          className={cn(
            "w-full flex items-center justify-between p-4",
            "hover:bg-black/5 transition-colors",
            theme === 'dark' ? 'hover:bg-white/5' : ''
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              "bg-gradient-to-br from-violet-500 to-purple-600"
            )}>
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h3 className={cn(
                "font-semibold",
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              )}>
                {terminal.name}
              </h3>
              <p className={cn(
                "text-xs",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                {terminal.warehouseName} - {configs.length} configuracion{configs.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className={cn(
            "p-4 border-t space-y-3",
            theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
          )}>
            {configs.map(renderConfigRow)}
            {renderAddConfigForm({ posTerminalId: terminal.id })}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingBox text="Cargando configuracion..." size="md" />
        </div>
      </DashboardLayout>
    )
  }

  const globalConfigs = getGlobalConfigs()

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-blue-500 to-indigo-600"
            )}>
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Configuracion de Impresion
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>
                Asigna impresoras predeterminadas por almacen, terminal o modulo
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Services Summary */}
        <div className={cn(
          "p-4 rounded-xl",
          theme === 'dark' ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-gray-50 border border-gray-200'
        )}>
          <div className="flex items-center gap-4">
            <Printer className="w-5 h-5 text-blue-500" />
            <span className={cn(
              "text-sm",
              theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
            )}>
              <strong>{services.filter(s => s.status === 'active').length}</strong> de {services.length} servicios online
            </span>
            <span className={cn(
              "text-sm",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              - {configurations.length} configuraciones activas
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-zinc-800 w-fit">
          <button
            onClick={() => setActiveTab('warehouses')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'warehouses'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Warehouse className="w-4 h-4" />
            Almacenes
          </button>
          <button
            onClick={() => setActiveTab('terminals')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'terminals'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Monitor className="w-4 h-4" />
            Terminales POS
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'global'
                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            <Globe className="w-4 h-4" />
            Global
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'warehouses' && (
            <>
              {warehouses.length === 0 ? (
                <div className={cn(
                  "text-center py-12 rounded-xl",
                  theme === 'dark' ? 'bg-zinc-900/50' : 'bg-gray-50'
                )}>
                  <Warehouse className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                  )}>
                    No hay almacenes configurados
                  </p>
                </div>
              ) : (
                warehouses.map(renderWarehouseSection)
              )}
            </>
          )}

          {activeTab === 'terminals' && (
            <>
              {terminals.length === 0 ? (
                <div className={cn(
                  "text-center py-12 rounded-xl",
                  theme === 'dark' ? 'bg-zinc-900/50' : 'bg-gray-50'
                )}>
                  <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                  )}>
                    No hay terminales POS configuradas
                  </p>
                </div>
              ) : (
                terminals.map(renderTerminalSection)
              )}
            </>
          )}

          {activeTab === 'global' && (
            <div className={cn(
              "rounded-xl border overflow-hidden",
              theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-white'
            )}>
              <div className={cn(
                "flex items-center gap-3 p-4 border-b",
                theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  "bg-gradient-to-br from-emerald-500 to-teal-600"
                )}>
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                  )}>
                    Configuracion Global
                  </h3>
                  <p className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Aplica cuando no hay configuracion especifica de almacen o terminal
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {globalConfigs.map(renderConfigRow)}
                {renderAddConfigForm({})}
              </div>
            </div>
          )}
        </div>

        {/* Help text */}
        <div className={cn(
          "p-4 rounded-xl flex items-start gap-3",
          theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
        )}>
          <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className={cn(
            "text-sm",
            theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
          )}>
            <strong>Jerarquia de impresion:</strong> El sistema busca primero una configuracion para la terminal POS,
            luego para el almacen, y finalmente la configuracion global. Si "Auto-imprimir" esta activado,
            el documento se enviara directamente sin mostrar dialogo de seleccion.
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
