import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'

export function LoadingScreen() {
  return (
    <View className="flex-1 bg-gray-50 items-center justify-center">
      <View className="items-center">
        <View
          className="w-20 h-20 bg-orange-500 rounded-3xl items-center justify-center mb-6"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 }}
        >
          <Text className="text-3xl">🛡</Text>
        </View>
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="text-gray-400 text-sm mt-4 font-medium tracking-wide">
          Conectando...
        </Text>
      </View>
    </View>
  )
}
