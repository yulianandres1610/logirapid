'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Search,
  X
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Department {
  id: number
  name: string
  code: string | null
  description: string | null
  managerId: number | null
  managerName: string | null
  employeeCount: number
  isActive: boolean
  createdAt: string
}

interface Employee {
  id: number
  employeeCode: string
  fullName: string
  status: string
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [search, setSearch] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    managerId: ''
  })

  useEffect(() => {
    fetchDepartments()
    fetchEmployees()
  }, [])

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/market/hr/departments?status=all')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDepartments(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
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
          setEmployees(result.data.employees.map((e: any) => ({
            id: e.id,
            employeeCode: e.employeeCode,
            fullName: e.fullName,
            status: e.status
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingDepartment
        ? `/api/market/hr/departments/${editingDepartment.id}`
        : '/api/market/hr/departments'

      const response = await fetch(url, {
        method: editingDepartment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code || null,
          description: formData.description || null,
          managerId: formData.managerId ? parseInt(formData.managerId) : null
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowModal(false)
          setEditingDepartment(null)
          setFormData({ name: '', code: '', description: '', managerId: '' })
          fetchDepartments()
        }
      }
    } catch (error) {
      console.error('Error saving department:', error)
    }
  }

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept)
    setFormData({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
      managerId: dept.managerId?.toString() || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de desactivar este departamento?')) return

    try {
      const response = await fetch(`/api/market/hr/departments/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchDepartments()
      }
    } catch (error) {
      console.error('Error deleting department:', error)
    }
  }

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.code && d.code.toLowerCase().includes(search.toLowerCase()))
  )

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
                <Building2 className="w-8 h-8 text-purple-600" />
                Departamentos
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {departments.length} departamentos registrados
              </p>
            </div>
            <button
              onClick={() => {
                setEditingDepartment(null)
                setFormData({ name: '', code: '', description: '', managerId: '' })
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Departamento
            </button>
          </motion.div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar departamento..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Departments List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredDepartments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
            >
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay departamentos
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crea el primer departamento para organizar tu equipo
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map((dept, idx) => (
                <motion.div
                  key={dept.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow ${!dept.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {dept.name}
                        </h3>
                        {dept.code && (
                          <span className="text-sm text-gray-500">{dept.code}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      {dept.isActive && (
                        <button
                          onClick={() => handleDelete(dept.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {dept.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {dept.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>{dept.employeeCount} empleados</span>
                    </div>
                    {dept.managerName && (
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        {dept.managerName}
                      </span>
                    )}
                  </div>

                  {!dept.isActive && (
                    <div className="mt-3 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-center text-sm text-gray-500">
                      Inactivo
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingDepartment ? 'Editar Departamento' : 'Nuevo Departamento'}
                    </h2>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                      placeholder="Ej: Ventas, Administración"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Código
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                      placeholder="Ej: SALES, ADMIN"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                      placeholder="Descripción del departamento..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Manager
                    </label>
                    <select
                      value={formData.managerId}
                      onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Sin asignar</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                    >
                      {editingDepartment ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
