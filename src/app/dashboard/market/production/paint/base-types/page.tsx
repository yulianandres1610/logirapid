'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Beaker, Loader2, FlaskConical, Package } from 'lucide-react'
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
  const [baseTypes, setBaseTypes] = useState<BaseType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market/production/paint/base-types').then(r => r.json()).then(d => { if (d.success) setBaseTypes(d.data) }).finally(() => setLoading(false))
  }, [])

  return (
    <ProtectedRoute><DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>Tipos de Base</h1><p className="text-sm text-gray-500">Base clara, oscura y otras para fabricación</p></div>
          <button onClick={() => router.push('/dashboard/market/production/paint/base-types/create')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm"><Plus className="w-4 h-4" /> Nuevo Tipo</button>
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        : baseTypes.length === 0 ? <div className={cn('text-center py-20 rounded-2xl border', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}><Beaker className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No hay tipos de base</p><button onClick={() => router.push('/dashboard/market/production/paint/base-types/create')} className="mt-3 text-orange-500 text-sm font-medium">+ Crear primer tipo</button></div>
        : <div className="grid gap-4">{baseTypes.map(bt => (
          <motion.div key={bt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('p-5 rounded-xl border', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white')}>
            <div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={cn('p-2.5 rounded-xl', isDark ? 'bg-amber-900/30' : 'bg-amber-100')}><FlaskConical className={cn('w-5 h-5', isDark ? 'text-amber-400' : 'text-amber-600')} /></div><div><h3 className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>{bt.name}</h3><p className="text-xs text-gray-500">{bt.code}</p></div></div>
            <span className={cn('text-xs px-2 py-1 rounded-full font-medium', bt.isActive ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{bt.isActive ? 'Activa' : 'Inactiva'}</span></div>
            {bt.description && <p className="text-sm text-gray-500 mt-2">{bt.description}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">{bt.formulaName && <span className="flex items-center gap-1.5 text-gray-500"><Package className="w-3.5 h-3.5" /> {bt.formulaCode} — {bt.formulaName}</span>}<span className="flex items-center gap-1.5 text-gray-500"><Beaker className="w-3.5 h-3.5" /> {bt.yieldKg} kg/tanda</span></div>
          </motion.div>))}</div>}
      </div>
    </DashboardLayout></ProtectedRoute>
  )
}
