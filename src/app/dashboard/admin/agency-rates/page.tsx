'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Plus,
  Settings,
  Save,
  Trash2,
  TrendingUp,
  DollarSign,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Edit,
  Eye,
  EyeOff,
  Calculator,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AgencyRateConfig, CalculatedAgencyRate } from '@/lib/agency-rates'

interface AgencyRateCardProps {
  currency: string
  flag: string
  name: string
  adjustment: { percentage: number; enabled: boolean }
  baseRate: number
  calculatedRate: number
  isEditing: boolean
  onToggle: (currency: string) => void
  onAdjustmentChange: (currency: string, percentage: number) => void
}

const AgencyRateCard: React.FC<AgencyRateCardProps> = ({
  currency,
  flag,
  name,
  adjustment,
  baseRate,
  calculatedRate,
  isEditing,
  onToggle,
  onAdjustmentChange
}) => {
  const { theme } = useTheme()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn(
        "relative rounded-xl border-2 p-6 transition-all duration-300",
        adjustment.enabled
          ? theme === 'dark'
            ? "bg-gradient-to-br from-gray-800 to-gray-700 border-exa-secondary/50"
            : "bg-gradient-to-br from-white to-gray-50 border-exa-primary/30"
          : theme === 'dark'
            ? "bg-gray-800/50 border-gray-600 opacity-60"
            : "bg-gray-100/50 border-gray-300 opacity-60"
      )}
    >
      {/* Background gradient effect */}
      {adjustment.enabled && (
        <div className={cn(
          "absolute inset-0 rounded-xl opacity-10",
          theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
        )} />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                adjustment.enabled
                  ? theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                  : theme === 'dark' ? "bg-gray-700" : "bg-gray-300"
              )}
              whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
            >
              {flag}
            </motion.div>
            <div>
              <h3 className={cn(
                "font-bold text-lg",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {currency}
              </h3>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                {name}
              </p>
            </div>
          </div>

          <button
            onClick={() => onToggle(currency)}
            className={cn(
              "p-2 rounded-lg transition-all duration-300",
              adjustment.enabled
                ? theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/20 text-exa-primary"
                : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
            )}
          >
            {adjustment.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Rates Display */}
        <div className="space-y-3">
          <div className={cn(
            "flex justify-between items-center p-3 rounded-lg",
            theme === 'dark' ? "bg-gray-700/50" : "bg-gray-100/50"
          )}>
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              Tasa Base
            </span>
            <span className={cn(
              "font-bold",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              ${baseRate.toFixed(2)}
            </span>
          </div>

          {adjustment.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className={cn(
                "flex justify-between items-center p-3 rounded-lg",
                theme === 'dark' ? "bg-exa-secondary/20 border border-exa-secondary/30" : "bg-exa-primary/10 border border-exa-primary/20"
              )}>
                <span className={cn(
                  "text-sm font-medium flex items-center gap-2",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )}>
                  <Calculator className="w-4 h-4" />
                  Ajuste
                </span>
                <span className={cn(
                  "font-bold flex items-center gap-1",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )}>
                  <TrendingUp className="w-4 h-4" />
                  +{adjustment.percentage}%
                </span>
              </div>

              <div className={cn(
                "flex justify-between items-center p-3 rounded-lg",
                theme === 'dark' ? "bg-gray-700/50" : "bg-gray-100/50"
              )}>
                <span className={cn(
                  "text-sm font-medium flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <DollarSign className="w-4 h-4" />
                  Tasa Final
                </span>
                <motion.span
                  className={cn(
                    "font-bold text-lg",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                >
                  ${calculatedRate.toFixed(2)}
                </motion.span>
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <label className={cn(
                    "text-sm font-medium flex items-center gap-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    <TrendingUp className="w-4 h-4" />
                    Porcentaje de Ajuste
                  </label>
                  <input
                    type="number"
                    value={adjustment.percentage}
                    onChange={(e) => onAdjustmentChange(currency, parseFloat(e.target.value) || 0)}
                    className={cn(
                      "w-full p-3 rounded-lg border text-center font-bold",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                    step="0.1"
                    min="-50"
                    max="100"
                  />
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Status indicator */}
        <div className="mt-4 flex items-center gap-2">
          {adjustment.enabled ? (
            <CheckCircle className={cn(
              "w-4 h-4",
              theme === 'dark' ? "text-green-400" : "text-green-500"
            )} />
          ) : (
            <AlertTriangle className={cn(
              "w-4 h-4",
              theme === 'dark' ? "text-yellow-400" : "text-yellow-500"
            )} />
          )}
          <span className={cn(
            "text-xs font-medium",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            {adjustment.enabled ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export default function AgencyRatesPage() {
  const { theme } = useTheme()
  const [agencyConfigs, setAgencyConfigs] = useState<AgencyRateConfig[]>([])
  const [selectedAgency, setSelectedAgency] = useState<AgencyRateConfig | null>(null)
  const [baseRates, setBaseRates] = useState<Record<string, any>>({})
  const [calculatedRates, setCalculatedRates] = useState<Record<string, CalculatedAgencyRate>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showNewAgencyForm, setShowNewAgencyForm] = useState(false)
  const [newAgencyName, setNewAgencyName] = useState('')

  const currencies = [
    { code: 'USD', flag: '🇺🇸', name: 'Dólar Americano' },
    { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
    { code: 'MLC', flag: '💳', name: 'Tarjeta de Débito' },
    { code: 'GBP', flag: '🇬🇧', name: 'Libra Esterlina' },
    { code: 'CAD', flag: '🇨🇦', name: 'Dólar Canadiense' },
    { code: 'MXN', flag: '🇲🇽', name: 'Peso Mexicano' },
    { code: 'BRL', flag: '🇧🇷', name: 'Real Brasileño' },
    { code: 'ZELLE', flag: '💸', name: 'Zelle' },
    { code: 'CLA', flag: '📱', name: 'CashApp' }
  ]

  const fetchAgencyConfigs = async () => {
    try {
      const response = await fetch('/api/agency-rates')
      const data = await response.json()
      if (data.success) {
        setAgencyConfigs(data.data)
      }
    } catch (error) {
      console.error('Error fetching agency configs:', error)
    }
  }

  const fetchBaseRates = async () => {
    try {
      const response = await fetch('/api/exchange-rates')
      const data = await response.json()
      if (data.success) {
        setBaseRates(data.data)
      }
    } catch (error) {
      console.error('Error fetching base rates:', error)
    }
  }

  const calculateRates = async (agencyConfig: AgencyRateConfig) => {
    try {
      const response = await fetch(`/api/agency-rates/${agencyConfig.agencyId}`)
      const data = await response.json()
      if (data.success) {
        setCalculatedRates(data.data.rates)
      }
    } catch (error) {
      console.error('Error calculating rates:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchAgencyConfigs(), fetchBaseRates()])
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (selectedAgency && Object.keys(baseRates).length > 0) {
      calculateRates(selectedAgency)
    }
  }, [selectedAgency, baseRates])

  const handleSelectAgency = (config: AgencyRateConfig) => {
    setSelectedAgency(config)
    setIsEditing(false)
  }

  const handleToggleCurrency = (currency: string) => {
    if (!selectedAgency) return

    const updatedConfig = {
      ...selectedAgency,
      adjustments: {
        ...selectedAgency.adjustments,
        [currency]: {
          ...selectedAgency.adjustments[currency as keyof typeof selectedAgency.adjustments],
          enabled: !selectedAgency.adjustments[currency as keyof typeof selectedAgency.adjustments].enabled
        }
      }
    }

    setSelectedAgency(updatedConfig)
  }

  const handleAdjustmentChange = (currency: string, percentage: number) => {
    if (!selectedAgency) return

    const updatedConfig = {
      ...selectedAgency,
      adjustments: {
        ...selectedAgency.adjustments,
        [currency]: {
          ...selectedAgency.adjustments[currency as keyof typeof selectedAgency.adjustments],
          percentage
        }
      }
    }

    setSelectedAgency(updatedConfig)

    // Recalculate rates immediately
    if (Object.keys(baseRates).length > 0) {
      const baseRate = baseRates[currency]?.rate || 0
      const calculatedRate = baseRate * (1 + percentage / 100)

      setCalculatedRates(prev => ({
        ...prev,
        [currency]: {
          currency,
          baseRate,
          adjustmentPercentage: percentage,
          calculatedRate: Math.round(calculatedRate * 100) / 100,
          formatted: calculatedRate.toFixed(2),
          lastUpdate: new Date().toISOString()
        }
      }))
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedAgency) return

    try {
      setSaving(true)
      const response = await fetch(`/api/agency-rates/${selectedAgency.agencyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName: selectedAgency.agencyName,
          adjustments: selectedAgency.adjustments
        })
      })

      const data = await response.json()
      if (data.success) {
        await fetchAgencyConfigs()
        setIsEditing(false)
        setSelectedAgency(data.data)
      }
    } catch (error) {
      console.error('Error saving config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateNewAgency = async () => {
    if (!newAgencyName.trim()) return

    try {
      setSaving(true)
      const agencyId = `agency_${Date.now()}`
      const response = await fetch(`/api/agency-rates/${agencyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName: newAgencyName.trim(),
          adjustments: {
            USD: { percentage: 5.0, enabled: true },
            EUR: { percentage: 5.0, enabled: true },
            MLC: { percentage: 3.0, enabled: true },
            GBP: { percentage: 6.0, enabled: true },
            CAD: { percentage: 4.0, enabled: true },
            MXN: { percentage: 2.0, enabled: true },
            BRL: { percentage: 3.0, enabled: true },
            ZELLE: { percentage: 4.0, enabled: true },
            CLA: { percentage: 4.0, enabled: true }
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        await fetchAgencyConfigs()
        setShowNewAgencyForm(false)
        setNewAgencyName('')
        setSelectedAgency(data.data)
      }
    } catch (error) {
      console.error('Error creating agency:', error)
    } finally {
      setSaving(false)
    }
  }

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
                Tasas para Agencias
              </h1>
              <p className={cn(
                "mt-2 text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Configura porcentajes de ajuste sobre las tasas base deltoque
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowNewAgencyForm(true)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-exa-secondary text-white hover:bg-exa-primary"
                    : "bg-exa-primary text-white hover:bg-exa-secondary"
                )}
              >
                <Plus className="w-4 h-4" />
                Nueva Agencia
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                disabled={!selectedAgency}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  !selectedAgency && "opacity-50 cursor-not-allowed",
                  isEditing
                    ? theme === 'dark' ? "bg-green-600 text-white" : "bg-green-500 text-white"
                    : theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                )}
              >
                <Edit className="w-4 h-4" />
                {isEditing ? 'Editando' : 'Editar'}
              </button>

              {isEditing && (
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                    saving && "opacity-50",
                    theme === 'dark'
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-green-500 text-white hover:bg-green-600"
                  )}
                >
                  <motion.div
                    animate={saving ? { rotate: 360 } : {}}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Save className="w-4 h-4" />
                  </motion.div>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          </motion.div>

          {/* Info Panel */}
          {selectedAgency && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-xl p-6 border",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Building2 className={cn(
                    "w-8 h-8",
                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                  )} />
                  <div>
                    <h2 className={cn(
                      "text-xl font-semibold",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {selectedAgency.agencyName}
                    </h2>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      ID: {selectedAgency.agencyId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Info className={cn(
                    "w-4 h-4",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )} />
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    {Object.values(selectedAgency.adjustments).filter(a => a.enabled).length} de 9 monedas activas
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Agency List */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "rounded-xl p-6 border",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                <h3 className={cn(
                  "font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <Building2 className="w-5 h-5" />
                  Agencias
                </h3>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {agencyConfigs.map((config) => (
                    <motion.button
                      key={config.id}
                      onClick={() => handleSelectAgency(config)}
                      whileHover={{ x: 2 }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-all duration-300",
                        selectedAgency?.agencyId === config.agencyId
                          ? theme === 'dark' ? "bg-exa-secondary/20 border border-exa-secondary/50" : "bg-exa-primary/10 border border-exa-primary/30"
                          : theme === 'dark' ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"
                      )}
                    >
                      <div className={cn(
                        "font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {config.agencyName}
                      </div>
                      <div className={cn(
                        "text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        {Object.values(config.adjustments).filter(a => a.enabled).length} activas
                      </div>
                    </motion.button>
                  ))}
                </div>

                {agencyConfigs.length === 0 && !loading && (
                  <div className={cn(
                    "text-center py-8",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay agencias configuradas</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Rates Cards */}
            <div className="lg:col-span-3">
              {selectedAgency ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currencies.map((currency, index) => {
                    const adjustment = selectedAgency.adjustments[currency.code as keyof typeof selectedAgency.adjustments]
                    const baseRate = baseRates[currency.code]?.rate || 0
                    const calculatedRate = calculatedRates[currency.code]?.calculatedRate || baseRate

                    return (
                      <div key={currency.code}>
                        <AgencyRateCard
                          currency={currency.code}
                          flag={currency.flag}
                          name={currency.name}
                          adjustment={adjustment}
                          baseRate={baseRate}
                          calculatedRate={calculatedRate}
                          isEditing={isEditing}
                          onToggle={handleToggleCurrency}
                          onAdjustmentChange={handleAdjustmentChange}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "rounded-xl p-12 border text-center",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700"
                      : "bg-white border-gray-200"
                  )}
                >
                  <Building2 className={cn(
                    "w-16 h-16 mx-auto mb-4 opacity-50",
                    theme === 'dark' ? "text-gray-600" : "text-gray-400"
                  )} />
                  <h3 className={cn(
                    "text-xl font-semibold mb-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Selecciona una agencia
                  </h3>
                  <p className={cn(
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Elige una agencia de la lista o crea una nueva para comenzar a configurar las tasas
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* New Agency Modal */}
          <AnimatePresence>
            {showNewAgencyForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowNewAgencyForm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "rounded-xl p-6 w-full max-w-md",
                    theme === 'dark' ? "bg-gray-800" : "bg-white"
                  )}
                >
                  <h3 className={cn(
                    "text-xl font-semibold mb-4",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Nueva Agencia
                  </h3>

                  <input
                    type="text"
                    value={newAgencyName}
                    onChange={(e) => setNewAgencyName(e.target.value)}
                    placeholder="Nombre de la agencia"
                    className={cn(
                      "w-full p-3 rounded-lg border mb-4",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    )}
                    autoFocus
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowNewAgencyForm(false)}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium transition-all",
                        theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"
                      )}
                    >
                      Cancelar
                    </button>

                    <button
                      onClick={handleCreateNewAgency}
                      disabled={!newAgencyName.trim() || saving}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium transition-all",
                        (!newAgencyName.trim() || saving) && "opacity-50 cursor-not-allowed",
                        theme === 'dark'
                          ? "bg-exa-secondary text-white hover:bg-exa-primary"
                          : "bg-exa-primary text-white hover:bg-exa-secondary"
                      )}
                    >
                      {saving ? 'Creando...' : 'Crear'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  )
}