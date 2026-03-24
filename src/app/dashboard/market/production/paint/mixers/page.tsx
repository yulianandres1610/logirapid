'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Cog, Loader2, Weight } from 'lucide-react'
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
  const [mixers, setMixers] = useState<Mixer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch('/api/market/production/paint/mixers').then(r => r.json()).then(d => { if (d.success) setMixers(d.data) }).finally(() => setLoading(false)) }, [])

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Mezcladoras (Torbas)</h1><p className="text-sm text-gray-500">Equipos de mezclado con capacidades</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/mixers/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nueva Mezcladora</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : mixers.length === 0 ? <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}><Cog className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay mezcladoras</p><button onClick={() => router.push('/dashboard/market/production/paint/mixers/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primera</button></div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{mixers.map(m => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('p-5 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3"><div className={cn('p-2.5 rounded-xl', isDark ? 'bg-purple-900/30' : 'bg-purple-100')}><Cog className={cn('w-5 h-5', isDark ? 'text-purple-400' : 'text-purple-600')} /></div><h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{m.name}</h3></div>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium', m.mixerType === 'small' ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700' : isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700')}>{m.mixerType === 'small' ? 'Pequeña' : 'Grande'}</span></div>
            <div className="flex items-center gap-2 text-sm text-gray-500"><Weight className="w-4 h-4" /><span><strong>{m.capacityMinKg}</strong> — <strong>{m.capacityMaxKg}</strong> kg</span></div>
            <div className={cn('mt-3 h-2 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}><div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: '70%' }} /></div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full mt-2 inline-block', m.isAvailable ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700' : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')}>{m.isAvailable ? 'Disponible' : 'En uso'}</span>
          </motion.div>))}</div>}
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
