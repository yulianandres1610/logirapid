'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ChevronDown, ChevronRight, MapPin, Clock, User, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Empaque {
  id: number
  codigo: string
  warehouseName?: string
  estado: string
  weightLb?: number
  weightKg?: number
  boxNumber?: number
  totalBoxes?: number
  trazabilidad: Array<{
    accion: string
    fecha: string
    warehouse_name?: string
    notas?: string
    usuario_nombre?: string
  }>
}

interface PackageTrackingCardProps {
  empaques: Empaque[]
  totalWeightLb: number
}

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  asignado: { label: 'Asignado', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  recogida: { label: 'Recogido', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  en_almacen: { label: 'En Almacén', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  enviado: { label: 'Enviado', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  recibido_destino: { label: 'Recibido', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  en_reparto: { label: 'En Reparto', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

export default function PackageTrackingCard({ empaques, totalWeightLb }: PackageTrackingCardProps) {
  const { theme } = useTheme()
  const [expandedPackages, setExpandedPackages] = useState<Set<number>>(new Set())

  const togglePackage = (id: number) => {
    const newExpanded = new Set(expandedPackages)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedPackages(newExpanded)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-green-600 to-green-700'
          )}
        >
          <Package className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Empaques Asociados
          </h3>
          <p className={cn(
            'text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {empaques.length} {empaques.length === 1 ? 'empaque' : 'empaques'} • {totalWeightLb.toFixed(2)} lb
          </p>
        </div>
      </div>

      {empaques.length === 0 ? (
        <div className={cn(
          'p-6 rounded-xl text-center',
          theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
        )}>
          <Package className={cn(
            'w-12 h-12 mx-auto mb-3',
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          )} />
          <p className={cn(
            'text-sm font-medium mb-1',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Sin empaques asignados
          </p>
          <p className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
          )}>
            Los empaques se asignarán durante la recogida
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {empaques.map((empaque) => {
            const estadoConfig = ESTADO_CONFIG[empaque.estado] || ESTADO_CONFIG.disponible
            const isExpanded = expandedPackages.has(empaque.id)

            return (
              <div
                key={empaque.id}
                className={cn(
                  'rounded-xl border transition-all',
                  theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200',
                  isExpanded && (theme === 'dark' ? 'bg-gray-700/50' : 'bg-blue-50')
                )}
              >
                {/* Package Header */}
                <button
                  onClick={() => togglePackage(empaque.id)}
                  className="w-full p-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={cn(
                        'font-mono font-bold text-sm',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {empaque.codigo}
                      </p>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-semibold',
                        estadoConfig.color
                      )}>
                        {estadoConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {empaque.weightLb && (
                        <span className={cn(
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          {empaque.weightLb} lb ({empaque.weightKg?.toFixed(2)} kg)
                        </span>
                      )}
                      {empaque.boxNumber && empaque.totalBoxes && (
                        <span className={cn(
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Caja {empaque.boxNumber} de {empaque.totalBoxes}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Package Tracking Timeline */}
                <AnimatePresence>
                  {isExpanded && empaque.trazabilidad && empaque.trazabilidad.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        'px-4 pb-4 border-t',
                        theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                      )}>
                        <p className={cn(
                          'text-xs font-semibold mb-3 mt-3',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Trazabilidad
                        </p>
                        <div className="space-y-3">
                          {empaque.trazabilidad.map((evento, index) => (
                            <div
                              key={index}
                              className={cn(
                                'relative pl-6 pb-3',
                                index !== empaque.trazabilidad.length - 1 && 'border-l-2',
                                theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                              )}
                            >
                              <div
                                className={cn(
                                  'absolute left-0 top-0 w-2 h-2 rounded-full -translate-x-[5px]',
                                  theme === 'dark' ? 'bg-blue-500' : 'bg-blue-600'
                                )}
                              />
                              <div>
                                <p className={cn(
                                  'text-sm font-semibold',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {evento.accion.replace(/_/g, ' ')}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs">
                                  <span className={cn(
                                    'flex items-center gap-1',
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                  )}>
                                    <Clock className="w-3 h-3" />
                                    {formatDate(evento.fecha)}
                                  </span>
                                  {evento.warehouse_name && (
                                    <span className={cn(
                                      'flex items-center gap-1',
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    )}>
                                      <MapPin className="w-3 h-3" />
                                      {evento.warehouse_name}
                                    </span>
                                  )}
                                  {evento.usuario_nombre && (
                                    <span className={cn(
                                      'flex items-center gap-1',
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    )}>
                                      <User className="w-3 h-3" />
                                      {evento.usuario_nombre}
                                    </span>
                                  )}
                                </div>
                                {evento.notas && (
                                  <p className={cn(
                                    'text-xs mt-1 flex items-start gap-1',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                                  )}>
                                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    {evento.notas}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
