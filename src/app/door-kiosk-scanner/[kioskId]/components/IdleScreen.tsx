'use client'

import { motion } from 'framer-motion'
import { Shield, Users, ScanLine, Clock, Download } from 'lucide-react'

interface KioskStats {
  visitorsInside: number
  totalVisitorsToday: number
}

interface Props {
  kioskName: string
  guardName: string
  currentTime: Date | null
  stats: KioskStats | null
  canInstall?: boolean
  onInstall?: () => void
}

/**
 * Idle dashboard — light theme for outdoor use on Zebra TC21K (5" 1280x720)
 */
export default function IdleScreen({ kioskName, guardName, currentTime, stats, canInstall, onInstall }: Props) {
  const timeStr = currentTime
    ? currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const dateStr = currentTime
    ? currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] px-4 py-3 text-center overflow-hidden">
      {/* Header */}
      <div className="mb-1">
        <div className="flex items-center justify-center gap-1.5 text-orange-600 mb-0.5">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-semibold">{kioskName}</span>
        </div>
        <p className="text-[11px] text-gray-500">Guardia: {guardName}</p>
      </div>

      {/* Time */}
      <div className="mb-4">
        <p className="text-[3rem] font-bold text-gray-900 tracking-tight leading-none">{timeStr}</p>
        <p className="text-xs text-gray-500 capitalize mt-1">{dateStr}</p>
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-5">
        <div className="text-center bg-white rounded-xl px-5 py-2.5 shadow-sm border border-orange-100">
          <Users className="w-4 h-4 text-orange-600 mx-auto mb-0.5" />
          <p className="text-2xl font-bold text-gray-900 leading-none">{stats?.visitorsInside ?? 0}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Dentro</p>
        </div>
        <div className="text-center bg-white rounded-xl px-5 py-2.5 shadow-sm border border-gray-200">
          <Clock className="w-4 h-4 text-gray-400 mx-auto mb-0.5" />
          <p className="text-2xl font-bold text-gray-900 leading-none">{stats?.totalVisitorsToday ?? 0}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Hoy</p>
        </div>
      </div>

      {/* Scan prompt */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex flex-col items-center"
      >
        <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center mb-3 border-2 border-orange-300">
          <ScanLine className="w-10 h-10 text-orange-600" />
        </div>
        <p className="text-lg font-semibold text-gray-900">Escanee el carnet</p>
        <p className="text-xs text-gray-500 mt-0.5">de identidad</p>
      </motion.div>

      {/* Install button */}
      {canInstall && onInstall && (
        <button
          onClick={onInstall}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar App
        </button>
      )}
    </div>
  )
}
