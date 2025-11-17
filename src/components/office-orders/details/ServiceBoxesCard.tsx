'use client'

import React, { useState } from 'react'
import { Package, ChevronDown, ChevronUp, Weight, Ruler, Tag, Clock, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Box {
  boxCode: string
  weight: string
  dimensions?: {
    length: string
    width: string
    height: string
  }
  contentTypeIds?: string[]
  contentTypes?: string[]
}

interface ServiceBoxesCardProps {
  serviceName: string
  servicePrice: number
  boxes: Box[]
  serviceIndex: number
  labels?: any[]
  trazabilidadMap?: Map<number, any[]>
}

export default function ServiceBoxesCard({
  serviceName,
  servicePrice,
  boxes,
  serviceIndex,
  labels = [],
  trazabilidadMap = new Map()
}: ServiceBoxesCardProps) {
  const { theme } = useTheme()
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedTrazabilidad, setExpandedTrazabilidad] = useState<Set<string>>(new Set())

  const formatDimensions = (dimensions?: { length: string; width: string; height: string }) => {
    if (!dimensions) return 'N/A'
    return `${dimensions.length}" × ${dimensions.width}" × ${dimensions.height}"`
  }

  const toggleTrazabilidad = (boxCode: string) => {
    const newSet = new Set(expandedTrazabilidad)
    if (newSet.has(boxCode)) {
      newSet.delete(boxCode)
    } else {
      newSet.add(boxCode)
    }
    setExpandedTrazabilidad(newSet)
  }

  const getEmpaqueIdForBox = (boxCode: string): number | null => {
    const label = labels.find(l => l.boxCode === boxCode)
    return label?.empaqueId || null
  }

  const getTrazabilidadForBox = (boxCode: string): any[] => {
    const empaqueId = getEmpaqueIdForBox(boxCode)
    if (!empaqueId) return []
    return trazabilidadMap.get(empaqueId) || []
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const serviceColors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600'
  ]

  const colorGradient = serviceColors[serviceIndex % serviceColors.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      {/* Service Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full p-5 flex items-center justify-between transition-colors',
          theme === 'dark'
            ? 'hover:bg-gray-700/50'
            : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
            `bg-gradient-to-br ${colorGradient}`
          )}>
            <Package className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <h4 className={cn(
              'text-lg font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {serviceName}
            </h4>
            <p className={cn(
              'text-sm mt-1',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              {boxes.length} {boxes.length === 1 ? 'caja' : 'cajas'} • ${servicePrice.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'px-3 py-1 rounded-full text-sm font-semibold',
            theme === 'dark'
              ? 'bg-blue-900/30 text-blue-400'
              : 'bg-blue-100 text-blue-600'
          )}>
            {boxes.length}
          </span>
          {isExpanded ? (
            <ChevronUp className={cn(
              'w-5 h-5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )} />
          ) : (
            <ChevronDown className={cn(
              'w-5 h-5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )} />
          )}
        </div>
      </button>

      {/* Boxes List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              {boxes.map((box, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'p-5',
                    index !== boxes.length - 1 && 'border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      theme === 'dark'
                        ? 'bg-gray-700'
                        : 'bg-gray-100'
                    )}>
                      <span className={cn(
                        'text-sm font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {index + 1}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* Box Code */}
                      <div className="flex items-center gap-2">
                        <Tag className={cn(
                          'w-4 h-4',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )} />
                        <span className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Código:
                        </span>
                        <code className={cn(
                          'px-2 py-1 rounded text-sm font-mono',
                          theme === 'dark'
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-100 text-gray-900'
                        )}>
                          {box.boxCode}
                        </code>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Weight */}
                        <div className="flex items-center gap-2">
                          <Weight className={cn(
                            'w-4 h-4',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Peso:
                          </span>
                          <span className={cn(
                            'text-sm font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {box.weight} lb
                          </span>
                        </div>

                        {/* Dimensions */}
                        {box.dimensions && (
                          <div className="flex items-center gap-2">
                            <Ruler className={cn(
                              'w-4 h-4',
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )} />
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              Dimensiones:
                            </span>
                            <span className={cn(
                              'text-sm font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatDimensions(box.dimensions)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content Types */}
                      {box.contentTypes && box.contentTypes.length > 0 && (
                        <div>
                          <span className={cn(
                            'text-sm font-medium block mb-2',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Contenido:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {box.contentTypes.map((content, idx) => (
                              <span
                                key={idx}
                                className={cn(
                                  'px-2 py-1 rounded-full text-xs font-medium',
                                  theme === 'dark'
                                    ? 'bg-purple-900/30 text-purple-400'
                                    : 'bg-purple-100 text-purple-700'
                                )}
                              >
                                {content}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Trazabilidad Section */}
                      {(() => {
                        const trazabilidad = getTrazabilidadForBox(box.boxCode)
                        if (trazabilidad.length === 0) return null

                        const isExpanded = expandedTrazabilidad.has(box.boxCode)

                        return (
                          <div className={cn(
                            'mt-4 pt-4 border-t',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <button
                              onClick={() => toggleTrazabilidad(box.boxCode)}
                              className={cn(
                                'flex items-center justify-between w-full text-left',
                                'hover:opacity-80 transition-opacity'
                              )}
                            >
                              <span className={cn(
                                'text-sm font-medium flex items-center gap-2',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                <Clock className="w-4 h-4" />
                                Trazabilidad ({trazabilidad.length} eventos)
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden mt-3"
                                >
                                  <div className="space-y-3">
                                    {trazabilidad.map((evento: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className={cn(
                                          'flex gap-3 text-xs',
                                          idx !== trazabilidad.length - 1 && 'pb-3 border-b',
                                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                        )}
                                      >
                                        <div className={cn(
                                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                                          theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'
                                        )} />
                                        <div className="flex-1 space-y-1">
                                          <div className="flex items-center justify-between">
                                            <span className={cn(
                                              'font-semibold',
                                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            )}>
                                              {evento.accion?.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                            <span className={cn(
                                              'text-xs',
                                              theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                                            )}>
                                              {formatDate(evento.fecha)}
                                            </span>
                                          </div>
                                          {evento.warehouse_name && (
                                            <div className={cn(
                                              'flex items-center gap-1',
                                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                            )}>
                                              <MapPin className="w-3 h-3" />
                                              <span>{evento.warehouse_name}</span>
                                            </div>
                                          )}
                                          {evento.notas && (
                                            <p className={cn(
                                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                            )}>
                                              {evento.notas}
                                            </p>
                                          )}
                                          {evento.usuario_nombre && (
                                            <p className={cn(
                                              'text-xs',
                                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                            )}>
                                              Usuario: {evento.usuario_nombre}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
