'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, FlipHorizontal, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface WalletCardProps {
  walletNumber: string
  companyName: string
  primaryCurrency: string
  secondaryCurrencies: string[]
  balance: number
  showBalance: boolean
  setShowBalance: (show: boolean) => void
  isMultiCurrency: boolean
  hasLimits: boolean
  dailyLimit: string
  monthlyLimit: string
}

export function WalletCard({
  walletNumber,
  companyName,
  primaryCurrency,
  secondaryCurrencies,
  balance,
  showBalance,
  setShowBalance,
  isMultiCurrency,
  hasLimits,
  dailyLimit,
  monthlyLimit
}: WalletCardProps) {
  const { theme } = useTheme()
  const [isFlipped, setIsFlipped] = useState(true)

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$'
      case 'CUP': return '$'
      case 'EUR': return '€'
      case 'CAD': return 'C$'
      case 'MNX': return 'M$'
      default: return '$'
    }
  }

  const getCurrencyFlag = (currency: string) => {
    switch (currency) {
      case 'USD': return '🇺🇸'
      case 'CUP': return '🇨🇺'
      case 'EUR': return '🇪🇺'
      case 'CAD': return '🇨🇦'
      case 'MNX': return '🇲🇽'
      default: return '🌐'
    }
  }

  const formatBalance = (amount: number, currency: string) => {
    return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`
  }

  const getCardColors = () => {
    switch (primaryCurrency) {
      case 'USD':
        return 'from-blue-600 to-blue-400'
      case 'CUP':
        return 'from-red-600 to-red-400'
      case 'EUR':
        return 'from-indigo-600 to-indigo-400'
      case 'CAD':
        return 'from-green-600 to-green-400'
      case 'MNX':
        return 'from-purple-600 to-purple-400'
      default:
        return 'from-gray-600 to-gray-400'
    }
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative h-64 preserve-3d" style={{ perspective: '2000px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={isFlipped ? 'back' : 'front'}
            initial={false}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className={cn(
              "absolute inset-0 w-full h-full rounded-3xl shadow-2xl cursor-pointer",
              "backface-hidden transform-gpu",
              "border border-white/20 backdrop-blur-sm",
              getCardColors()
            )}
            onClick={() => setIsFlipped(!isFlipped)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {!isFlipped ? (
              // Front of card - Diseño mejorado
              <div className="p-8 h-full flex flex-col justify-between text-white relative overflow-hidden">
                {/* Pattern de fondo */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-20 translate-x-20" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-16 -translate-x-16" />
                </div>

                {/* Contenido superior */}
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-xs uppercase tracking-wider opacity-80 mb-2">CUBARAPID</p>
                      <p className="text-sm opacity-70">Digital Wallet</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <img
                        src="/favicon.png"
                        alt="CUBARAPID"
                        className="w-8 h-8 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Nombre de la empresa - Centrado */}
                <div className="relative z-10 flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 tracking-wide">
                      {companyName}
                    </h2>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">{getCurrencyFlag(primaryCurrency)}</span>
                      <span className="text-sm font-medium opacity-80">{primaryCurrency}</span>
                      {isMultiCurrency && (
                        <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                          Multi
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contenido inferior */}
                <div className="relative z-10 flex justify-between items-end">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-80">Disponible</p>
                    <p className="text-lg font-bold">
                      {showBalance ? formatBalance(balance, primaryCurrency) : '****'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider opacity-80">Tipo</p>
                    <p className="text-sm font-medium">
                      {isMultiCurrency ? 'Multi-moneda' : 'Moneda única'}
                    </p>
                  </div>
                </div>

                {/* Chip simulado */}
                <div className="absolute top-8 left-8 w-12 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg opacity-80 shadow-lg" />
                <div className="absolute top-8 left-8 w-10 h-8 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md" />
              </div>
            ) : (
              // Back of card - Diseño mejorado
              <div className="p-8 h-full flex flex-col justify-between text-white relative overflow-hidden" style={{ transform: 'rotateY(180deg)' }}>
                {/* Pattern de fondo */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-y-20 -translate-x-20" />
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full translate-y-16 translate-x-16" />
                </div>

                {/* Botón para volver */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsFlipped(false)
                  }}
                  className="absolute top-6 right-6 p-3 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-300 z-20"
                >
                  <FlipHorizontal className="w-5 h-5" />
                </button>

                {/* Banda magnética simulada */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-gray-900/50" />

                {/* Contenido principal - Número de cuenta */}
                <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center">
                  <div className="mb-8">
                    <p className="text-xs uppercase tracking-wider opacity-80 mb-6">Número de Cuenta</p>
                    <div className="space-y-2">
                      <p className="text-xl font-mono tracking-widest">
                        {walletNumber.slice(0, 4)}  {walletNumber.slice(4, 8)}  {walletNumber.slice(8, 12)}  {walletNumber.slice(12, 16)}
                      </p>
                      <p className="text-xl font-mono tracking-widest">
                        {walletNumber.slice(16, 18)}  {walletNumber.slice(18)}
                      </p>
                    </div>
                  </div>

                  {/* CVV simulado */}
                  <div className="absolute bottom-8 right-8">
                    <p className="text-xs uppercase tracking-wider opacity-80 mb-1">CVV</p>
                    <div className="w-12 h-8 bg-white/20 rounded-md flex items-center justify-center backdrop-blur-sm">
                      <span className="text-sm font-mono">***</span>
                    </div>
                  </div>
                </div>

                {/* Información adicional */}
                <div className="relative z-10 flex justify-between items-end">
                  <div>
                    <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Límites</p>
                    <p className="text-sm">
                      {hasLimits && dailyLimit && monthlyLimit
                        ? `Diario: ${dailyLimit} | Mensual: ${monthlyLimit}`
                        : 'Sin límites'
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Monedas</p>
                    <div className="flex gap-1">
                      <span className="text-lg">{getCurrencyFlag(primaryCurrency)}</span>
                      {secondaryCurrencies.slice(0, 2).map((currency) => (
                        <span key={currency} className="text-lg">{getCurrencyFlag(currency)}</span>
                      ))}
                      {secondaryCurrencies.length > 2 && (
                        <span className="text-xs px-1 bg-white/20 rounded">+{secondaryCurrencies.length - 2}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chip en la parte trasera */}
                <div className="absolute top-20 left-8 w-8 h-6 bg-gray-800/60 rounded" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Instructions mejoradas */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <p className={cn(
            "text-sm font-medium",
            theme === 'dark' ? "text-gray-300" : "text-gray-600"
          )}>
            Haz clic para voltear la tarjeta
          </p>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        </div>
        <p className={cn(
          "text-xs",
          theme === 'dark' ? "text-gray-500" : "text-gray-400"
        )}>
          Vista previa interactiva de tu wallet digital
        </p>
      </div>
    </div>
  )
}