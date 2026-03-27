'use client'

import { useState, useEffect } from 'react'
import { Plus, Beaker, Loader2, FlaskConical, Trash2, Package, Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BaseType { id: number; code: string; name: string; description: string | null; formulaName: string | null; formulaCode: string | null; yieldKg: number; isActive: boolean }

export default function PaintBaseTypesPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [items, setItems] = useState<BaseType[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/market/production/paint/base-types').then(r => r.json()).then(d => { if (d.success) setItems(d.data) }).finally(() => setLoading(false))
  }
  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/market/production/paint/base-types/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) fetchData()
    else alert(data.error || 'Error al eliminar')
  }

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Tipos de Base</h1><p className="text-sm text-gray-500">Base clara, oscura y otras para fabricación</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/base-types/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Tipo</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : items.length === 0 ? (
          <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <Beaker className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay tipos de base</p>
            <button onClick={() => router.push('/dashboard/market/production/paint/base-types/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer tipo</button>
          </div>
        ) : (
          <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
            <table className="w-full">
              <thead>
                <tr className={cn('text-xs uppercase tracking-wider', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Fórmula</th>
                  <th className="text-center px-4 py-3">Rendimiento</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-200')}>
                {items.map(bt => (
                  <tr key={bt.id} className={cn('transition-colors', isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:bg-gray-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FlaskConical className={cn('w-4 h-4', isDark ? 'text-amber-400' : 'text-amber-600')} />
                        <span className={cn('font-mono text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>{bt.code}</span>
                      </div>
                    </td>
                    <td className={cn('px-4 py-3 font-medium', isDark ? 'text-white' : 'text-gray-900')}>{bt.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {bt.formulaCode ? <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {bt.formulaCode} — {bt.formulaName}</span> : <span className="text-gray-400">Sin fórmula</span>}
                    </td>
                    <td className="px-4 py-3 text-center"><span className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{bt.yieldKg} kg</span></td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-1 rounded-full font-medium', bt.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500')}>{bt.isActive ? 'Activa' : 'Inactiva'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => router.push(`/dashboard/market/production/paint/base-types/create`)}
                          className="p-1.5 text-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(bt.id, bt.name)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
