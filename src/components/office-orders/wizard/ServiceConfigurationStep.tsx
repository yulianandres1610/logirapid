'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Package, Weight, Ruler, Box, Scan, Settings, Plus, Trash2, Check, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { motion, AnimatePresence } from 'framer-motion'

interface BoxConfig {
  boxCode: string
  weight: string
  dimensions: { length: string; width: string; height: string }
  contentTypeIds: string[]
  validationStatus?: 'idle' | 'validating' | 'valid' | 'invalid'
  validationMessage?: string
  empaqueId?: number
}

interface ServiceConfig {
  serviceId: number
  serviceName: string
  serviceType: string
  basePrice: number
  requiresBoxCode: boolean
  requiresDimensions: boolean
  requiresWeight: boolean
  requiresContentType: boolean
  boxes: BoxConfig[]
}

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function ServiceConfigurationStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [configs, setConfigs] = useState<ServiceConfig[]>(wizardData.serviceConfigs || [])
  const [contentTypes, setContentTypes] = useState<any[]>([])
  const [loadingContentTypes, setLoadingContentTypes] = useState(false)

  useEffect(() => {
    fetchContentTypes()
    initializeConfigs()
  }, [])

  useEffect(() => {
    const allValid = configs.every(config => validateConfig(config))
    setCanProceed(allValid && configs.length > 0)
    updateWizardData('serviceConfigs', configs)
  }, [configs])

  const fetchContentTypes = async () => {
    setLoadingContentTypes(true)
    try {
      const response = await fetch('/api/package-content-types?activeOnly=true')
      const data = await response.json()
      if (data.success) setContentTypes(data.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingContentTypes(false)
    }
  }

  // Validar código de empaque en tiempo real
  const validateBoxCode = useCallback(async (configIndex: number, boxIndex: number, codigo: string) => {
    if (!codigo || codigo.trim() === '') {
      const newConfigs = [...configs]
      newConfigs[configIndex].boxes[boxIndex].validationStatus = 'idle'
      newConfigs[configIndex].boxes[boxIndex].validationMessage = ''
      newConfigs[configIndex].boxes[boxIndex].empaqueId = undefined
      setConfigs(newConfigs)
      return
    }

    // Marcar como validando
    const newConfigs = [...configs]
    newConfigs[configIndex].boxes[boxIndex].validationStatus = 'validating'
    setConfigs(newConfigs)

    try {
      const response = await fetch('/api/empaques/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim() })
      })

      const data = await response.json()
      const updatedConfigs = [...configs]

      if (data.valid) {
        updatedConfigs[configIndex].boxes[boxIndex].validationStatus = 'valid'
        updatedConfigs[configIndex].boxes[boxIndex].validationMessage = 'Empaque disponible ✓'
        updatedConfigs[configIndex].boxes[boxIndex].empaqueId = data.empaque.id
      } else {
        updatedConfigs[configIndex].boxes[boxIndex].validationStatus = 'invalid'
        updatedConfigs[configIndex].boxes[boxIndex].validationMessage = data.error
        updatedConfigs[configIndex].boxes[boxIndex].empaqueId = undefined
      }

      setConfigs(updatedConfigs)
    } catch (error) {
      console.error('Error validating box code:', error)
      const updatedConfigs = [...configs]
      updatedConfigs[configIndex].boxes[boxIndex].validationStatus = 'invalid'
      updatedConfigs[configIndex].boxes[boxIndex].validationMessage = 'Error al validar'
      updatedConfigs[configIndex].boxes[boxIndex].empaqueId = undefined
      setConfigs(updatedConfigs)
    }
  }, [configs])

  // Debounce para validación (500ms)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    configs.forEach((config, configIndex) => {
      if (config.requiresBoxCode) {
        config.boxes.forEach((box, boxIndex) => {
          if (box.boxCode) {
            const timer = setTimeout(() => {
              validateBoxCode(configIndex, boxIndex, box.boxCode)
            }, 500)
            timers.push(timer)
          }
        })
      }
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [configs.map(c => c.boxes.map(b => b.boxCode).join(',')).join('|')])

  const initializeConfigs = () => {
    if (configs.length === 0 && wizardData.selectedServices) {
      const newConfigs = wizardData.selectedServices.map((service: any) => {
        // Handle basePrice type safely
        let price = 0
        if (typeof service.basePrice === 'number') {
          price = service.basePrice
        } else if (service.basePrice) {
          const parsed = parseFloat(service.basePrice)
          price = !isNaN(parsed) ? parsed : 0
        }

        return {
          serviceId: service.id,
          serviceName: service.name,
          serviceType: service.serviceType,
          basePrice: price,
          requiresBoxCode: service.requiresBoxCode,
          requiresDimensions: service.requiresDimensions,
          requiresWeight: service.requiresWeight,
          requiresContentType: service.requiresContentType,
          boxes: [
            {
              boxCode: '',
              weight: '',
              dimensions: { length: '', width: '', height: '' },
              contentTypeIds: []
            }
          ]
        }
      })
      setConfigs(newConfigs)
    }
  }

  const validateConfig = (config: ServiceConfig) => {
    // Debe haber al menos una caja
    if (config.boxes.length === 0) return false

    // Todas las cajas deben estar válidas
    return config.boxes.every(box => {
      if (config.requiresBoxCode) {
        if (!box.boxCode) return false
        // Si requiere código de caja, debe estar validado como 'valid'
        if (box.validationStatus !== 'valid') return false
      }
      // Validar peso: debe existir, ser numérico y mayor a 0
      if (config.requiresWeight) {
        if (!box.weight || box.weight.trim() === '') return false
        const weightValue = parseFloat(box.weight)
        if (isNaN(weightValue) || weightValue <= 0) return false
      }
      if (config.requiresContentType && box.contentTypeIds.length === 0) return false
      return true
    })
  }

  const validateUniqueBoxCodes = () => {
    const allBoxCodes = configs.flatMap(c =>
      (c.boxes || []).map(b => b.boxCode).filter(code => code && code.trim() !== '')
    )
    const uniqueCodes = new Set(allBoxCodes)
    return allBoxCodes.length === uniqueCodes.size
  }

  const addBox = (configIndex: number) => {
    const newConfigs = [...configs]
    newConfigs[configIndex].boxes.push({
      boxCode: '',
      weight: '',
      dimensions: { length: '', width: '', height: '' },
      contentTypeIds: []
    })
    setConfigs(newConfigs)
  }

  const removeBox = (configIndex: number, boxIndex: number) => {
    const newConfigs = [...configs]
    // Mantener al menos 1 caja
    if (newConfigs[configIndex].boxes.length > 1) {
      newConfigs[configIndex].boxes.splice(boxIndex, 1)
      setConfigs(newConfigs)
    }
  }

  const updateBox = (configIndex: number, boxIndex: number, field: string, value: any) => {
    const newConfigs = [...configs]
    if (field.startsWith('dimensions.')) {
      const dimField = field.split('.')[1] as 'length' | 'width' | 'height'
      newConfigs[configIndex].boxes[boxIndex].dimensions[dimField] = value
    } else {
      newConfigs[configIndex].boxes[boxIndex] = {
        ...newConfigs[configIndex].boxes[boxIndex],
        [field]: value
      }
    }
    setConfigs(newConfigs)
  }

  const toggleContentType = (configIndex: number, boxIndex: number, contentTypeId: string) => {
    const newConfigs = [...configs]
    const contentTypeIds = newConfigs[configIndex].boxes[boxIndex].contentTypeIds
    const index = contentTypeIds.indexOf(contentTypeId)

    if (index > -1) {
      // Remover si ya está seleccionado
      contentTypeIds.splice(index, 1)
    } else {
      // Agregar si no está seleccionado
      contentTypeIds.push(contentTypeId)
    }

    setConfigs(newConfigs)
  }

  const isContentTypeSelected = (box: BoxConfig, contentTypeId: string) => {
    return box.contentTypeIds.includes(contentTypeId)
  }

  const getTotalBoxes = (config: ServiceConfig) => config.boxes.length
  const getTotalPrice = (config: ServiceConfig) => config.basePrice * getTotalBoxes(config)

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shadow-2xl bg-gradient-to-br",
            theme === 'dark'
              ? 'from-orange-600 to-orange-700 shadow-orange-500/30'
              : 'from-orange-500 to-orange-600 shadow-orange-400/30'
          )}
        >
          <Settings className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Configurar Servicios
        </h2>
        <p className={cn("text-base", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
          Completa la información para cada caja. Puedes agregar múltiples cajas por servicio.
        </p>
      </div>

      {!validateUniqueBoxCodes() && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl border-2",
            theme === 'dark'
              ? 'bg-red-900/20 border-red-700 text-red-400'
              : 'bg-red-50 border-red-300 text-red-700'
          )}
        >
          ⚠️ Hay códigos de caja duplicados. Cada caja debe tener un código único.
        </motion.div>
      )}

      {/* Loader global mientras se cargan tipos de contenido */}
      {loadingContentTypes && configs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "flex flex-col items-center justify-center py-16",
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}
        >
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mb-4" />
          <p className="text-lg font-medium">Cargando tipos de contenido...</p>
          <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
            Preparando configuración de servicios
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {configs.map((config, configIndex) => (
          <motion.div
            key={configIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: configIndex * 0.1 }}
            className={cn(
              "p-6 sm:p-8 rounded-2xl border shadow-lg backdrop-blur-sm transition-all",
              theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-white/50 border-gray-200'
            )}
          >
            {/* Service Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={cn("font-bold text-xl mb-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  <Package className="w-6 h-6 inline mr-2" />
                  {config.serviceName}
                </h3>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Precio unitario: ${config.basePrice.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-lg font-semibold", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  {getTotalBoxes(config)} {getTotalBoxes(config) === 1 ? 'caja' : 'cajas'}
                </p>
              </div>
            </div>

            {/* Boxes List */}
            <div className="space-y-4">
              <AnimatePresence>
                {config.boxes.map((box, boxIndex) => (
                  <motion.div
                    key={boxIndex}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "p-5 rounded-xl border-2",
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-600'
                        : 'bg-gray-50/50 border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className={cn("font-semibold", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Caja #{boxIndex + 1}
                      </h4>
                      {config.boxes.length > 1 && (
                        <Button
                          onClick={() => removeBox(configIndex, boxIndex)}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "text-red-600 hover:text-red-700 hover:bg-red-100",
                            theme === 'dark' && 'hover:bg-red-900/30'
                          )}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {config.requiresBoxCode && (
                        <div className="sm:col-span-2">
                          <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            <Scan className="w-4 h-4 inline mr-1" />
                            Código de Caja *
                          </label>
                          <div className="relative">
                            <Input
                              value={box.boxCode}
                              onChange={(e) => updateBox(configIndex, boxIndex, 'boxCode', e.target.value)}
                              placeholder="Escanear código (ej: EMPMEDMIAMI5875673)..."
                              className={cn(
                                "rounded-xl pr-10",
                                theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300',
                                box.validationStatus === 'valid' && 'border-green-500 focus:border-green-500',
                                box.validationStatus === 'invalid' && 'border-red-500 focus:border-red-500'
                              )}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {box.validationStatus === 'validating' && (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                              )}
                              {box.validationStatus === 'valid' && (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              )}
                              {box.validationStatus === 'invalid' && (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              )}
                            </div>
                          </div>
                          {box.validationMessage && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "text-xs mt-1",
                                box.validationStatus === 'valid' ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              {box.validationMessage}
                            </motion.p>
                          )}
                        </div>
                      )}

                      {config.requiresWeight && (
                        <div>
                          <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            <Weight className="w-4 h-4 inline mr-1" />
                            Peso (lb) *
                          </label>
                          <Input
                            type="text"
                            value={box.weight}
                            onChange={(e) => {
                              const value = e.target.value
                              // Permitir vacío o solo números con punto decimal
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                updateBox(configIndex, boxIndex, 'weight', value)
                              }
                            }}
                            placeholder="Ingrese peso en libras"
                            className={cn(
                              "rounded-xl",
                              theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300',
                              box.weight && parseFloat(box.weight) > 0 && 'border-green-500 focus:border-green-500',
                              box.weight && (parseFloat(box.weight) <= 0 || isNaN(parseFloat(box.weight))) && 'border-red-500 focus:border-red-500'
                            )}
                          />
                          {box.weight && (parseFloat(box.weight) <= 0 || isNaN(parseFloat(box.weight))) && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-red-600 mt-1"
                            >
                              El peso debe ser mayor a 0
                            </motion.p>
                          )}
                          {box.weight && parseFloat(box.weight) > 0 && !isNaN(parseFloat(box.weight)) && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-green-600 mt-1"
                            >
                              ✓ Peso válido
                            </motion.p>
                          )}
                        </div>
                      )}

                      {config.requiresContentType && (
                        <div className="sm:col-span-2">
                          <label className={cn("block text-sm font-medium mb-3", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            <Box className="w-4 h-4 inline mr-1" />
                            Tipos de Contenido * (selecciona uno o más)
                          </label>
                          {loadingContentTypes ? (
                            <div className="flex flex-col items-center justify-center py-8">
                              <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
                              <span className={cn(
                                "text-sm font-medium",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                Cargando tipos de contenido...
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {contentTypes.map((ct) => {
                              const isSelected = isContentTypeSelected(box, ct.id.toString())
                              return (
                                <motion.button
                                  key={ct.id}
                                  type="button"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => toggleContentType(configIndex, boxIndex, ct.id.toString())}
                                  className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border-2",
                                    "flex items-center gap-2",
                                    isSelected
                                      ? theme === 'dark'
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-400/30'
                                      : theme === 'dark'
                                        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
                                  )}
                                >
                                  <span>{ct.icon}</span>
                                  <span>{ct.name}</span>
                                  {isSelected && (
                                    <motion.span
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    >
                                      <Check className="w-4 h-4" />
                                    </motion.span>
                                  )}
                                </motion.button>
                              )
                            })}
                            </div>
                          )}
                          {!loadingContentTypes && box.contentTypeIds.length > 0 && (
                            <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              {box.contentTypeIds.length} {box.contentTypeIds.length === 1 ? 'tipo seleccionado' : 'tipos seleccionados'}
                            </p>
                          )}
                        </div>
                      )}

                      {config.requiresDimensions && (
                        <div className="sm:col-span-2">
                          <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                            <Ruler className="w-4 h-4 inline mr-1" />
                            Dimensiones (pulgadas)
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            <Input
                              type="number"
                              step="0.1"
                              value={box.dimensions.length}
                              onChange={(e) => updateBox(configIndex, boxIndex, 'dimensions.length', e.target.value)}
                              placeholder="Largo"
                              className={cn(
                                "rounded-xl",
                                theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                              )}
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={box.dimensions.width}
                              onChange={(e) => updateBox(configIndex, boxIndex, 'dimensions.width', e.target.value)}
                              placeholder="Ancho"
                              className={cn(
                                "rounded-xl",
                                theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                              )}
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={box.dimensions.height}
                              onChange={(e) => updateBox(configIndex, boxIndex, 'dimensions.height', e.target.value)}
                              placeholder="Alto"
                              className={cn(
                                "rounded-xl",
                                theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add Box Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4"
            >
              <Button
                onClick={() => addBox(configIndex)}
                className={cn(
                  "w-full py-3 rounded-xl font-medium transition-all",
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                )}
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar Otra Caja
              </Button>
            </motion.div>
          </motion.div>
        ))}
        </div>
      )}
    </div>
  )
}
