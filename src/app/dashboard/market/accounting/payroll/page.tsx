'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  Plus,
  Filter,
  Calendar,
  Check,
  X,
  DollarSign,
  Clock,
  Calculator
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Payroll {
  id: number
  employeeId: number
  employeeCode: string
  employeeName: string
  payType: string
  periodStart: string
  periodEnd: string
  payDate: string | null
  basePay: number
  hoursWorked: number | null
  daysWorked: number | null
  salesTotal: number
  commissionAmount: number
  bonusAmount: number
  deductions: number
  grossPay: number
  netPay: number
  currency: string
  status: string
}

interface Employee {
  id: number
  employeeCode: string
  fullName: string
  payType: string
  payRate: number
  commissionRate: number
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
  cancelled: 'Cancelada'
}

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [summary, setSummary] = useState<{
    pendingCount: number
    pendingTotal: number
    paidTotal: number
  }>({ pendingCount: 0, pendingTotal: 0, paidTotal: 0 })

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    periodStart: '',
    periodEnd: '',
    hoursWorked: '',
    daysWorked: '',
    bonusAmount: '',
    bonusDescription: '',
    deductions: ''
  })
  const [calculation, setCalculation] = useState<{
    basePay: number
    commissionAmount: number
    grossPay: number
    netPay: number
    salesTotal: number
  } | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
    fetchEmployees()
  }, [statusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/market/accounting/payroll?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPayrolls(result.data.payrolls)
          setSummary(result.data.summary)
        }
      }
    } catch (error) {
      console.error('Error fetching payroll:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/market/accounting/employees?status=active')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployees(result.data.employees)
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const calculatePayroll = async () => {
    if (!formData.employeeId || !formData.periodStart || !formData.periodEnd) return

    setCalculating(true)
    try {
      const response = await fetch('/api/market/accounting/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(formData.employeeId),
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          hoursWorked: formData.hoursWorked ? parseFloat(formData.hoursWorked) : undefined,
          daysWorked: formData.daysWorked ? parseInt(formData.daysWorked) : undefined
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const calc = result.data.calculation
          const bonus = parseFloat(formData.bonusAmount) || 0
          const deductions = parseFloat(formData.deductions) || 0
          setCalculation({
            basePay: calc.basePay,
            commissionAmount: calc.commissionAmount,
            salesTotal: calc.salesTotal,
            grossPay: calc.basePay + calc.commissionAmount + bonus,
            netPay: calc.basePay + calc.commissionAmount + bonus - deductions
          })
        }
      }
    } catch (error) {
      console.error('Error calculating:', error)
    } finally {
      setCalculating(false)
    }
  }

  const savePayroll = async () => {
    if (!calculation) return

    setSaving(true)
    try {
      const response = await fetch('/api/market/accounting/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(formData.employeeId),
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          basePay: calculation.basePay,
          hoursWorked: formData.hoursWorked ? parseFloat(formData.hoursWorked) : null,
          daysWorked: formData.daysWorked ? parseInt(formData.daysWorked) : null,
          salesTotal: calculation.salesTotal,
          commissionAmount: calculation.commissionAmount,
          bonusAmount: parseFloat(formData.bonusAmount) || 0,
          bonusDescription: formData.bonusDescription || null,
          deductions: parseFloat(formData.deductions) || 0
        })
      })

      if (response.ok) {
        setShowModal(false)
        setFormData({
          employeeId: '',
          periodStart: '',
          periodEnd: '',
          hoursWorked: '',
          daysWorked: '',
          bonusAmount: '',
          bonusDescription: '',
          deductions: ''
        })
        setCalculation(null)
        fetchData()
      }
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const updatePayrollStatus = async (id: number, action: 'approve' | 'pay') => {
    try {
      const response = await fetch('/api/market/accounting/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Error updating:', error)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Wallet className="w-8 h-8 text-purple-600" />
                Nómina
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {summary.pendingCount} pendientes • ${summary.pendingTotal.toLocaleString()} por pagar
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nueva Nómina
            </button>
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
              <p className="text-2xl font-bold text-amber-600">{summary.pendingCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pendientes</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <p className="text-2xl font-bold text-blue-600">${summary.pendingTotal.toLocaleString()}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Por Pagar</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-2xl font-bold text-green-600">${summary.paidTotal.toLocaleString()}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pagado</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="paid">Pagadas</option>
            </select>
          </div>

          {/* Payroll List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : payrolls.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay nóminas
              </h3>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Crear Nómina
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {payrolls.map((payroll) => (
                <motion.div
                  key={payroll.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {payroll.employeeName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {payroll.employeeCode} • {new Date(payroll.periodStart).toLocaleDateString()} - {new Date(payroll.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${payroll.netPay.toLocaleString()}
                      </p>
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[payroll.status]}`}>
                        {statusLabels[payroll.status]}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Base: </span>
                        <span className="font-medium text-gray-900 dark:text-white">${payroll.basePay.toLocaleString()}</span>
                      </div>
                      {payroll.commissionAmount > 0 && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Comisión: </span>
                          <span className="font-medium text-green-600">${payroll.commissionAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {payroll.bonusAmount > 0 && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Bono: </span>
                          <span className="font-medium text-blue-600">${payroll.bonusAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    {payroll.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updatePayrollStatus(payroll.id, 'approve')}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => updatePayrollStatus(payroll.id, 'pay')}
                          className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium"
                        >
                          Marcar Pagada
                        </button>
                      </div>
                    )}
                    {payroll.status === 'approved' && (
                      <button
                        onClick={() => updatePayrollStatus(payroll.id, 'pay')}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                      >
                        Marcar Pagada
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* New Payroll Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Nómina</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Empleado *
                    </label>
                    <select
                      value={formData.employeeId}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                    >
                      <option value="">Seleccionar empleado</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Inicio Período *
                      </label>
                      <input
                        type="date"
                        value={formData.periodStart}
                        onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Fin Período *
                      </label>
                      <input
                        type="date"
                        value={formData.periodEnd}
                        onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Horas Trabajadas
                      </label>
                      <input
                        type="number"
                        value={formData.hoursWorked}
                        onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: e.target.value }))}
                        placeholder="Auto"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Días Trabajados
                      </label>
                      <input
                        type="number"
                        value={formData.daysWorked}
                        onChange={(e) => setFormData(prev => ({ ...prev, daysWorked: e.target.value }))}
                        placeholder="Auto"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bono
                      </label>
                      <input
                        type="number"
                        value={formData.bonusAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, bonusAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Deducciones
                      </label>
                      <input
                        type="number"
                        value={formData.deductions}
                        onChange={(e) => setFormData(prev => ({ ...prev, deductions: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>

                  <button
                    onClick={calculatePayroll}
                    disabled={calculating || !formData.employeeId || !formData.periodStart || !formData.periodEnd}
                    className="w-full py-2.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Calculator className="w-5 h-5" />
                    {calculating ? 'Calculando...' : 'Calcular Nómina'}
                  </button>

                  {calculation && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Pago Base:</span>
                        <span className="font-medium">${calculation.basePay.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Comisión (ventas: ${calculation.salesTotal.toLocaleString()}):</span>
                        <span className="font-medium text-green-600">${calculation.commissionAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="font-medium">Total Bruto:</span>
                        <span className="font-bold">${calculation.grossPay.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span>Neto a Pagar:</span>
                        <span className="text-purple-600">${calculation.netPay.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={savePayroll}
                    disabled={saving || !calculation}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Crear Nómina'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
