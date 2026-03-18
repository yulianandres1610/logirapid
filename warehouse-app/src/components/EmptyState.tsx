import React from 'react'
import { View, Text } from 'react-native'

interface EmptyStateProps {
  icon?: string
  title: string
  message?: string
}

export function EmptyState({ icon = '📦', title, message }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-20 px-6">
      <View className="w-20 h-20 bg-brand-50 rounded-3xl items-center justify-center mb-4">
        <Text className="text-4xl">{icon}</Text>
      </View>
      <Text className="text-lg font-bold text-dark-700 text-center">{title}</Text>
      {message && (
        <Text className="text-sm text-dark-400 text-center mt-2 leading-5">{message}</Text>
      )}
    </View>
  )
}
