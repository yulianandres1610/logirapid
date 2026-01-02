'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  LogOut,
  Loader2,
  Check,
  Clock
} from 'lucide-react'

interface Payroll {
  id: number
  periodStart: string
  periodEnd: string
  payDate: string | null
  basePay: number
  hoursWorked: number | null
  daysWorked: number | null
  salesTotal: number
  commissionAmount: number
  bonusAmount: number
  bonusDescription: string | null
  deductions: number
  grossPay: number
  netPay: number
  currency: string
  status: string
  paidAt: string | null
}

interface Totals {
  totalPaid: number
  totalPending: number
  totalCommissions: number
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada'
}

export default function EmployeePayrollPage() {
  const router = useRouter()
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)

  useEffect(() => {
    fetchPayrolls()
  }, [])

  const fetchPayrolls = async () => {
    try {
      const response = await fetch('/api/employee/payroll')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPayrolls(result.data.payrolls)
          setTotals(result.data.totals)
        }
      } else if (response.status === 401) {
        router.push('/employee/login')
      }
    } catch (error) {
      console.error('Error fetching payrolls:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/employee/auth/logout', { method: 'POST' })
    router.push('/employee/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/employee/dashboard"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              <h1 className="font-bold text-gray-900 dark:text-white">Mis Nóminas</h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        {totals && (
          <div className="grid grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Pagado</span>
              </div>
              <p className="text-2xl font-bold text-green-600">${totals.totalPaid.toLocaleString()}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Pendiente</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">${totals.totalPending.toLocaleString()}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Comisiones</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">${totals.totalCommissions.toLocaleString()}</p>
            </motion.div>
          </div>
        )}

        {/* Payroll List */}
        {payrolls.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sin nóminas registradas
            </h3>
            <p className="text-gray-500">
              Tus nóminas aparecerán aquí cuando sean procesadas
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payrolls.map((payroll, idx) => (
              <motion.div
                key={payroll.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedPayroll(payroll)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {new Date(payroll.periodStart).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} - {new Date(payroll.periodEnd).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[payroll.status]}`}>
                          {statusLabels[payroll.status]}
                        </span>
                        {payroll.paidAt && (
                          <span className="text-xs text-gray-500">
                            Pagado el {new Date(payroll.paidAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${payroll.netPay.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">{payroll.currency}</p>
                  </div>
                </div>

                {(payroll.commissionAmount > 0 || payroll.bonusAmount > 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Base: </span>
                      <span className="font-medium text-gray-900 dark:text-white">${payroll.basePay.toLocaleString()}</span>
                    </div>
                    {payroll.commissionAmount > 0 && (
                      <div>
                        <span className="text-gray-500">Comisión: </span>
                        <span className="font-medium text-green-600">${payroll.commissionAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {payroll.bonusAmount > 0 && (
                      <div>
                        <span className="text-gray-500">Bono: </span>
                        <span className="font-medium text-blue-600">${payroll.bonusAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Payroll Detail Modal */}
        {selectedPayroll && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Detalle de Nómina
                </h2>
                <button
                  onClick={() => setSelectedPayroll(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-purple-600">
                    ${selectedPayroll.netPay.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Neto a Pagar</p>
                  <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${statusColors[selectedPayroll.status]}`}>
                    {statusLabels[selectedPayroll.status]}
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Período</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedPayroll.periodStart).toLocaleDateString()} - {new Date(selectedPayroll.periodEnd).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Pago Base</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${selectedPayroll.basePay.toLocaleString()}
                    </span>
                  </div>
                  {selectedPayroll.salesTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Ventas del período</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${selectedPayroll.salesTotal.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayroll.commissionAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Comisión</span>
                      <span className="font-medium text-green-600">
                        +${selectedPayroll.commissionAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayroll.bonusAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Bono {selectedPayroll.bonusDescription && `(${selectedPayroll.bonusDescription})`}</span>
                      <span className="font-medium text-blue-600">
                        +${selectedPayroll.bonusAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPayroll.deductions > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Deducciones</span>
                      <span className="font-medium text-red-600">
                        -${selectedPayroll.deductions.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Bruto</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ${selectedPayroll.grossPay.toLocaleString()}
                    </span>
                  </div>
                </div>

                {selectedPayroll.paidAt && (
                  <p className="text-center text-sm text-green-600">
                    <Check className="w-4 h-4 inline mr-1" />
                    Pagado el {new Date(selectedPayroll.paidAt).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  )
}
