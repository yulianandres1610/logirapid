'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  DollarSign,
  Calendar,
  Building2,
  Clock,
  User
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Contract {
  id: number
  employeeId: number
  employeeName: string
  employeeCode: string
  contractNumber: string
  contractType: string
  startDate: string
  endDate: string | null
  payType: string
  payRate: number
  currency: string
  commissionRate: number
  departmentId: number | null
  departmentName: string | null
  scheduleId: number | null
  scheduleName: string | null
  position: string | null
  status: string
  createdAt: string
}

const contractTypeLabels: Record<string, string> = {
  indefinido: 'Indefinido',
  temporal: 'Temporal',
  por_obra: 'Por Obra'
}

const payTypeLabels: Record<string, string> = {
  hourly: 'Por Hora',
  daily: 'Por Día',
  monthly: 'Mensual'
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  terminated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  on_leave: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetchContracts()
  }, [statusFilter])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ status: statusFilter })
      const response = await fetch(`/api/market/hr/contracts?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setContracts(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const viewContract = async (id: number) => {
    try {
      const response = await fetch(`/api/market/hr/contracts/${id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSelectedContract(result.data)
          setShowDetails(true)
        }
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
    }
  }

  const filteredContracts = contracts.filter(c =>
    c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
    (c.position && c.position.toLowerCase().includes(search.toLowerCase()))
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
                <FileText className="w-8 h-8 text-amber-600" />
                Contratos Laborales
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {contracts.length} contratos {statusFilter === 'active' ? 'activos' : 'totales'}
              </p>
            </div>
            <Link
              href="/dashboard/market/hr/contracts/create"
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Contrato
            </Link>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por empleado, número de contrato..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500"
              >
                <option value="active">Activos</option>
                <option value="terminated">Terminados</option>
                <option value="on_leave">En Licencia</option>
                <option value="all">Todos</option>
              </select>
            </div>
          </div>

          {/* Contracts List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredContracts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
            >
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay contratos
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Los contratos definen los términos laborales de cada empleado
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filteredContracts.map((contract, idx) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">
                          {contract.employeeName}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[contract.status]}`}>
                          {contract.status === 'active' ? 'Activo' : contract.status === 'terminated' ? 'Terminado' : 'Licencia'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {contract.contractNumber} • {contract.position || 'Sin cargo'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <DollarSign className="w-4 h-4" />
                          ${contract.payRate.toLocaleString()} {contract.currency}/{payTypeLabels[contract.payType]?.toLowerCase().replace('por ', '')}
                        </span>
                        {contract.commissionRate > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            {contract.commissionRate}% comisión
                          </span>
                        )}
                        {contract.departmentName && (
                          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Building2 className="w-4 h-4" />
                            {contract.departmentName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="hidden md:flex flex-col items-end gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Desde {new Date(contract.startDate).toLocaleDateString()}
                      </span>
                      <span className="text-xs">
                        {contractTypeLabels[contract.contractType]}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => viewContract(contract.id)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                      <Link
                        href={`/dashboard/market/hr/contracts/create?edit=${contract.id}`}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Details Modal */}
          {showDetails && selectedContract && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedContract.contractNumber}
                      </h2>
                      <p className="text-sm text-gray-500">{selectedContract.employeeName}</p>
                    </div>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Tipo de Contrato</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {contractTypeLabels[selectedContract.contractType]}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Cargo</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedContract.position || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Fecha de Inicio</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(selectedContract.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Fecha de Fin</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString() : 'Indefinido'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Tipo de Pago</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {payTypeLabels[selectedContract.payType]}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Salario</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        ${selectedContract.payRate.toLocaleString()} {selectedContract.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Comisión</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedContract.commissionRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[selectedContract.status]}`}>
                        {selectedContract.status === 'active' ? 'Activo' : selectedContract.status === 'terminated' ? 'Terminado' : 'Licencia'}
                      </span>
                    </div>
                  </div>

                  {(selectedContract.departmentName || selectedContract.scheduleName) && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-4">
                        {selectedContract.departmentName && (
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Building2 className="w-4 h-4" /> Departamento
                            </p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedContract.departmentName}
                            </p>
                          </div>
                        )}
                        {selectedContract.scheduleName && (
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="w-4 h-4" /> Horario
                            </p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedContract.scheduleName}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
