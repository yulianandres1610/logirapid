'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FileText,
  ArrowLeft,
  Save,
  User,
  Building2,
  Clock,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Employee {
  id: number
  employeeCode: string
  fullName: string
  status: string
}

interface Department {
  id: number
  name: string
  code: string | null
}

interface Schedule {
  id: number
  name: string
  weeklyHours: number
}

export default function CreateContractPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    employeeId: '',
    contractType: 'indefinido',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    payType: 'monthly',
    payRate: '',
    currency: 'USD',
    commissionRate: '0',
    departmentId: '',
    scheduleId: '',
    position: '',
    notes: ''
  })

  useEffect(() => {
    fetchData()
    if (editId) {
      fetchContract(editId)
    }
  }, [editId])

  const fetchData = async () => {
    try {
      // Fetch employees
      const empRes = await fetch('/api/market/accounting/employees?status=active')
      if (empRes.ok) {
        const data = await empRes.json()
        if (data.success) {
          setEmployees(data.data.employees.map((e: any) => ({
            id: e.id,
            employeeCode: e.employeeCode,
            fullName: e.fullName,
            status: e.status
          })))
        }
      }

      // Fetch departments
      const deptRes = await fetch('/api/market/hr/departments?status=active')
      if (deptRes.ok) {
        const data = await deptRes.json()
        if (data.success) {
          setDepartments(data.data)
        }
      }

      // Fetch schedules
      const schedRes = await fetch('/api/market/hr/schedules?status=active')
      if (schedRes.ok) {
        const data = await schedRes.json()
        if (data.success) {
          setSchedules(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchContract = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/market/hr/contracts/${id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const c = result.data
          setFormData({
            employeeId: c.employeeId.toString(),
            contractType: c.contractType,
            startDate: c.startDate?.split('T')[0] || '',
            endDate: c.endDate?.split('T')[0] || '',
            payType: c.payType,
            payRate: c.payRate.toString(),
            currency: c.currency,
            commissionRate: c.commissionRate.toString(),
            departmentId: c.departmentId?.toString() || '',
            scheduleId: c.scheduleId?.toString() || '',
            position: c.position || '',
            notes: c.notes || ''
          })
        }
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSaving(true)

      const url = editId
        ? `/api/market/hr/contracts/${editId}`
        : '/api/market/hr/contracts'

      const response = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: parseInt(formData.employeeId),
          contractType: formData.contractType,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          payType: formData.payType,
          payRate: parseFloat(formData.payRate),
          currency: formData.currency,
          commissionRate: parseFloat(formData.commissionRate) || 0,
          departmentId: formData.departmentId ? parseInt(formData.departmentId) : null,
          scheduleId: formData.scheduleId ? parseInt(formData.scheduleId) : null,
          position: formData.position || null,
          notes: formData.notes || null
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          router.push('/dashboard/market/hr/contracts')
        }
      }
    } catch (error) {
      console.error('Error saving contract:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Link
              href="/dashboard/market/hr/contracts"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Contratos
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FileText className="w-8 h-8 text-amber-600" />
              {editId ? 'Editar Contrato' : 'Nuevo Contrato'}
            </h1>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6"
          >
            {/* Employee Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <User className="w-4 h-4" />
                Empleado *
              </label>
              <select
                required
                disabled={!!editId}
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
              >
                <option value="">Seleccionar empleado</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Contract Type & Position */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Contrato *
                </label>
                <select
                  required
                  value={formData.contractType}
                  onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="indefinido">Indefinido</option>
                  <option value="temporal">Temporal</option>
                  <option value="por_obra">Por Obra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cargo / Posición
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                  placeholder="Ej: Vendedor, Cajero"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fecha de Fin
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">Dejar vacío para contrato indefinido</p>
              </div>
            </div>

            {/* Compensation */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl space-y-4">
              <h3 className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                <DollarSign className="w-5 h-5 text-amber-600" />
                Compensación
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de Pago *
                  </label>
                  <select
                    required
                    value={formData.payType}
                    onChange={(e) => setFormData({ ...formData, payType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="hourly">Por Hora</option>
                    <option value="daily">Por Día</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Salario *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.payRate}
                    onChange={(e) => setFormData({ ...formData, payRate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Moneda
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="USD">USD</option>
                    <option value="CUP">CUP</option>
                    <option value="MLC">MLC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comisión (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Department & Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Building2 className="w-4 h-4" />
                  Departamento
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Sin asignar</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {dept.code && `(${dept.code})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="w-4 h-4" />
                  Horario
                </label>
                <select
                  value={formData.scheduleId}
                  onChange={(e) => setFormData({ ...formData, scheduleId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Sin asignar</option>
                  {schedules.map(sched => (
                    <option key={sched.id} value={sched.id}>
                      {sched.name} ({sched.weeklyHours}h/semana)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notas
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-amber-500"
                placeholder="Notas adicionales sobre el contrato..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/dashboard/market/hr/contracts"
                className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {editId ? 'Guardar Cambios' : 'Crear Contrato'}
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
