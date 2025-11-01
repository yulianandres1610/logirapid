'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package, DollarSign, Calculator, Plus, Minus } from 'lucide-react'

interface BoxQuotationProps {
  onQuotationChange: (quotation: BoxQuotation) => void
  initialQuotation?: BoxQuotation
  theme?: string
}

export interface BoxQuotation {
  boxCount: number
  boxPrice: number
  boxSubtotal: number
  additionalServices: Array<{
    name: string
    price: number
    quantity: number
    subtotal: number
  }>
  subtotal: number
  taxAmount: number
  totalAmount: number
}

const BOX_PRICES = {
  small: 45,
  medium: 55,
  large: 65,
  extra_large: 75
}

const ADDITIONAL_SERVICES = [
  { name: 'Embalaje Especial', price: 5 },
  { name: 'Seguro Adicional', price: 10 },
  { name: 'Manejo Especial', price: 15 },
  { name: 'Entrega Express', price: 20 }
]

export default function BoxQuotation({ onQuotationChange, initialQuotation, theme = 'light' }: BoxQuotationProps) {
  const [boxSize, setBoxSize] = useState<keyof typeof BOX_PRICES>('medium')
  const [boxCount, setBoxCount] = useState(initialQuotation?.boxCount || 1)
  const [selectedServices, setSelectedServices] = useState<number[]>(
    initialQuotation?.additionalServices?.map((_, index) => index) || []
  )

  const calculateQuotation = (): BoxQuotation => {
    const boxPrice = BOX_PRICES[boxSize]
    const boxSubtotal = boxPrice * boxCount

    const additionalServices = selectedServices.map(serviceIndex => {
      const service = ADDITIONAL_SERVICES[serviceIndex]
      return {
        name: service.name,
        price: service.price,
        quantity: boxCount,
        subtotal: service.price * boxCount
      }
    })

    const additionalServicesTotal = additionalServices.reduce((total, service) => total + service.subtotal, 0)
    const subtotal = boxSubtotal + additionalServicesTotal
    const taxAmount = subtotal * 0.07 // 7% tax
    const totalAmount = subtotal + taxAmount

    return {
      boxCount,
      boxPrice,
      boxSubtotal,
      additionalServices,
      subtotal,
      taxAmount,
      totalAmount
    }
  }

  const updateQuotation = () => {
    const quotation = calculateQuotation()
    onQuotationChange(quotation)
  }

  const toggleService = (serviceIndex: number) => {
    setSelectedServices(prev => {
      const newServices = prev.includes(serviceIndex)
        ? prev.filter(i => i !== serviceIndex)
        : [...prev, serviceIndex]

      // Calcular cotización después de actualizar servicios
      setTimeout(() => {
        const boxPrice = BOX_PRICES[boxSize]
        const boxSubtotal = boxPrice * boxCount

        const additionalServices = newServices.map(index => {
          const service = ADDITIONAL_SERVICES[index]
          return {
            name: service.name,
            price: service.price,
            quantity: boxCount,
            subtotal: service.price * boxCount
          }
        })

        const additionalServicesTotal = additionalServices.reduce((total, service) => total + service.subtotal, 0)
        const subtotal = boxSubtotal + additionalServicesTotal
        const taxAmount = subtotal * 0.07
        const totalAmount = subtotal + taxAmount

        onQuotationChange({
          boxCount,
          boxPrice,
          boxSubtotal,
          additionalServices,
          subtotal,
          taxAmount,
          totalAmount
        })
      }, 0)

      return newServices
    })
  }

  const updateBoxCount = (change: number) => {
    const newCount = Math.max(1, Math.min(10, boxCount + change))
    setBoxCount(newCount)
    setTimeout(updateQuotation, 0)
  }

  const updateBoxSize = (size: keyof typeof BOX_PRICES) => {
    setBoxSize(size)
    setTimeout(updateQuotation, 0)
  }

  const quotation = calculateQuotation()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-6 rounded-xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Cotización de Cajas
        </h2>
      </div>

      {/* Box Size Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Tamaño de Caja
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(BOX_PRICES).map(([size, price]) => (
            <button
              key={size}
              onClick={() => updateBoxSize(size as keyof typeof BOX_PRICES)}
              className={cn(
                'p-3 rounded-lg border transition-all',
                'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                boxSize === size
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600'
              )}
            >
              <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {size.replace('_', ' ')}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ${price}/caja
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Box Count */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Cantidad de Cajas
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => updateBoxCount(-1)}
            className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {boxCount}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {boxCount === 1 ? 'caja' : 'cajas'}
            </div>
          </div>
          <button
            onClick={() => updateBoxCount(1)}
            className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Additional Services */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Servicios Adicionales
        </label>
        <div className="space-y-2">
          {ADDITIONAL_SERVICES.map((service, index) => (
            <label
              key={index}
              className={cn(
                'flex items-center p-3 rounded-lg border cursor-pointer transition-all',
                'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                selectedServices.includes(index)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600'
              )}
            >
              <input
                type="checkbox"
                checked={selectedServices.includes(index)}
                onChange={() => toggleService(index)}
                className="mr-3 text-blue-500 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {service.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ${service.price} por caja
                </div>
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                ${(service.price * boxCount).toFixed(2)}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Quotation Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3 mb-4">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Resumen de Cotización
          </h3>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {boxCount} {boxCount === 1 ? 'caja' : 'cajas'} ({boxSize.replace('_', ' ')})
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${quotation.boxSubtotal.toFixed(2)}
            </span>
          </div>

          {quotation.additionalServices.map((service, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {service.name} x{boxCount}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${service.subtotal.toFixed(2)}
              </span>
            </div>
          ))}

          <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
            <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${quotation.subtotal.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Impuesto (7%):</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${quotation.taxAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
            <span className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Total:
            </span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              ${quotation.totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}