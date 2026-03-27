'use client'

import { useState, useEffect } from 'react'
import { Plus, Cog, Loader2, Trash2, Weight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Mixer { id: number; name: string; capacityMinKg: number; capacityMaxKg: number; mixerType: string; isAvailable: boolean; notes: string | null }

export default function PaintMixersPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [items, setItems] = useState<Mixer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/market/production/paint/mixers').then(r => r.json()).then(d => { if (d.success) setItems(d.data) }).finally(() => setLoading(false))
  }
  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    const res = await fetch(`/api/market/production/paint/mixers/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) fetchData()
    else alert(data.error || 'Error al eliminar')
  }

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Mezcladoras (Torbas)</h1><p className="text-sm text-gray-500">Equipos de mezclado con capacidades</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/mixers/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nueva Mezcladora</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : items.length === 0 ? (
          <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <Cog className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay mezcladoras</p>
            <button onClick={() => router.push('/dashboard/market/production/paint/mixers/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primera</button>
          </div>
        ) : (
          <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
            <table className="w-full">
              <thead>
                <tr className={cn('text-xs uppercase tracking-wider', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-center px-4 py-3">Tipo</th>
                  <th className="text-center px-4 py-3">Cap. Mínima</th>
                  <th className="text-center px-4 py-3">Cap. Máxima</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Notas</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-200')}>
                {items.map(m => (
                  <tr key={m.id} className={cn('transition-colors', isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:bg-gray-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Cog className={cn('w-4 h-4', isDark ? 'text-purple-400' : 'text-purple-600')} />
                        <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                        m.mixerType === 'small' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      )}>{m.mixerType === 'small' ? 'Pequeña' : 'Grande'}</span>
                    </td>
                    <td className={cn('px-4 py-3 text-center font-bold', isDark ? 'text-white' : 'text-gray-900')}>{m.capacityMinKg} kg</td>
                    <td className={cn('px-4 py-3 text-center font-bold', isDark ? 'text-white' : 'text-gray-900')}>{m.capacityMaxKg} kg</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium',
                        m.isAvailable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>{m.isAvailable ? 'Disponible' : 'En uso'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">{m.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(m.id, m.name)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
