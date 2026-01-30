'use client'

import { cn } from '@/lib/utils'

interface MultiCurrencyPriceProps {
  priceUSD: number
  rates: { USD_CUP: number; USD_MLC: number }
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showBase?: boolean
  vertical?: boolean
  showLabels?: boolean
  className?: string
}

export function MultiCurrencyPrice({
  priceUSD,
  rates,
  size = 'sm',
  showBase = false,
  vertical = true,
  showLabels = false,
  className
}: MultiCurrencyPriceProps) {
  const priceCUP = priceUSD * rates.USD_CUP
  const priceMLC = priceUSD * rates.USD_MLC

  const sizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const formatCUP = (amount: number): string => {
    return Math.round(amount).toLocaleString('es-CU')
  }

  const formatMLC = (amount: number): string => {
    return amount.toFixed(2)
  }

  return (
    <div className={cn(
      "flex",
      vertical ? 'flex-col gap-0.5' : 'flex-row flex-wrap gap-2',
      className
    )}>
      {showBase && (
        <span className={cn(sizeClasses[size], 'font-semibold text-emerald-600')}>
          {showLabels && <span className="text-gray-400 mr-1">USD:</span>}
          ${priceUSD.toFixed(2)}
        </span>
      )}
      <span className={cn(sizeClasses[size], 'text-blue-600')}>
        {showLabels && <span className="text-gray-400 mr-1">CUP:</span>}
        <span className="font-medium">${formatCUP(priceCUP)} CUP</span>
      </span>
      <span className={cn(sizeClasses[size], 'text-purple-600')}>
        {showLabels && <span className="text-gray-400 mr-1">MLC:</span>}
        <span className="font-medium">${formatMLC(priceMLC)}</span>
      </span>
    </div>
  )
}

// Componente compacto para mostrar en una sola línea
export function MultiCurrencyPriceInline({
  priceUSD,
  rates,
  size = 'xs',
  className
}: Omit<MultiCurrencyPriceProps, 'vertical' | 'showBase' | 'showLabels'>) {
  const priceCUP = priceUSD * rates.USD_CUP
  const priceMLC = priceUSD * rates.USD_MLC

  const sizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={cn(sizeClasses[size], 'flex items-center gap-1.5', className)}>
      <span className="text-blue-600 font-medium">
        ${priceCUP.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP
      </span>
      <span className="text-gray-400">·</span>
      <span className="text-purple-600 font-medium">
        ${priceMLC.toFixed(2)} MLC
      </span>
    </div>
  )
}
