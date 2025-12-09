'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface VirtualCardProps {
  walletNumber: string
  name: string
  balance: number
  balanceFormatted: string
  phone?: string
  email?: string
  status: string
  type: 'company' | 'user' | 'customer'
  logo?: string
  dailyLimit?: number
  dailyUsed?: number
  monthlyLimit?: number
  monthlyUsed?: number
  currency?: string
  createdAt?: string
  // Credit system props (only for companies)
  creditLimit?: number // Negative value (e.g., -200)
  creditEnabled?: boolean
  availableCredit?: number
  daysInNegative?: number
  // SUPER_ADMIN controls
  isSuperAdmin?: boolean
  companyId?: number
  onCreditSettingsChange?: (settings: { creditLimit?: number, dailyLimit?: number, monthlyLimit?: number, creditEnabled?: boolean }) => void
  onRecharge?: () => void
  onTransfer?: () => void
  onHistory?: () => void
  className?: string
}

// Card tier configuration based on balance
type CardTier = 'platinum' | 'gold' | 'diamond'

const getCardTier = (balance: number): CardTier => {
  if (balance >= 10000) return 'diamond'
  if (balance >= 1000) return 'gold'
  return 'platinum'
}

const tierConfig = {
  platinum: {
    name: 'PLATINUM',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #8e9eab 50%, #667eea 75%, #eef2f3 100%)',
    gradientBack: 'linear-gradient(135deg, #8e9eab 0%, #667eea 50%, #764ba2 100%)',
    accentColor: '#a8b5c4',
    textColor: 'text-gray-100',
    badgeGradient: 'from-gray-300 via-gray-100 to-gray-300',
    badgeBorder: 'border-gray-300/50',
    glowColor: 'rgba(102, 126, 234, 0.3)',
    chipColor: 'from-gray-400 to-gray-600',
  },
  gold: {
    name: 'GOLD',
    gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 20%, #d4a574 50%, #f5af19 75%, #fceabb 100%)',
    gradientBack: 'linear-gradient(135deg, #d4a574 0%, #f5af19 50%, #f12711 100%)',
    accentColor: '#f5af19',
    textColor: 'text-amber-50',
    badgeGradient: 'from-yellow-400 via-amber-200 to-yellow-400',
    badgeBorder: 'border-yellow-400/50',
    glowColor: 'rgba(245, 175, 25, 0.4)',
    chipColor: 'from-yellow-500 to-amber-700',
  },
  diamond: {
    name: 'DIAMOND',
    gradient: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 20%, #434343 40%, #000000 60%, #1a1a2e 80%, #0c0c0c 100%)',
    gradientBack: 'linear-gradient(135deg, #1a1a2e 0%, #434343 50%, #0c0c0c 100%)',
    accentColor: '#00d4ff',
    textColor: 'text-cyan-50',
    badgeGradient: 'from-cyan-400 via-blue-200 to-cyan-400',
    badgeBorder: 'border-cyan-400/50',
    glowColor: 'rgba(0, 212, 255, 0.3)',
    chipColor: 'from-cyan-400 to-blue-600',
  },
}

