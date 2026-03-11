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

/**
 * Idle dashboard — optimized for Zebra TC21K (5" 1280×720, ~360×640 CSS)
 */
export default function IdleScreen({ kioskName, guardName, currentTime, stats }: Props) {
  const timeStr = currentTime
    ? currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const dateStr = currentTime
    ? currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] px-4 py-3 text-center overflow-hidden">
      {/* Header — kiosk + guard */}
      <div className="mb-1">
        <div className="flex items-center justify-center gap-1.5 text-orange-400 mb-0.5">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-medium">{kioskName}</span>
        </div>
        <p className="text-[11px] text-stone-500">Guardia: {guardName}</p>
      </div>

      {/* Time */}
      <div className="mb-4">
        <p className="text-[3rem] font-bold text-white tracking-tight leading-none">{timeStr}</p>
        <p className="text-xs text-stone-400 capitalize mt-1">{dateStr}</p>
      </div>

      {/* Stats */}
      <div className="flex gap-8 mb-5">
        <div className="text-center">
          <Users className="w-4 h-4 text-orange-400 mx-auto mb-0.5" />
          <p className="text-2xl font-bold text-white leading-none">{stats?.visitorsInside ?? 0}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Dentro</p>
        </div>
        <div className="w-px bg-stone-700" />
        <div className="text-center">
          <Clock className="w-4 h-4 text-stone-500 mx-auto mb-0.5" />
          <p className="text-2xl font-bold text-white leading-none">{stats?.totalVisitorsToday ?? 0}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Hoy</p>
        </div>
      </div>

      {/* Scan prompt — pulsing */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center"
      >
        <div className="w-20 h-20 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-3 border-2 border-orange-500/40">
          <ScanLine className="w-10 h-10 text-orange-400" />
        </div>
        <p className="text-lg font-semibold text-white">Escanee el carnet</p>
        <p className="text-xs text-stone-400 mt-0.5">de identidad</p>
      </motion.div>
    </div>
  )
}
