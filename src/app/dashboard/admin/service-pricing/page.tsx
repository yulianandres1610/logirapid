'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  Tag,
  History,
  Building2,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertCircle,
  Check,
  RefreshCw,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { usePlatformPricing, usePricingHistory, useProviders, ServicePrice } from '@/hooks/useServicePricing'

export default function ServicePricingPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { data: pricingData, loading, error, refresh, updatePrice, bulkUpdatePrices } = usePlatformPricing()
  const { history, loading: historyLoading, refresh: refreshHistory } = usePricingHistory({ limit: 20 })
  const { providers } = useProviders()

  const [activeTab, setActiveTab] = useState<'global' | 'providers' | 'history'>('global')
  const [editingPrices, setEditingPrices] = useState<Record<string, { providerCost: number; platformPrice: number }>>({})
  const [saving, setSaving] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    main: true,
    paqueteria: true,
    other: false
  })
  const [searchTerm, setSearchTerm] = useState('')

  const handlePriceChange = (serviceId: string, field: 'providerCost' | 'platformPrice', value: number) => {
    setEditingPrices(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        providerCost: prev[serviceId]?.providerCost ?? pricingData?.global.find(p => p.serviceId === serviceId)?.providerCost ?? 0,
        platformPrice: prev[serviceId]?.platformPrice ?? pricingData?.global.find(p => p.serviceId === serviceId)?.platformPrice ?? 0,
        [field]: value
      }
    }))
  }

  const handleSaveAll = async () => {
    if (Object.keys(editingPrices).length === 0) {
      showNotification('info', 'Sin cambios', 'No hay cambios que guardar')
      return
    }

    setSaving(true)
    try {
      const prices = Object.entries(editingPrices).map(([serviceId, { providerCost, platformPrice }]) => ({
        serviceId,
        providerCost,
        platformPrice
      }))

      await bulkUpdatePrices(prices, 'Actualización masiva desde panel de administración')
      setEditingPrices({})
      showNotification('success', 'Precios guardados', `${prices.length} precios actualizados correctamente`)
      refreshHistory()
    } catch (err) {
      showNotification('error', 'Error', err instanceof Error ? err.message : 'Error al guardar precios')
    } finally {
      setSaving(false)
    }
  }

  const groupedPricing = pricingData?.global.reduce((acc, price) => {
    const category = price.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(price)
    return acc
  }, {} as Record<string, typeof pricingData.global>) || {}

  const categoryLabels: Record<string, string> = {
    main: 'Servicios Principales',
    paqueteria: 'Paquetería',
    other: 'Otros Servicios'
  }

  const filteredPricing = searchTerm
    ? pricingData?.global.filter(p =>
        p.serviceLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.serviceId.toLowerCase().includes(searchTerm.toLowerCase())
      ) || []
    : null

  const hasUnsavedChanges = Object.keys(editingPrices).length > 0

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Precios de Servicios
            </h1>
            <p className={cn(
              "text-sm mt-1",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Configura los costos de proveedor y precios de plataforma para cada servicio
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className={cn(
                "text-sm px-3 py-1 rounded-full",
                theme === 'dark' ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700"
              )}>
                {Object.keys(editingPrices).length} cambios sin guardar
              </span>
            )}

            <button
              onClick={() => refresh()}
              disabled={loading}
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark'
                  ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              )}
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>

            <button
              onClick={handleSaveAll}
              disabled={!hasUnsavedChanges || saving}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                hasUnsavedChanges
                  ? "bg-exa-primary text-white hover:bg-exa-primary/90"
                  : theme === 'dark'
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={cn(
          "flex gap-1 p-1 rounded-xl w-fit",
          theme === 'dark' ? "bg-gray-800/50" : "bg-gray-100"
        )}>
          {[
            { id: 'global', label: 'Precios Globales', icon: Tag },
            { id: 'providers', label: 'Proveedores', icon: Building2 },
            { id: 'history', label: 'Historial', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? theme === 'dark'
                    ? "bg-exa-secondary text-white"
                    : "bg-white text-gray-900 shadow-sm"
                  : theme === 'dark'
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-600 hover:text-gray-900"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className={cn(
            "p-4 rounded-xl flex items-center gap-3",
            theme === 'dark' ? "bg-red-900/20 border border-red-500/30" : "bg-red-50 border border-red-200"
          )}>
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !pricingData && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={cn(
              "w-8 h-8 animate-spin",
              theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
            )} />
          </div>
        )}

        {/* Global Pricing Tab */}
        {activeTab === 'global' && pricingData && (
          <div className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
                theme === 'dark' ? "text-gray-500" : "text-gray-400"
              )} />
              <input
                type="text"
                placeholder="Buscar servicio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-xl border transition-all",
                  theme === 'dark'
                    ? "bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-exa-secondary"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-exa-primary"
                )}
              />
            </div>

            {/* Search Results or Grouped View */}
            {filteredPricing ? (
              <div className={cn(
                "rounded-xl border overflow-hidden",
                theme === 'dark' ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"
              )}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(
                      theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
                    )}>
                      <tr>
                        <th className={cn(
                          "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Servicio
                        </th>
                        <th className={cn(
                          "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Costo Proveedor
                        </th>
                        <th className={cn(
                          "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Precio Plataforma
                        </th>
                        <th className={cn(
                          "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Margen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredPricing.map(price => (
                        <PriceRow
                          key={price.serviceId}
                          price={price}
                          editingPrices={editingPrices}
                          onPriceChange={handlePriceChange}
                          theme={theme}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              Object.entries(groupedPricing).map(([category, prices]) => (
                <div
                  key={category}
                  className={cn(
                    "rounded-xl border overflow-hidden",
                    theme === 'dark' ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"
                  )}
                >
                  <button
                    onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 transition-all",
                      theme === 'dark' ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-50 hover:bg-gray-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Tag className={cn(
                        "w-5 h-5",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )} />
                      <span className={cn(
                        "font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {categoryLabels[category] || category}
                      </span>
                      <span className={cn(
                        "text-sm px-2 py-0.5 rounded-full",
                        theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                      )}>
                        {prices.length} servicios
                      </span>
                    </div>
                    {expandedCategories[category] ? (
                      <ChevronUp className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-500")} />
                    ) : (
                      <ChevronDown className={cn("w-5 h-5", theme === 'dark' ? "text-gray-400" : "text-gray-500")} />
                    )}
                  </button>

                  <AnimatePresence>
                    {expandedCategories[category] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={cn(
                              theme === 'dark' ? "bg-gray-800/50" : "bg-gray-50/50"
                            )}>
                              <tr>
                                <th className={cn(
                                  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Servicio
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Costo Proveedor
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Precio Plataforma
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Margen
                                </th>
                              </tr>
                            </thead>
                            <tbody className={cn(
                              "divide-y",
                              theme === 'dark' ? "divide-gray-800" : "divide-gray-100"
                            )}>
                              {prices.map(price => (
                                <PriceRow
                                  key={price.serviceId}
                                  price={price}
                                  editingPrices={editingPrices}
                                  onPriceChange={handlePriceChange}
                                  theme={theme}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            {providers.length === 0 ? (
              <div className={cn(
                "p-8 text-center rounded-xl border-2 border-dashed",
                theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
              )}>
                <Building2 className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? "text-gray-600" : "text-gray-400")} />
                <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                  No hay proveedores registrados. Marque empresas como proveedores en el wizard de creación de empresas.
                </p>
              </div>
            ) : (
              providers.map(provider => (
                <div
                  key={provider.id}
                  className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={cn(
                        "font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {provider.legalName}
                      </h3>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        {provider.email}
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      provider.status === 'active'
                        ? theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                        : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-600"
                    )}>
                      {provider.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.providerServices.map(serviceId => (
                      <span
                        key={serviceId}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          theme === 'dark' ? "bg-amber-900/30 text-amber-400" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {pricingData?.serviceDefinitions[serviceId]?.label || serviceId}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={cn(
                  "w-8 h-8 animate-spin",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )} />
              </div>
            ) : history.length === 0 ? (
              <div className={cn(
                "p-8 text-center rounded-xl border-2 border-dashed",
                theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
              )}>
                <History className={cn("w-12 h-12 mx-auto mb-4", theme === 'dark' ? "text-gray-600" : "text-gray-400")} />
                <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                  No hay cambios de precios registrados.
                </p>
              </div>
            ) : (
              <div className={cn(
                "rounded-xl border overflow-hidden",
                theme === 'dark' ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"
              )}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(
                      theme === 'dark' ? "bg-gray-800" : "bg-gray-50"
                    )}>
                      <tr>
                        <th className={cn(
                          "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Fecha
                        </th>
                        <th className={cn(
                          "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Servicio
                        </th>
                        <th className={cn(
                          "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Cambio
                        </th>
                        <th className={cn(
                          "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Usuario
                        </th>
                      </tr>
                    </thead>
                    <tbody className={cn(
                      "divide-y",
                      theme === 'dark' ? "divide-gray-800" : "divide-gray-100"
                    )}>
                      {history.map(item => (
                        <tr key={item.id}>
                          <td className={cn(
                            "px-4 py-3 text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {new Date(item.changedAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm font-medium",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {pricingData?.serviceDefinitions[item.serviceId]?.label || item.serviceId}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-sm">
                              {item.changeType === 'create' ? (
                                <span className="text-green-500">Creado</span>
                              ) : (
                                <>
                                  <span className={theme === 'dark' ? "text-gray-500" : "text-gray-400"}>
                                    ${item.oldValues.platformPrice?.toFixed(2) || '0.00'}
                                  </span>
                                  <span className={theme === 'dark' ? "text-gray-500" : "text-gray-400"}>→</span>
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-white" : "text-gray-900"
                                  )}>
                                    ${item.newValues.platformPrice?.toFixed(2) || '0.00'}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            {item.changedByUserName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

// Price Row Component
function PriceRow({
  price,
  editingPrices,
  onPriceChange,
  theme
}: {
  price: ServicePrice
  editingPrices: Record<string, { providerCost: number; platformPrice: number }>
  onPriceChange: (serviceId: string, field: 'providerCost' | 'platformPrice', value: number) => void
  theme: string
}) {
  const isEdited = !!editingPrices[price.serviceId]
  const currentProviderCost = editingPrices[price.serviceId]?.providerCost ?? price.providerCost ?? 0
  const currentPlatformPrice = editingPrices[price.serviceId]?.platformPrice ?? price.platformPrice
  const currentMargin = currentPlatformPrice - currentProviderCost
  const currentMarginPercentage = currentProviderCost > 0
    ? ((currentMargin / currentProviderCost) * 100).toFixed(1)
    : '0.0'

  return (
    <tr className={cn(
      isEdited && (theme === 'dark' ? "bg-amber-900/10" : "bg-amber-50")
    )}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isEdited && (
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          )}
          <span className={cn(
            "font-medium text-sm",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            {price.serviceLabel}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <div className="relative">
            <span className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 text-sm",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentProviderCost}
              onChange={(e) => onPriceChange(price.serviceId, 'providerCost', parseFloat(e.target.value) || 0)}
              className={cn(
                "w-28 pl-7 pr-3 py-2 rounded-lg border text-sm text-center",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-600 text-white focus:border-exa-secondary"
                  : "bg-white border-gray-300 text-gray-900 focus:border-exa-primary"
              )}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <div className="relative">
            <span className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 text-sm",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentPlatformPrice}
              onChange={(e) => onPriceChange(price.serviceId, 'platformPrice', parseFloat(e.target.value) || 0)}
              className={cn(
                "w-28 pl-7 pr-3 py-2 rounded-lg border text-sm text-center",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-600 text-white focus:border-exa-secondary"
                  : "bg-white border-gray-300 text-gray-900 focus:border-exa-primary"
              )}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
            currentMargin >= 0
              ? theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
              : theme === 'dark' ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700"
          )}>
            <TrendingUp className="w-4 h-4" />
            <span>${currentMargin.toFixed(2)}</span>
            <span className="text-xs opacity-70">({currentMarginPercentage}%)</span>
          </div>
        </div>
      </td>
    </tr>
  )
}
