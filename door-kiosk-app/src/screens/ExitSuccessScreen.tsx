import React, { useState, useEffect, useCallback } from 'react'
import { View, Text } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

export function ExitSuccessScreen() {
  const visitor = useKioskStore(s => s.visitor)
  const resetToIdle = useKioskStore(s => s.resetToIdle)
  const [countdown, setCountdown] = useState(3)

  const onComplete = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-6">
      {/* Exit icon */}
      <View
        className="w-24 h-24 bg-orange-500 rounded-[32px] items-center justify-center mb-5"
        style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 }}
      >
        <Text className="text-4xl">👋</Text>
      </View>

      <Text className="text-lg font-bold text-orange-600 mb-4 tracking-wide">SALIDA REGISTRADA</Text>

      {/* Visitor info */}
      <View
        className="bg-white rounded-3xl p-5 w-full max-w-[300px] items-center"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
      >
        <Text className="text-xl font-bold text-gray-900 text-center">
          {visitor?.fullName}
        </Text>
        <Text className="text-sm text-gray-400 mt-1">{visitor?.idNumber}</Text>
      </View>

      {/* Countdown */}
      <View className="mt-6 w-12 h-12 bg-orange-500 rounded-2xl items-center justify-center"
        style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }}
      >
        <Text className="text-lg font-bold text-white">{countdown}</Text>
      </View>
    </View>
  )
}
