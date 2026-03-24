'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Box, Loader2, Weight, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PackagingSpec { id: number; name: string; volumeLiters: number; netWeightKg: number; containerName: string | null; laborCostPerUnit: number }

export default function PaintPackagingPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const router = useRouter()
  const [specs, setSpecs] = useState<PackagingSpec[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch('/api/market/production/paint/packaging-specs').then(r => r.json()).then(d => { if (d.success) setSpecs(d.data) }).finally(() => setLoading(false)) }, [])

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Especificaciones de Envase</h1><p className="text-sm text-gray-500">Tamaños con peso neto y componentes</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/packaging/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Envase</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : specs.length === 0 ? <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}><Box className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay envases</p><button onClick={() => router.push('/dashboard/market/production/paint/packaging/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer envase</button></div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{specs.map(s => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('p-5 rounded-xl border text-center', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className={cn('w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3', isDark ? 'bg-orange-900/30' : 'bg-orange-100')}><Box className={cn('w-8 h-8', isDark ? 'text-orange-400' : 'text-orange-600')} /></div>
            <h3 className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>{s.name}</h3>
            <div className="flex justify-center gap-4 mt-2 text-sm text-gray-500"><span className="flex items-center gap-1"><Box className="w-3 h-3" />{s.volumeLiters}L</span><span className="flex items-center gap-1"><Weight className="w-3 h-3" />{s.netWeightKg}kg</span></div>
            {s.containerName && <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1"><Tag className="w-3 h-3" />{s.containerName}</p>}
          </motion.div>))}</div>}
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
