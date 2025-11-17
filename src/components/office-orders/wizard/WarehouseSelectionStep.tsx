'use client'

import React, { useState, useEffect } from 'react'
import { Warehouse, MapPin, Check, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function WarehouseSelectionStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<any | null>(wizardData.warehouse || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWarehouses()
  }, [])

  useEffect(() => {
    setCanProceed(selectedWarehouse !== null)
    updateWizardData('warehouse', selectedWarehouse)
  }, [selectedWarehouse])

  const fetchWarehouses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/warehouses?activeOnly=true')
      const data = await response.json()
      if (data.success) {
        setWarehouses(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectWarehouse = (warehouse: any) => {
    setSelectedWarehouse(warehouse)
  }

  return (
    <div className="space-y-8">
      {/* Centered Icon Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
            theme === 'dark'
              ? 'bg-gradient-to-br from-amber-600 to-amber-700 shadow-amber-500/30'
              : 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-400/30'
          )}
        >
          <Warehouse className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Seleccionar Almacén
          </h2>
          <p className={cn(
            "text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Elige el almacén desde donde se procesará esta orden
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Loader2 className={cn(
            "w-12 h-12 animate-spin mb-4",
            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
          )} />
          <p className={cn(
            "text-lg font-medium",
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Cargando almacenes...
          </p>
        </motion.div>
      ) : (
        <>
          {/* Warehouse Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((warehouse, index) => {
              const isSelected = selectedWarehouse?.id === warehouse.id
              return (
                <motion.div
                  key={warehouse.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectWarehouse(warehouse)}
                  className={cn(
                    "p-5 rounded-xl border cursor-pointer transition-all relative shadow-md",
                    isSelected
                      ? theme === 'dark'
                        ? 'bg-amber-900/30 border-amber-500 shadow-amber-500/30'
                        : 'bg-amber-50 border-amber-500 shadow-amber-400/30'
                      : theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 hover:border-amber-500/50'
                      : 'bg-white border-gray-200 hover:border-amber-400'
                  )}
                >
                  {/* Check Icon */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center",
                        theme === 'dark' ? 'bg-amber-500' : 'bg-amber-600'
                      )}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}

                  {/* Warehouse Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center mb-3",
                    theme === 'dark' ? 'bg-amber-600/20' : 'bg-amber-100'
                  )}>
                    <Warehouse className={cn(
                      "w-6 h-6",
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )} />
                  </div>

                  {/* Warehouse Info */}
                  <div className="space-y-2">
                    <h3 className={cn(
                      "font-bold text-lg",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {warehouse.name}
                    </h3>

                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-mono font-semibold",
                        theme === 'dark' ? 'bg-gray-700 text-amber-400' : 'bg-gray-100 text-amber-700'
                      )}>
                        {warehouse.code}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className={cn(
                        "w-4 h-4 mt-0.5 flex-shrink-0",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )} />
                      <div className={cn(
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        <div>{warehouse.city}, {warehouse.state}</div>
                        {warehouse.address && (
                          <div className="text-xs mt-0.5">{warehouse.address}</div>
                        )}
                      </div>
                    </div>

                    {warehouse.type && (
                      <div className={cn(
                        "inline-block px-2 py-1 rounded-full text-xs",
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      )}>
                        {warehouse.type}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* No Warehouses */}
          {warehouses.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "text-center py-12 px-4 rounded-xl border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}
            >
              <Warehouse className={cn(
                "w-16 h-16 mx-auto mb-4",
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
              <p className={cn(
                "text-lg font-medium mb-2",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                No hay almacenes disponibles
              </p>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                Contacta al administrador para configurar almacenes
              </p>
            </motion.div>
          )}

          {/* Selected Warehouse Summary */}
          {selectedWarehouse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-xl border",
                theme === 'dark' ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200'
              )}
            >
              <div className="flex items-center gap-3">
                <Check className={cn(
                  "w-6 h-6",
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                )} />
                <div>
                  <p className={cn(
                    "font-medium",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Almacén seleccionado: <span className="font-bold">{selectedWarehouse.name}</span>
                  </p>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Código: {selectedWarehouse.code} | {selectedWarehouse.city}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
