'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Palette, Loader2, Droplets, Search } from 'lucide-react'
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
  const [colorCards, setColorCards] = useState<ColorCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/market/production/paint/color-cards').then(r => r.json()).then(d => { if (d.success) setColorCards(d.data) }).finally(() => setLoading(false))
  }, [])

  const filtered = colorCards.filter(cc => cc.name.toLowerCase().includes(search.toLowerCase()) || cc.code.toLowerCase().includes(search.toLowerCase()))

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Cartas de Color</h1><p className="text-sm text-gray-500">Colores con receta de tintas por kg de base</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/color-cards/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Color</button>
        </div>
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className={cn('w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm', isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200')} /></div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : filtered.length === 0 ? <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}><Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay colores</p><button onClick={() => router.push('/dashboard/market/production/paint/color-cards/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer color</button></div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map(cc => (
          <motion.div key={cc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('rounded-xl border overflow-hidden', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="h-3" style={{ backgroundColor: cc.hexColor || '#ccc' }} />
            <div className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg border-2 border-white shadow" style={{ backgroundColor: cc.hexColor || '#ccc' }} /><div><h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{cc.name}</h3><p className="text-xs text-gray-500">{cc.code}</p></div></div>
            <div className="flex gap-3 mt-3 text-xs text-gray-500"><span className={cn('px-2 py-0.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}>{cc.baseTypeName}</span><span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> {cc.tintCount} tintas</span></div></div>
          </motion.div>))}</div>}
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
