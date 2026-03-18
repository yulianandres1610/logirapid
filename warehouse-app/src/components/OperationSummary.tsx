import React from 'react'
import { View, Text } from 'react-native'
import type { OperationLine } from '@/src/stores/operations-store'

interface OperationSummaryProps {
  lines: OperationLine[]
  title?: string
  showProgress?: boolean
}

export function OperationSummary({ lines, title, showProgress }: OperationSummaryProps) {
  const totalProducts = lines.length
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0)
  const validated = showProgress
    ? lines.reduce((sum, l) => sum + (l.validatedQuantity || 0), 0)
    : 0
  const expected = showProgress
    ? lines.reduce((sum, l) => sum + (l.expectedQuantity || 0), 0)
    : 0
  const progress = expected > 0 ? Math.round((validated / expected) * 100) : 0

  return (
    <View
      className="bg-white rounded-2xl p-4 mb-4 border border-dark-100"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
    >
      {title && (
        <Text className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-3">{title}</Text>
      )}
      <View className="flex-row gap-4">
        <View className="flex-1 bg-brand-50 rounded-xl p-3 items-center">
          <Text className="text-2xl font-black text-brand-500">{totalProducts}</Text>
          <Text className="text-xs text-dark-400 font-medium mt-0.5">Productos</Text>
        </View>
        <View className="flex-1 bg-dark-50 rounded-xl p-3 items-center">
          <Text className="text-2xl font-black text-dark-700">{totalUnits}</Text>
          <Text className="text-xs text-dark-400 font-medium mt-0.5">Unidades</Text>
        </View>
        {showProgress && (
          <View className="flex-1 bg-emerald-50 rounded-xl p-3 items-center">
            <Text className="text-2xl font-black text-emerald-600">{progress}%</Text>
            <Text className="text-xs text-dark-400 font-medium mt-0.5">Progreso</Text>
          </View>
        )}
      </View>
      {showProgress && expected > 0 && (
        <View className="mt-3 h-2.5 bg-dark-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      )}
    </View>
  )
}
