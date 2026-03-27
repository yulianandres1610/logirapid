'use client'

import { useState, useEffect } from 'react'
import { Plus, Palette, Loader2, Droplets, Search, Trash2, Edit, FlaskConical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ColorCard { id: number; code: string; name: string; baseTypeName: string; hexColor: string | null; tintCount: number }

export default function PaintColorCardsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [items, setItems] = useState<ColorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchData = () => {
    setLoading(true)
    fetch('/api/market/production/paint/color-cards').then(r => r.json()).then(d => { if (d.success) setItems(d.data) }).finally(() => setLoading(false))
  }
  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el color "${name}"? Se eliminarán también sus tintas.`)) return
    const res = await fetch(`/api/market/production/paint/color-cards/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) fetchData()
    else alert(data.error || 'Error al eliminar')
  }

  const filtered = items.filter(cc => cc.name.toLowerCase().includes(search.toLowerCase()) || cc.code.toLowerCase().includes(search.toLowerCase()))

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Cartas de Color</h1><p className="text-sm text-gray-500">Colores con receta de tintas por kg de base</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/color-cards/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Color</button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar color..."
            className={cn('w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200')} />
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : filtered.length === 0 ? (
          <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay colores</p>
            <button onClick={() => router.push('/dashboard/market/production/paint/color-cards/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer color</button>
          </div>
        ) : (
          <div className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700' : 'border-gray-200')}>
            <table className="w-full">
              <thead>
                <tr className={cn('text-xs uppercase tracking-wider', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                  <th className="text-left px-4 py-3">Color</th>
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Base</th>
                  <th className="text-center px-4 py-3">Tintas</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-gray-700' : 'divide-gray-200')}>
                {filtered.map(cc => (
                  <tr key={cc.id} className={cn('transition-colors', isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:bg-gray-50')}>
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 rounded-lg border-2 border-white shadow" style={{ backgroundColor: cc.hexColor || '#ccc' }} />
                    </td>
                    <td className={cn('px-4 py-3 font-mono text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>{cc.code}</td>
                    <td className={cn('px-4 py-3 font-medium', isDark ? 'text-white' : 'text-gray-900')}>{cc.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700')}>
                        <FlaskConical className="w-3 h-3 inline mr-1" />{cc.baseTypeName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-sm text-gray-500"><Droplets className="w-3.5 h-3.5" /> {cc.tintCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => router.push(`/dashboard/market/production/paint/color-cards/${cc.id}/edit`)}
                          className="p-1.5 text-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(cc.id, cc.name)}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
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
