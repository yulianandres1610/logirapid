'use client'

import { useState, useEffect } from 'react'
import { Plus, Box, Loader2, Trash2, Weight, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PackagingSpec { id: number; name: string; volumeLiters: number; netWeightKg: number; containerName: string | null; labelName: string | null; lidName: string | null; laborCostPerUnit: number }

export default function PaintPackagingPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [items, setItems] = useState<PackagingSpec[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/market/production/paint/packaging-specs').then(r => r.json()).then(d => { if (d.success) setItems(d.data) }).finally(() => setLoading(false))
  }
  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return
    const res = await fetch(`/api/market/production/paint/packaging-specs/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) fetchData()
    else alert(data.error || 'Error al eliminar')
  }

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Especificaciones de Envase</h1><p className="text-sm text-gray-500">Tamaños con peso neto y componentes</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/packaging/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Envase</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : items.length === 0 ? (
          <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <Box className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay envases</p>
            <button onClick={() => router.push('/dashboard/market/production/paint/packaging/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer envase</button>
          </div>
        ) : (
          <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
            <table className="w-full">
              <thead>
                <tr className={cn('text-xs uppercase tracking-wider', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-center px-4 py-3">Volumen</th>
                  <th className="text-center px-4 py-3">Peso Neto</th>
                  <th className="text-left px-4 py-3">Envase</th>
                  <th className="text-left px-4 py-3">Etiqueta</th>
                  <th className="text-left px-4 py-3">Tapa</th>
                  <th className="text-center px-4 py-3">M.O.</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-200')}>
                {items.map(s => (
                  <tr key={s.id} className={cn('transition-colors', isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:bg-gray-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Box className={cn('w-4 h-4', isDark ? 'text-orange-400' : 'text-orange-600')} />
                        <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center"><span className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{s.volumeLiters} L</span></td>
                    <td className="px-4 py-3 text-center"><span className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{s.netWeightKg} kg</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.containerName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.labelName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.lidName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">{s.laborCostPerUnit > 0 ? `$${s.laborCostPerUnit}` : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(s.id, s.name)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
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
