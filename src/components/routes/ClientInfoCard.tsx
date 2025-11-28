'use client'

import { useState } from 'react'
import {
  User,
  Phone,
  MapPin,
  Edit2,
  Save,
  X,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface ClientData {
  name: string
  phone?: string
  address: string
  customerId?: number
}

interface ClientInfoCardProps {
  clientData: ClientData
  orderId: number
  onUpdate: () => void
}

export default function ClientInfoCard({
  clientData,
  orderId,
  onUpdate
}: ClientInfoCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: clientData.name,
    phone: clientData.phone || ''
  })

  const { user } = useAuth()
  const companyId = user?.companyId

  const handleSave = async () => {
    setLoading(true)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (companyId) {
        headers['x-company-id'] = companyId
      }

      const response = await fetch(`/api/package-orders/${orderId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          customername: formData.name,
          phone: formData.phone
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al actualizar')
      }

      setIsEditing(false)
      onUpdate()

    } catch (err) {
      console.error('Error updating client info:', err)
      alert(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: clientData.name,
      phone: clientData.phone || ''
    })
    setIsEditing(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {isEditing ? (
        // Modo edición
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del Cliente
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (XXX) XXX-XXXX"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
        </div>
      ) : (
        // Modo visualización
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
              <User className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-lg">{clientData.name}</span>
              {clientData.customerId && (
                <a
                  href={`/dashboard/admin/crm/customers/${clientData.customerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Ver ficha del cliente"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {clientData.phone && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone className="w-4 h-4" />
                <a
                  href={`tel:${clientData.phone}`}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {clientData.phone}
                </a>
              </div>
            )}

            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{clientData.address}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Editar información"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
