'use client'

import React, { useState, useEffect } from 'react'
import { Search, Package, MapPin, Weight, User, FileText, Loader2 } from 'lucide-react'

interface InventarioBultosTabProps {
  warehouse: any
}

interface Bulto {
  id: number
  codigo: string
  order_number: string | null
  service_name: string | null
  recipient_name: string | null
  recipient_city: string | null
  recipient_state: string | null
  weight_lb: number | null
  weight_kg: number | null
  estado: string
  tipo: string | null
  box_number: number | null
  total_boxes: number | null
}

export default function InventarioBultosTab({ warehouse }: InventarioBultosTabProps) {
  const [bultos, setBultos] = useState<Bulto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Cargar bultos del warehouse
  useEffect(() => {
    const fetchBultos = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/empaques?warehouseId=${warehouse.id}&limit=1000`)
        if (response.ok) {
          const data = await response.json()
          setBultos(data.empaques || [])
        }
      } catch (error) {
        console.error('Error fetching bultos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBultos()
  }, [warehouse.id])

  // Filtrar bultos por búsqueda
  const filteredBultos = bultos.filter(bulto => {
    const search = searchTerm.toLowerCase()
    return (
      bulto.codigo?.toLowerCase().includes(search) ||
      bulto.order_number?.toLowerCase().includes(search) ||
      bulto.recipient_name?.toLowerCase().includes(search) ||
      bulto.recipient_city?.toLowerCase().includes(search) ||
      bulto.recipient_state?.toLowerCase().includes(search) ||
      bulto.service_name?.toLowerCase().includes(search) ||
      bulto.estado?.toLowerCase().includes(search)
    )
  })

  // Badge de estado
  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      disponible: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', label: 'Disponible' },
      recogida: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', label: 'Recogida' },
      en_almacen: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-200', label: 'En Almacén' },
      en_transito: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-200', label: 'En Tránsito' },
      entregado: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-200', label: 'Entregado' }
    }

    const badge = badges[estado] || { bg: 'bg-gray-100', text: 'text-gray-800', label: estado }

    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Inventario de Bultos
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Todos los bultos en {warehouse.name}
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Bultos</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{bultos.length}</p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Package className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-green-200 dark:border-green-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">En Almacén</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                {bultos.filter(b => b.estado === 'en_almacen').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-yellow-200 dark:border-yellow-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">En Tránsito</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                {bultos.filter(b => b.estado === 'en_transito').length}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Package className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-blue-200 dark:border-blue-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Recogidos</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                {bultos.filter(b => b.estado === 'recogida').length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, orden, destinatario, ciudad, estado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#cc0a46] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredBultos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No se encontraron bultos con ese criterio de búsqueda' : 'No hay bultos en este almacén'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Destinatario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Destino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Peso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredBultos.map((bulto) => (
                  <tr key={bulto.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                          {bulto.codigo}
                        </span>
                      </div>
                      {bulto.box_number && bulto.total_boxes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Caja {bulto.box_number} de {bulto.total_boxes}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {bulto.order_number || (
                          <span className="text-gray-400 italic">Sin orden</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {bulto.service_name || (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {bulto.recipient_name || (
                              <span className="text-gray-400 italic">Sin destinatario</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {bulto.recipient_city && bulto.recipient_state ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <p>{bulto.recipient_city}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{bulto.recipient_state}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bulto.weight_lb && bulto.weight_kg ? (
                        <div className="flex items-start gap-2">
                          <Weight className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <p>{bulto.weight_lb} lb</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{bulto.weight_kg} kg</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEstadoBadge(bulto.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && filteredBultos.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Mostrando {filteredBultos.length} de {bultos.length} bultos
        </div>
      )}
    </div>
  )
}
