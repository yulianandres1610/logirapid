'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Route, Truck, User, MapPin, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface RouteWaypointsCardProps {
  route: {
    routeNumber: string
    name: string
    driverName?: string
    vehiclePlate?: string
    status: string
    stops: any[]
  } | null
  currentOrderId: number
}

export default function RouteWaypointsCard({ route, currentOrderId }: RouteWaypointsCardProps) {
  const { theme } = useTheme()

  if (!route) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cn(
          'rounded-2xl border p-6 shadow-lg',
          theme === 'dark'
            ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
            : 'bg-white border-gray-200'
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              'bg-gradient-to-br',
              theme === 'dark'
                ? 'from-gray-600 to-gray-700'
                : 'from-gray-400 to-gray-500'
            )}
          >
            <Route className="w-6 h-6 text-white" />
          </div>
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Ruta Asignada
          </h3>
        </div>

        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Esta orden aún no ha sido asignada a ninguna ruta
        </p>
      </motion.div>
    )
  }

  // Encontrar el índice de la orden actual en los stops
  const currentStopIndex = route.stops.findIndex((stop: any) =>
    stop.orderId === currentOrderId || stop.orderIds?.includes(currentOrderId)
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
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
            'bg-gradient-to-br from-purple-600 to-purple-700'
          )}
        >
          <Route className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Ruta Asignada
          </h3>
          <p className={cn(
            'text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {route.routeNumber}
          </p>
        </div>
      </div>

      {/* Route Info */}
      <div className="space-y-3 mb-6">
        {route.driverName && (
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-purple-50'
          )}>
            <User className={cn(
              'w-4 h-4',
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            )} />
            <div className="flex-1">
              <p className={cn(
                'text-xs font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Conductor
              </p>
              <p className={cn(
                'text-sm font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {route.driverName}
              </p>
            </div>
          </div>
        )}

        {route.vehiclePlate && (
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-purple-50'
          )}>
            <Truck className={cn(
              'w-4 h-4',
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            )} />
            <div className="flex-1">
              <p className={cn(
                'text-xs font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Vehículo
              </p>
              <p className={cn(
                'text-sm font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {route.vehiclePlate}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Waypoints Timeline */}
      {route.stops && route.stops.length > 0 && (
        <div>
          <h4 className={cn(
            'text-sm font-semibold mb-3',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Secuencia de Paradas ({route.stops.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {route.stops.map((stop: any, index: number) => {
              const isCurrentOrder = stop.orderId === currentOrderId || stop.orderIds?.includes(currentOrderId)
              const isDelivered = stop.status === 'delivered'

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg transition-all',
                    isCurrentOrder && (
                      theme === 'dark'
                        ? 'bg-purple-900/30 border-l-4 border-purple-500'
                        : 'bg-purple-50 border-l-4 border-purple-500'
                    ),
                    !isCurrentOrder && (
                      theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
                    )
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isDelivered ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className={cn(
                        'w-5 h-5',
                        isCurrentOrder
                          ? 'text-purple-500'
                          : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-xs font-bold',
                        isCurrentOrder
                          ? theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                          : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        #{index + 1}
                      </span>
                      {isCurrentOrder && (
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-semibold',
                          'bg-purple-500 text-white'
                        )}>
                          Esta Orden
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-sm font-medium truncate',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stop.customerName || stop.address}
                    </p>
                    {stop.address && stop.customerName && (
                      <p className={cn(
                        'text-xs truncate',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        {stop.address}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
