import React from 'react'
import { View, Text } from 'react-native'

interface StatCardProps {
  label: string
  value: number
  color: 'orange' | 'blue' | 'green'
}

const colorMap = {
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
}

export function StatCard({ label, value, color }: StatCardProps) {
  const colors = colorMap[color]

  return (
    <View className={`flex-1 ${colors.bg} rounded-xl p-3 border ${colors.border}`}>
      <Text className={`text-2xl font-bold ${colors.text} text-center`}>
        {value}
      </Text>
      <Text className="text-xs text-gray-500 text-center mt-1">{label}</Text>
    </View>
  )
}
