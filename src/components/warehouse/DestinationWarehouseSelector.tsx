'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Warehouse, ChevronDown, Loader2, MapPin, History } from 'lucide-react'

interface WarehouseOption {
  id: number
  code: string
  name: string
  warehouseType: string
  isCentral: boolean
  address: string | null
  city: string | null
  state: string | null
  displayName: string
}

export interface SelectedWarehouse {
  id: number
  name: string
  code: string
}

interface DestinationWarehouseSelectorProps {
  currentWarehouseId: number
  selectedWarehouseId: number | null
  onSelect: (warehouseId: number | null, warehouse: SelectedWarehouse | null) => void
  disabled?: boolean
  onViewHistory?: () => void
}

export default function DestinationWarehouseSelector({
  currentWarehouseId,
  selectedWarehouseId,
  onSelect,
  disabled = false,
  onViewHistory
}: DestinationWarehouseSelectorProps) {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/market/warehouses/available?excludeId=${currentWarehouseId}`)
        const data = await response.json()

        if (data.success) {
          setWarehouses(data.data)
        } else {
          setError(data.error || 'Error al cargar almacenes')
        }
      } catch {
        setError('Error de conexion')
      } finally {
        setLoading(false)
      }
    }

    fetchWarehouses()
  }, [currentWarehouseId])

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-300">Cargando almacenes...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-center">
        {error}
      </div>
    )
  }

  if (warehouses.length === 0) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 text-center">
        No hay otros almacenes disponibles para transferir
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-3 p-4
          bg-white dark:bg-gray-800
          border-2 rounded-xl
          transition-all
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-300 dark:border-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            p-2 rounded-lg
            ${selectedWarehouse ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}
          `}>
            <Warehouse className={`w-5 h-5 ${selectedWarehouse ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>

          {selectedWarehouse ? (
            <div className="text-left">
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedWarehouse.displayName}
              </p>
              {selectedWarehouse.city && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedWarehouse.city}
                </p>
              )}
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              Seleccionar almacen destino...
            </span>
          )}
        </div>

        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className="flex items-center justify-between mt-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Almacen de Destino
        </label>
        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Ver historial
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Options */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {warehouses.map((warehouse) => (
              <button
                key={warehouse.id}
                onClick={() => {
                  onSelect(warehouse.id, {
                    id: warehouse.id,
                    name: warehouse.name,
                    code: warehouse.code
                  })
                  setIsOpen(false)
                }}
                className={`
                  w-full flex items-center gap-3 p-3
                  hover:bg-gray-50 dark:hover:bg-gray-700
                  transition-colors
                  ${selectedWarehouseId === warehouse.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                `}
              >
                <div className={`
                  p-2 rounded-lg
                  ${warehouse.isCentral ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'}
                `}>
                  <Warehouse className={`w-4 h-4 ${warehouse.isCentral ? 'text-amber-600' : 'text-gray-500'}`} />
                </div>

                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {warehouse.displayName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {warehouse.code}
                    {warehouse.city && ` - ${warehouse.city}`}
                  </p>
                </div>

                {selectedWarehouseId === warehouse.id && (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  )
}
