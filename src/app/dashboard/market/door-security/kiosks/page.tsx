'use client'

import { useEffect, useState } from 'react'
import {
  Monitor,
  Plus,
  MapPin,
  Users,
  Settings,
  Trash2,
  Edit2,
  Shield,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  UserPlus,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Kiosk {
  id: number
  name: string
  location: string | null
  deviceId: string
  warehouseId: number | null
  warehouseName: string | null
  isActive: boolean
  lastPing: string | null
  activeVisitors: number
  todayVisitors: number
  createdAt: string
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  employeeCode: string
  position: string
  hasPin: boolean
}

interface Guard {
  id: number
  employeeId: number
  employeeName: string
  employeeCode: string
  kioskId: number | null
  kioskName: string
  isActive: boolean
}

export default function DoorKiosksPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showGuardModal, setShowGuardModal] = useState(false)
  const [selectedKiosk, setSelectedKiosk] = useState<Kiosk | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)
  const [selectedGuardIds, setSelectedGuardIds] = useState<number[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchKiosks()
    fetchGuards()
    fetchEmployees()
  }, [])

  const fetchKiosks = async () => {
    try {
      const res = await fetch('/api/market/door-security/kiosks')
      const data = await res.json()
      if (data.success) {
        setKiosks(data.data.kiosks)
      }
    } catch (error) {
      console.error('Error fetching kiosks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGuards = async () => {
    try {
      const res = await fetch('/api/market/door-security/guards')
      const data = await res.json()
      if (data.success) {
        setGuards(data.data.guards)
      }
    } catch (error) {
      console.error('Error fetching guards:', error)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/market/hr/employees?limit=100')
      const data = await res.json()
      if (data.success) {
        setEmployees(data.data.employees.filter((e: any) => e.status === 'active'))
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const createKiosk = async () => {
    if (!formName.trim()) return

    try {
      const res = await fetch('/api/market/door-security/kiosks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          location: formLocation || null
        })
      })

      const data = await res.json()
      if (data.success) {
        const newKiosk = data.data

        // Add selected guards
        if (selectedGuardIds.length > 0) {
          for (const employeeId of selectedGuardIds) {
            await fetch('/api/market/door-security/guards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId,
                kioskId: newKiosk.id
              })
            })
          }
          await fetchGuards()
        }

        setKiosks([newKiosk, ...kiosks])
        setShowCreateModal(false)
        setFormName('')
        setFormLocation('')
        setSelectedGuardIds([])
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error creating kiosk:', error)
    }
  }

  const updateKiosk = async () => {
    if (!selectedKiosk || !formName.trim()) return

    try {
      const res = await fetch(`/api/market/door-security/kiosks/${selectedKiosk.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          location: formLocation || null
        })
      })

      const data = await res.json()
      if (data.success) {
        setKiosks(kiosks.map(k =>
          k.id === selectedKiosk.id
            ? { ...k, name: formName, location: formLocation || null }
            : k
        ))
        setShowEditModal(false)
        setSelectedKiosk(null)
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error updating kiosk:', error)
    }
  }

  const toggleKioskStatus = async (kiosk: Kiosk) => {
    try {
      const res = await fetch(`/api/market/door-security/kiosks/${kiosk.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !kiosk.isActive })
      })

      const data = await res.json()
      if (data.success) {
        setKiosks(kiosks.map(k =>
          k.id === kiosk.id ? { ...k, isActive: !kiosk.isActive } : k
        ))
      }
    } catch (error) {
      console.error('Error toggling kiosk:', error)
    }
  }

  const deleteKiosk = async (kiosk: Kiosk) => {
    if (!confirm(`¿Eliminar el kiosk "${kiosk.name}"?`)) return

    try {
      const res = await fetch(`/api/market/door-security/kiosks/${kiosk.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        setKiosks(kiosks.filter(k => k.id !== kiosk.id))
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting kiosk:', error)
    }
  }

  const addGuard = async () => {
    if (!selectedEmployeeId || !selectedKiosk) return

    try {
      const res = await fetch('/api/market/door-security/guards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          kioskId: selectedKiosk.id
        })
      })

      const data = await res.json()
      if (data.success) {
        await fetchGuards()
        setSelectedEmployeeId(null)
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error adding guard:', error)
    }
  }

  const removeGuard = async (guardId: number) => {
    if (!confirm('¿Eliminar este guardia?')) return

    try {
      const res = await fetch(`/api/market/door-security/guards?id=${guardId}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        setGuards(guards.filter(g => g.id !== guardId))
      }
    } catch (error) {
      console.error('Error removing guard:', error)
    }
  }

  const openEditModal = (kiosk: Kiosk) => {
    setSelectedKiosk(kiosk)
    setFormName(kiosk.name)
    setFormLocation(kiosk.location || '')
    setShowEditModal(true)
  }

  const openGuardModal = (kiosk: Kiosk) => {
    setSelectedKiosk(kiosk)
    setShowGuardModal(true)
  }

  const filteredKiosks = kiosks.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.location?.toLowerCase().includes(search.toLowerCase())
  )

  const kioskGuards = (kioskId: number) =>
    guards.filter(g => g.kioskId === kioskId || g.kioskId === null)

  const getKioskUrl = (deviceId: string) => {
    // Use the current host to build the door-kiosk URL
    if (typeof window !== 'undefined') {
      const host = window.location.host
      return `${window.location.protocol}//${host}/door-kiosk/${deviceId}`
    }
    return `/door-kiosk/${deviceId}`
  }

  const copyKioskUrl = async (deviceId: string) => {
    const url = getKioskUrl(deviceId)
    await navigator.clipboard.writeText(url)
    setCopiedId(deviceId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openKioskUI = (deviceId: string) => {
    const url = getKioskUrl(deviceId)
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kiosks de Puerta</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestionar dispositivos de control de acceso</p>
        </div>
        <button
          onClick={() => {
            setFormName('')
            setFormLocation('')
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          Nuevo Kiosk
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar kiosks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      {/* Kiosks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredKiosks.map(kiosk => (
          <div
            key={kiosk.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    kiosk.isActive ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Monitor className={`w-6 h-6 ${
                      kiosk.isActive ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{kiosk.name}</h3>
                    {kiosk.location && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {kiosk.location}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  kiosk.isActive
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {kiosk.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Hoy</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{kiosk.todayVisitors}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Adentro</p>
                  <p className="text-lg font-bold text-green-600">{kiosk.activeVisitors}</p>
                </div>
              </div>

              {/* Kiosk URL Access */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">URL del Kiosk:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-gray-600 dark:text-gray-300 truncate">
                    /door-kiosk/{kiosk.deviceId}
                  </code>
                  <button
                    onClick={() => copyKioskUrl(kiosk.deviceId)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    title="Copiar URL"
                  >
                    {copiedId === kiosk.deviceId ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openKioskUI(kiosk.deviceId)}
                    className="p-1.5 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded"
                    title="Abrir Kiosk"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Guards */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Guardias asignados:</p>
                <div className="flex flex-wrap gap-1">
                  {kioskGuards(kiosk.id).length > 0 ? (
                    kioskGuards(kiosk.id).slice(0, 3).map(guard => (
                      <span
                        key={guard.id}
                        className="px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs"
                      >
                        {guard.employeeName.split(' ')[0]}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Sin guardias</span>
                  )}
                  {kioskGuards(kiosk.id).length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                      +{kioskGuards(kiosk.id).length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(kiosk)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openGuardModal(kiosk)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="Gestionar guardias"
                >
                  <Shield className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteKiosk(kiosk)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => toggleKioskStatus(kiosk)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  kiosk.isActive
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                }`}
              >
                {kiosk.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredKiosks.length === 0 && (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No hay kiosks configurados</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
          >
            Crear primer kiosk
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md m-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Nuevo Kiosk de Puerta</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Puerta Principal"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ubicación (opcional)
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Ej: Entrada Norte"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              {/* Guard selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Guardias (opcional)
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Selecciona los empleados que pueden usar este kiosk
                </p>
                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                  {employees.map(e => (
                    <label
                      key={e.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGuardIds.includes(e.id)}
                        onChange={(ev) => {
                          if (ev.target.checked) {
                            setSelectedGuardIds([...selectedGuardIds, e.id])
                          } else {
                            setSelectedGuardIds(selectedGuardIds.filter(id => id !== e.id))
                          }
                        }}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {e.firstName} {e.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{e.employeeCode}</p>
                      </div>
                      {e.hasPin && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                          PIN
                        </span>
                      )}
                    </label>
                  ))}
                  {employees.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                      No hay empleados disponibles
                    </p>
                  )}
                </div>
                {selectedGuardIds.length > 0 && (
                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                    {selectedGuardIds.length} guardia{selectedGuardIds.length > 1 ? 's' : ''} seleccionado{selectedGuardIds.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSelectedGuardIds([])
                }}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={createKiosk}
                disabled={!formName.trim()}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Crear Kiosk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedKiosk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md m-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Editar Kiosk</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedKiosk(null)
                }}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={updateKiosk}
                disabled={!formName.trim()}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guard Management Modal */}
      {showGuardModal && selectedKiosk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg m-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Gestionar Guardias
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {selectedKiosk.name}
            </p>

            {/* Current Guards */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Guardias asignados:</h3>
              <div className="space-y-2">
                {kioskGuards(selectedKiosk.id).length > 0 ? (
                  kioskGuards(selectedKiosk.id).map(guard => (
                    <div
                      key={guard.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{guard.employeeName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{guard.employeeCode}</p>
                      </div>
                      <button
                        onClick={() => removeGuard(guard.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No hay guardias asignados</p>
                )}
              </div>
            </div>

            {/* Add Guard */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Agregar guardia:</h3>
              <div className="flex gap-2">
                <select
                  value={selectedEmployeeId || ''}
                  onChange={(e) => setSelectedEmployeeId(parseInt(e.target.value) || null)}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccionar empleado...</option>
                  {employees
                    .filter(e => !guards.some(g =>
                      g.employeeId === e.id &&
                      (g.kioskId === selectedKiosk.id || g.kioskId === null)
                    ))
                    .map(e => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.employeeCode})
                      </option>
                    ))
                  }
                </select>
                <button
                  onClick={addGuard}
                  disabled={!selectedEmployeeId}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                * Los empleados deben tener un PIN configurado
              </p>
            </div>

            <button
              onClick={() => {
                setShowGuardModal(false)
                setSelectedKiosk(null)
                setSelectedEmployeeId(null)
              }}
              className="w-full mt-6 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
