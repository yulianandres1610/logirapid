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
          className="absolute inset-0 w-full h-full rounded-2xl shadow-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
          }}
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/30 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
          </div>

          <div className="relative z-10 h-full p-6 flex flex-col justify-between text-white">
            {/* Header */}
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {type === 'company' && (
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  {type === 'user' && (
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  {type === 'customer' && (
                    <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  )}
                  <span className="text-xs text-gray-300 uppercase tracking-wider">
                    {type === 'company' ? 'Empresa' : type === 'user' ? 'Usuario' : 'Cliente'}
                  </span>
                  {/* SUPER_ADMIN badge and settings button on front */}
                  {isSuperAdmin && type === 'company' && onCreditSettingsChange && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowCreditSettings(!showCreditSettings)
                      }}
                      className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
                      title="Configurar limites"
                    >
                      <svg className="w-4 h-4 text-orange-400 hover:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>
                <h3 className="text-base font-bold leading-tight line-clamp-2" title={name}>{name}</h3>
              </div>
              <div className="flex-shrink-0">
                {logo && (
                  <img src={logo} alt={name} className="w-10 h-10 rounded-lg object-cover bg-white/10" />
                )}
                {!logo && (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <span className="text-lg font-bold">{name.charAt(0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Number */}
            <div className="flex-1 flex items-center">
              <div className="flex items-center gap-3">
                <span className="text-xl font-mono tracking-wider">
                  {formatWalletNumber(walletNumber, showFullNumber)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFullNumber(!showFullNumber)
                  }}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {showFullNumber ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-400 mb-1">Balance</p>
                <p className="text-2xl font-bold">{balanceFormatted}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                <span className="text-xs text-gray-300">{statusText}</span>
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

        {/* Back Side */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl shadow-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%)'
          }}
        >
          <div className="relative z-10 h-full p-5 text-white">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Wallet Details</div>

            {/* Full wallet number */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Numero Completo</p>
              <p className="font-mono text-sm">{formatWalletNumber(walletNumber, true)}</p>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {phone && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Telefono</p>
                  <p className="text-xs font-medium">{phone}</p>
                </div>
              )}
              {email && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Email</p>
                  <p className="text-xs font-medium truncate">{email}</p>
                </div>
              )}
            </div>

            {/* Limits */}
            <div className="space-y-2 mb-3">
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