export function VirtualCard({
  walletNumber,
  name,
  balance,
  balanceFormatted,
  phone,
  email,
  status,
  type,
  logo,
  dailyLimit = 5000,
  dailyUsed = 0,
  monthlyLimit = 50000,
  monthlyUsed = 0,
  currency = 'USD',
  createdAt,
  // Credit system props
  creditLimit = -200,
  creditEnabled = true,
  availableCredit,
  daysInNegative = 0,
  // SUPER_ADMIN controls
  isSuperAdmin = false,
  companyId,
  onCreditSettingsChange,
  onRecharge,
  onTransfer,
  onHistory,
  className = ''
}: VirtualCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [showFullNumber, setShowFullNumber] = useState(false)
  const [showCreditSettings, setShowCreditSettings] = useState(false)
  const [tempCreditLimit, setTempCreditLimit] = useState(Math.abs(creditLimit))
  const [tempDailyLimit, setTempDailyLimit] = useState(dailyLimit)
  const [tempMonthlyLimit, setTempMonthlyLimit] = useState(monthlyLimit)

  // Get card tier based on balance
  const tier = getCardTier(balance)
  const tierStyle = tierConfig[tier]

  // Format wallet number with spaces
  const formatWalletNumber = (num: string, show: boolean) => {
    if (!num) return '---- ---- ---- ----'
    const clean = num.replace(/\s/g, '')
    const formatted = clean.match(/.{1,4}/g)?.join(' ') || clean
    if (show) return formatted
    const parts = formatted.split(' ')
    return parts.map((p, i) => i < parts.length - 1 ? '****' : p).join(' ')
  }

  // Calculate limit percentages
  const dailyPercent = dailyLimit > 0 ? Math.min((dailyUsed / dailyLimit) * 100, 100) : 0
  const monthlyPercent = monthlyLimit > 0 ? Math.min((monthlyUsed / monthlyLimit) * 100, 100) : 0

  // Calculate credit usage (only for companies)
  const isNegative = balance < 0
  const creditLimitAbs = Math.abs(creditLimit)
  const creditUsed = isNegative ? Math.abs(balance) : 0
  const creditPercent = creditLimitAbs > 0 ? Math.min((creditUsed / creditLimitAbs) * 100, 100) : 0
  const calculatedAvailableCredit = availableCredit ?? (creditLimitAbs - creditUsed)

  // Status badge color
  const statusColor = status === 'active' ? 'bg-green-500' : status === 'inactive' ? 'bg-red-500' : 'bg-yellow-500'
  const statusText = status === 'active' ? 'Activo' : status === 'inactive' ? 'Inactivo' : 'Pendiente'

  return (
    <div className={`perspective-1000 ${className}`} style={{ perspective: '1000px' }}>
      <motion.div
        className="relative w-full h-56 cursor-pointer"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            background: tierStyle.gradient,
            boxShadow: `0 25px 50px -12px ${tierStyle.glowColor}, 0 0 0 1px rgba(255,255,255,0.1)`
          }}
        >
          {/* Premium texture overlay */}
          <div className="absolute inset-0 opacity-30">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          {/* Holographic shine effect */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, transparent 50%)',
              animation: 'shimmer 3s ease-in-out infinite'
            }}
          />

          {/* Diamond sparkles for diamond tier */}
          {tier === 'diamond' && (
            <>
              <div className="absolute top-4 right-16 w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
              <div className="absolute top-12 right-8 w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse delay-300" />
              <div className="absolute bottom-16 right-24 w-1 h-1 bg-cyan-300 rounded-full animate-pulse delay-500" />
              <div className="absolute top-20 left-12 w-1 h-1 bg-white rounded-full animate-pulse delay-700" />
            </>
          )}

          <div className="relative z-10 h-full p-5 flex flex-col justify-between text-white">
            {/* Header with Tier Badge */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                {/* Tier Badge - American Express style */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`px-2.5 py-0.5 rounded border ${tierStyle.badgeBorder} bg-gradient-to-r ${tierStyle.badgeGradient} shadow-lg`}>
                    <span className="text-[10px] font-bold tracking-[0.2em] text-gray-900">
                      {tierStyle.name}
                    </span>
                  </div>
                  {/* SUPER_ADMIN settings button */}
                  {isSuperAdmin && type === 'company' && onCreditSettingsChange && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowCreditSettings(!showCreditSettings)
                      }}
                      className="ml-auto p-1 rounded hover:bg-white/20 transition-colors"
                      title="Configurar limites"
                    >
                      <svg className="w-4 h-4 text-white/80 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>
                <h3 className="text-sm font-bold leading-tight line-clamp-1 drop-shadow-md" title={name}>{name}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  {type === 'company' && (
                    <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  {type === 'user' && (
                    <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  {type === 'customer' && (
                    <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  )}
                  <span className="text-[10px] opacity-70 uppercase tracking-wider">
                    {type === 'company' ? 'Empresa' : type === 'user' ? 'Usuario' : 'Cliente'}
                  </span>
                </div>
              </div>
              {/* Card Chip - American Express style */}
              <div className="flex-shrink-0">
                <div className={`w-11 h-8 rounded-md bg-gradient-to-br ${tierStyle.chipColor} shadow-lg flex items-center justify-center overflow-hidden`}>
                  <div className="grid grid-cols-3 gap-px w-8 h-5">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-black/30 rounded-sm" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Number with enhanced styling */}
            <div className="flex-1 flex items-center">
              <div className="flex items-center gap-3 w-full">
                <span className="text-lg font-mono tracking-[0.15em] font-medium drop-shadow-md">
                  {formatWalletNumber(walletNumber, showFullNumber)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFullNumber(!showFullNumber)
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  {showFullNumber ? (
                    <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Footer with Balance */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] opacity-60 mb-0.5 uppercase tracking-wider">Balance Disponible</p>
                <p className="text-2xl font-bold tracking-tight drop-shadow-lg">{balanceFormatted}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${statusColor} shadow-lg`} />
                  <span className="text-[10px] opacity-80">{statusText}</span>
                </div>
                {/* Currency badge */}
                <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-medium tracking-wide">
                  {currency}
                </div>
              </div>
            </div>
          </div>

          {/* Centurion-style emblem watermark */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M50 15 L55 40 L80 40 L60 55 L70 80 L50 65 L30 80 L40 55 L20 40 L45 40 Z" fill="currentColor" />
            </svg>
          </div>

          {/* Flip indicator */}
          <div className="absolute bottom-2 right-2 text-white/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: tierStyle.gradientBack,
            boxShadow: `0 25px 50px -12px ${tierStyle.glowColor}`
          }}
        >
          <div className="relative z-10 h-full p-4 text-white flex flex-col">
            {/* Header with wallet number and contact info */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Wallet</div>
                <p className="font-mono text-xs">{formatWalletNumber(walletNumber, true)}</p>
              </div>
              <div className="text-right">
                {phone && (
                  <div className="mb-1">
                    <p className="text-[10px] text-gray-400">Tel</p>
                    <p className="text-xs font-medium">{phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Limits - Main content */}
            <div className="flex-1 space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Limite Diario</span>
                  <span>${dailyUsed.toLocaleString()} / ${dailyLimit.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${dailyPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Limite Mensual</span>
                  <span>${monthlyUsed.toLocaleString()} / ${monthlyLimit.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${monthlyPercent}%` }}
                  />
                </div>
              </div>

              {/* Credit limit (only for companies) */}
              {type === 'company' && creditEnabled && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400 flex items-center gap-1">
                      Credito
                      {isNegative && daysInNegative > 0 && (
                        <span className={`px-1 py-0.5 rounded text-[10px] ${daysInNegative >= 35 ? 'bg-red-500/30 text-red-300' : 'bg-yellow-500/30 text-yellow-300'}`}>
                          {daysInNegative}d
                        </span>
                      )}
                    </span>
                    <span className={isNegative ? 'text-red-400' : ''}>
                      ${creditUsed.toLocaleString()} / ${creditLimitAbs.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${creditPercent >= 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-orange-500 to-amber-500'}`}
                      style={{ width: `${creditPercent}%` }}
                    />
                  </div>
                  {calculatedAvailableCredit > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Disponible: ${calculatedAvailableCredit.toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                <span className="text-xs">{statusText}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* SUPER_ADMIN settings button */}
                {isSuperAdmin && type === 'company' && onCreditSettingsChange && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCreditSettings(!showCreditSettings)
                    }}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    title="Configurar limites"
                  >
                    <svg className="w-4 h-4 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
                {createdAt && (
                  <span className="text-xs text-gray-400">
                    Desde {new Date(createdAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Flip indicator */}
          <div className="absolute bottom-3 right-3 text-white/40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* SUPER_ADMIN Credit Settings Panel */}
      {isSuperAdmin && type === 'company' && showCreditSettings && onCreditSettingsChange && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-4 bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur rounded-xl p-5 border border-orange-500/30 shadow-lg shadow-orange-500/10"
        >
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Configuracion de Limites</h4>
                <p className="text-[10px] text-gray-400">Solo visible para SUPER_ADMIN</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreditSettings(false)}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5">
            {/* Credit Limit Slider */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span className="text-xs text-gray-300">Limite de Credito</span>
                </div>
                <span className="text-sm text-orange-400 font-bold">${tempCreditLimit.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="50"
                value={tempCreditLimit}
                onChange={(e) => setTempCreditLimit(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                <span>$0</span>
                <span>$500</span>
                <span>$1,000</span>
                <span>$1,500</span>
                <span>$2,000</span>
              </div>
            </div>

            {/* Daily Limit Slider */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-gray-300">Limite Diario</span>
                </div>
                <span className="text-sm text-blue-400 font-bold">${tempDailyLimit.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="500"
                max="25000"
                step="500"
                value={tempDailyLimit}
                onChange={(e) => setTempDailyLimit(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                <span>$500</span>
                <span>$5K</span>
                <span>$10K</span>
                <span>$15K</span>
                <span>$25K</span>
              </div>
            </div>

            {/* Monthly Limit Slider */}
            <div className="bg-gray-700/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-gray-300">Limite Mensual</span>
                </div>
                <span className="text-sm text-green-400 font-bold">${tempMonthlyLimit.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="5000"
                max="100000"
                step="5000"
                value={tempMonthlyLimit}
                onChange={(e) => setTempMonthlyLimit(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                <span>$5K</span>
                <span>$25K</span>
                <span>$50K</span>
                <span>$75K</span>
                <span>$100K</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => {
                setTempCreditLimit(creditLimitAbs)
                setTempDailyLimit(dailyLimit)
                setTempMonthlyLimit(monthlyLimit)
                setShowCreditSettings(false)
              }}
              className="px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onCreditSettingsChange({
                  creditLimit: -tempCreditLimit,
                  dailyLimit: tempDailyLimit,
                  monthlyLimit: tempMonthlyLimit
                })
                setShowCreditSettings(false)
              }}
              className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-orange-500/30"
            >
              Guardar Cambios
            </button>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      {(onRecharge || onTransfer || onHistory) && (
        <div className="flex gap-2 mt-4 justify-center">
          {onRecharge && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRecharge()
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Recargar
            </button>
          )}
          {onTransfer && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTransfer()
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transferir
            </button>
          )}
          {onHistory && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onHistory()
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Historial
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default VirtualCard
