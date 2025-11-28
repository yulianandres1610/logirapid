'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import StopDetailPage from '@/components/routes/StopDetailPage'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface PageProps {
  params: Promise<{
    id: string
    stopNumber: string
  }>
}

export default function RouteStopDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const routeId = parseInt(resolvedParams.id)
  const stopNumber = parseInt(resolvedParams.stopNumber)

  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stopData, setStopData] = useState<any>(null)
  const [routeData, setRouteData] = useState<any>(null)

  const fetchStopData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const companyId = user?.companyId
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (companyId) {
        headers['x-company-id'] = companyId
      }

      const response = await fetch(`/api/routes/${routeId}/stops`, { headers })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar paradas')
      }

      // Encontrar la parada específica
      const stop = data.data.stops.find((s: any) => s.stopNumber === stopNumber)

      if (!stop) {
        throw new Error(`Parada #${stopNumber} no encontrada`)
      }

      setStopData(stop)
      setRouteData({
        routeId: data.data.routeId,
        routeNumber: data.data.routeNumber,
        status: data.data.status,
        driverName: data.data.driverName,
        vehiclePlate: data.data.vehiclePlate
      })

    } catch (err) {
      console.error('Error fetching stop data:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [routeId, stopNumber, user?.companyId])

  useEffect(() => {
    if (user) {
      fetchStopData()
    }
  }, [fetchStopData, user])

  const handleBack = () => {
    router.push(`/dashboard/admin/routes/${routeId}`)
  }

  const handleRefresh = () => {
    fetchStopData()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Cargando parada...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ruta
          </button>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header con navegación */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver a Ruta</span>
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Parada #{stopNumber}
              </h1>
              {routeData && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ruta {routeData.routeNumber} - {routeData.driverName || 'Sin conductor'}
                </p>
              )}
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            stopData?.status === 'delivered'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : stopData?.status === 'failed'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            {stopData?.status === 'delivered' ? 'Completada' :
             stopData?.status === 'failed' ? 'Fallida' : 'Pendiente'}
          </span>
        </div>

        {/* Contenido principal */}
        <StopDetailPage
          stop={stopData}
          routeId={routeId}
          routeData={routeData}
          onRefresh={handleRefresh}
        />
      </div>
    </DashboardLayout>
  )
}
