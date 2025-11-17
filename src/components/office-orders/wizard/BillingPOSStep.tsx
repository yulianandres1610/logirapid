'use client'

import React, { useState, useEffect } from 'react'
import { DollarSign, CreditCard, Banknote, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { motion } from 'framer-motion'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function BillingPOSStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [payments, setPayments] = useState<any[]>(wizardData.payments || [])
  const [totalAmount, setTotalAmount] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [newPayment, setNewPayment] = useState({
    method: 'cash',
    amount: 0,
    reference: '',
    cashReceived: 0
  })

  useEffect(() => {
    // Calcular total: basePrice × cantidad de cajas por cada servicio
    const total = wizardData.serviceConfigs.reduce((sum: number, config: any) => {
      const boxCount = config.boxes?.length || 0
      const serviceTotal = config.basePrice * boxCount
      return sum + serviceTotal
    }, 0)
    setTotalAmount(total)
    updateWizardData('totalAmount', total)
  }, [])

  useEffect(() => {
    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
    setPaidAmount(paid)
    setCanProceed(paid >= totalAmount)
    updateWizardData('payments', payments)
  }, [payments, totalAmount])

  const addPayment = () => {
    if (newPayment.amount <= 0) {
      alert('Ingrese un monto válido')
      return
    }

    const remaining = totalAmount - paidAmount
    if (newPayment.amount > remaining) {
      alert(`El monto no puede exceder el restante: $${remaining.toFixed(2)}`)
      return
    }

    setPayments([...payments, { ...newPayment }])
    setNewPayment({
      method: 'cash',
      amount: 0,
      reference: '',
      cashReceived: 0
    })
  }

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index))
  }

  const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: Banknote },
    { value: 'zelle', label: 'Zelle', icon: DollarSign },
    { value: 'card', label: 'Tarjeta', icon: CreditCard }
  ]

  const remaining = totalAmount - paidAmount

  return (
    <div className="space-y-8">
      {/* Centered Icon Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br shadow-2xl",
            theme === 'dark'
              ? 'from-emerald-600 to-emerald-700 shadow-emerald-500/30'
              : 'from-emerald-500 to-emerald-600 shadow-emerald-400/30'
          )}
        >
          <DollarSign className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h2 className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Facturación POS
          </h2>
          <p className={cn("text-base", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Procesar el pago de la orden
          </p>
        </div>
      </div>

      {/* Service Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "p-6 rounded-2xl shadow-lg backdrop-blur-sm border",
          theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
        )}
      >
        <h3 className={cn("font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Desglose de Servicios
        </h3>
        <div className="space-y-3">
          {wizardData.serviceConfigs.map((config: any, index: number) => {
            const boxCount = config.boxes?.length || 0
            const serviceTotal = config.basePrice * boxCount
            return (
              <div
                key={index}
                className={cn(
                  "p-4 rounded-xl border",
                  theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-300'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {config.serviceName}
                    </p>
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {boxCount} {boxCount === 1 ? 'caja' : 'cajas'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      ${config.basePrice.toFixed(2)} × {boxCount}
                    </p>
                    <p className="font-bold text-lg text-green-600">
                      ${serviceTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Total Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn(
          "p-6 rounded-2xl shadow-lg backdrop-blur-sm border-2",
          theme === 'dark' ? 'bg-gray-800/50 border-blue-600' : 'bg-white/80 border-blue-400'
        )}
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={cn("text-sm mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Total</p>
            <p className="text-2xl font-bold text-blue-600">${totalAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className={cn("text-sm mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Pagado</p>
            <p className="text-2xl font-bold text-green-600">${paidAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className={cn("text-sm mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Restante</p>
            <p className={cn(
              "text-2xl font-bold",
              remaining > 0 ? 'text-red-600' : 'text-green-600'
            )}>
              ${remaining.toFixed(2)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Add Payment Form */}
      {remaining > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "p-6 rounded-2xl border shadow-lg backdrop-blur-sm",
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
          )}
        >
          <h3 className={cn("font-semibold mb-4", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Agregar Pago
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn("block text-sm mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Método de Pago
              </label>
              <select
                value={newPayment.method}
                onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border shadow-sm transition-all duration-200",
                  theme === 'dark' ? 'bg-gray-700 text-white border-gray-600 hover:border-gray-500' : 'bg-white border-gray-300 hover:border-gray-400'
                )}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={cn("block text-sm mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Monto
              </label>
              <Input
                type="number"
                step="0.01"
                value={newPayment.amount || ''}
                onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className={cn(
                  "rounded-xl shadow-sm",
                  theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'
                )}
              />
            </div>
            {newPayment.method === 'zelle' && (
              <div className="col-span-2">
                <label className={cn("block text-sm mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Referencia Zelle
                </label>
                <Input
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                  placeholder="Número de confirmación"
                  className={cn(
                    "rounded-xl shadow-sm",
                    theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'
                  )}
                />
              </div>
            )}
            {newPayment.method === 'cash' && (
              <div className="col-span-2">
                <label className={cn("block text-sm mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Efectivo Recibido
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPayment.cashReceived || ''}
                  onChange={(e) => setNewPayment({ ...newPayment, cashReceived: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className={cn(
                    "rounded-xl shadow-sm",
                    theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'
                  )}
                />
                {newPayment.cashReceived > newPayment.amount && (
                  <p className="text-sm text-green-600 mt-1">
                    Cambio: ${(newPayment.cashReceived - newPayment.amount).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
          <Button
            onClick={addPayment}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Agregar Pago
          </Button>
        </motion.div>
      )}

      {/* Payments List */}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h3 className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Pagos Registrados
          </h3>
          {payments.map((payment, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl shadow-md backdrop-blur-sm border",
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'
              )}
            >
              <div className="flex items-center gap-3">
                {paymentMethods.find(m => m.value === payment.method)?.icon && (
                  React.createElement(
                    paymentMethods.find(m => m.value === payment.method)!.icon,
                    { className: 'w-5 h-5 text-green-600' }
                  )
                )}
                <div>
                  <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {paymentMethods.find(m => m.value === payment.method)?.label}
                  </p>
                  {payment.reference && (
                    <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Ref: {payment.reference}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-green-600">${payment.amount.toFixed(2)}</span>
                <Button
                  onClick={() => removePayment(index)}
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
