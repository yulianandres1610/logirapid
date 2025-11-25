'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Truck, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext?: () => void
}

export default function OrderTypeSelectionStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()

  // Validate on mount and when orderType changes
  useEffect(() => {
    const hasOrderType = wizardData.orderType !== null && wizardData.orderType !== undefined
    setCanProceed(hasOrderType)
  }, [wizardData.orderType, setCanProceed])

  const handleSelect = (type: 'recogida' | 'retorno') => {
    updateWizardData('orderType', type)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className={cn(
          'text-2xl sm:text-3xl font-bold mb-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Tipo de Orden
        </h2>
        <p className={cn(
          'text-sm sm:text-base',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Selecciona el tipo de servicio que deseas realizar
        </p>
      </div>

      {/* Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Entrega y Recogida */}
        <motion.button
          type="button"
          onClick={() => handleSelect('recogida')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'p-8 rounded-2xl border-2 transition-all duration-200',
            'flex flex-col items-center gap-4 text-center',
            wizardData.orderType === 'recogida'
              ? theme === 'dark'
                ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-500/10'
              : theme === 'dark'
              ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
              : 'bg-white border-gray-200 hover:border-gray-300'
          )}
        >
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center',
            wizardData.orderType === 'recogida'
              ? theme === 'dark'
                ? 'bg-blue-500/30'
                : 'bg-blue-100'
              : theme === 'dark'
              ? 'bg-gray-700'
              : 'bg-gray-100'
          )}>
            <Truck className={cn(
              'w-10 h-10',
              wizardData.orderType === 'recogida'
                ? theme === 'dark'
                  ? 'text-blue-400'
                  : 'text-blue-600'
                : theme === 'dark'
                ? 'text-gray-400'
                : 'text-gray-600'
            )} />
          </div>

          <div>
            <h3 className={cn(
              'text-xl font-bold mb-2',
              wizardData.orderType === 'recogida'
                ? theme === 'dark'
                  ? 'text-blue-400'
                  : 'text-blue-700'
                : theme === 'dark'
                ? 'text-white'
                : 'text-gray-900'
            )}>
              Entrega y Recogida
            </h3>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Entregar y recoger paquetes del cliente
            </p>
          </div>

          <div className={cn(
            'mt-2 px-4 py-2 rounded-lg text-sm',
            wizardData.orderType === 'recogida'
              ? theme === 'dark'
                ? 'bg-blue-900/30 text-blue-300'
                : 'bg-blue-100 text-blue-700'
              : theme === 'dark'
              ? 'bg-gray-700 text-gray-400'
              : 'bg-gray-100 text-gray-600'
          )}>
            Incluye: Servicios, Configuración y Pago
          </div>
        </motion.button>

        {/* Retorno de Cajas */}
        <motion.button
          type="button"
          onClick={() => handleSelect('retorno')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'p-8 rounded-2xl border-2 transition-all duration-200',
            'flex flex-col items-center gap-4 text-center',
            wizardData.orderType === 'retorno'
              ? theme === 'dark'
                ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                : 'bg-purple-50 border-purple-500 shadow-lg shadow-purple-500/10'
              : theme === 'dark'
              ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
              : 'bg-white border-gray-200 hover:border-gray-300'
          )}
        >
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center',
            wizardData.orderType === 'retorno'
              ? theme === 'dark'
                ? 'bg-purple-500/30'
                : 'bg-purple-100'
              : theme === 'dark'
              ? 'bg-gray-700'
              : 'bg-gray-100'
          )}>
            <RotateCcw className={cn(
              'w-10 h-10',
              wizardData.orderType === 'retorno'
                ? theme === 'dark'
                  ? 'text-purple-400'
                  : 'text-purple-600'
                : theme === 'dark'
                ? 'text-gray-400'
                : 'text-gray-600'
            )} />
          </div>

          <div>
            <h3 className={cn(
              'text-xl font-bold mb-2',
              wizardData.orderType === 'retorno'
                ? theme === 'dark'
                  ? 'text-purple-400'
                  : 'text-purple-700'
                : theme === 'dark'
                ? 'text-white'
                : 'text-gray-900'
            )}>
              Retorno de Cajas
            </h3>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Recoger cajas llenas previamente entregadas
            </p>
          </div>

          <div className={cn(
            'mt-2 px-4 py-2 rounded-lg text-sm',
            wizardData.orderType === 'retorno'
              ? theme === 'dark'
                ? 'bg-purple-900/30 text-purple-300'
                : 'bg-purple-100 text-purple-700'
              : theme === 'dark'
              ? 'bg-gray-700 text-gray-400'
              : 'bg-gray-100 text-gray-600'
          )}>
            Basado en entrega previa
          </div>
        </motion.button>
      </div>

      {/* Info Message */}
      {wizardData.orderType && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-xl border',
            wizardData.orderType === 'recogida'
              ? theme === 'dark'
                ? 'bg-blue-900/20 border-blue-500/30'
                : 'bg-blue-50 border-blue-200'
              : theme === 'dark'
              ? 'bg-purple-900/20 border-purple-500/30'
              : 'bg-purple-50 border-purple-200'
          )}
        >
          <p className={cn(
            'text-sm text-center',
            wizardData.orderType === 'recogida'
              ? theme === 'dark'
                ? 'text-blue-300'
                : 'text-blue-700'
              : theme === 'dark'
              ? 'text-purple-300'
              : 'text-purple-700'
          )}>
            {wizardData.orderType === 'recogida' ? (
              <>
                <strong>Entrega y Recogida:</strong> Completa todos los pasos para programar la entrega y recogida de paquetes del cliente
              </>
            ) : (
              <>
                <strong>Retorno de Cajas:</strong> Busca la entrega previa por teléfono y selecciona las cajas a recoger
              </>
            )}
          </p>
        </motion.div>
      )}
    </div>
  )
}
