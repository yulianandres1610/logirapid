import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

export function ProcessingScreen() {
  const parsedName = useKioskStore(s => s.parsedName)

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-6">
      <View
        className="w-20 h-20 bg-orange-500 rounded-3xl items-center justify-center mb-6"
        style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 }}
      >
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
      {parsedName && (
        <Text className="text-2xl font-bold text-gray-900 text-center leading-tight tracking-tight">
          {parsedName}
        </Text>
      )}
      <Text className="text-sm text-gray-400 mt-2 font-medium">Procesando...</Text>
    </View>
  )
}
