'use client'

import { motion } from 'framer-motion'
import { Shield, Users, ScanLine, Clock } from 'lucide-react'

interface KioskStats {
  visitorsInside: number
  totalVisitorsToday: number
}

interface Props {
  kioskName: string
  guardName: string
  currentTime: Date | null
  stats: KioskStats | null
}

export default function IdleScreen({ kioskName, guardName, currentTime, stats }: Props) {
  const timeStr = currentTime
    ? currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const dateStr = currentTime
    ? currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 text-center">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center justify-center gap-2 text-orange-400 mb-1">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-medium">{kioskName}</span>
        </div>
        <p className="text-xs text-stone-400">Guardia: {guardName}</p>
      </div>

      {/* Time */}
      <div className="mb-6">
        <p className="text-5xl font-bold text-white tracking-tight">{timeStr}</p>
        <p className="text-sm text-stone-400 capitalize mt-1">{dateStr}</p>
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-orange-400 mb-1">
            <Users className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.visitorsInside ?? 0}</p>
          <p className="text-xs text-stone-400">Dentro</p>
        </div>
        <div className="w-px bg-stone-700" />
        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-stone-400 mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalVisitorsToday ?? 0}</p>
          <p className="text-xs text-stone-400">Hoy</p>
        </div>
      </div>

      {/* Scan prompt */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-orange-500/20 rounded-3xl flex items-center justify-center mb-4 border-2 border-orange-500/40">
          <ScanLine className="w-12 h-12 text-orange-400" />
        </div>
        <p className="text-xl font-semibold text-white">Escanee el carnet</p>
        <p className="text-sm text-stone-400 mt-1">de identidad</p>
      </motion.div>
    </div>
  )
}
