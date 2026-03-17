import React, { useState, useEffect, useCallback } from 'react'
import { View, Text } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

const PURPOSE_LABELS: Record<string, string> = {
  compra: 'Compra',
  reunion: 'Reunion',
  entrega: 'Entrega',
  servicio: 'Servicio',
  otro: 'Otro',
}

export function EntrySuccessScreen() {
  const visitor = useKioskStore(s => s.visitor)
  const selectedPurpose = useKioskStore(s => s.selectedPurpose)
  const resetToIdle = useKioskStore(s => s.resetToIdle)
  const [countdown, setCountdown] = useState(3)

  const timeStr = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

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
      {/* Success icon */}
      <View
        className="w-24 h-24 bg-orange-500 rounded-[32px] items-center justify-center mb-5"
        style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 }}
      >
        <Text className="text-4xl">✓</Text>
      </View>

      <Text className="text-lg font-bold text-orange-600 mb-4 tracking-wide">ENTRADA REGISTRADA</Text>

      {/* Info card */}
      <View
        className="bg-white rounded-3xl p-5 w-full max-w-[300px]"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
      >
        <View className="items-center mb-3">
          <Text className="text-xl font-bold text-gray-900 text-center leading-tight">
            {visitor?.fullName}
          </Text>
          <Text className="text-sm text-gray-400 mt-1">{visitor?.idNumber}</Text>
        </View>
        <View className="h-px bg-gray-100 my-2" />
        <View className="flex-row justify-between mb-2">
          <Text className="text-sm text-gray-400">Proposito</Text>
          <Text className="text-sm text-gray-900 font-semibold">
            {PURPOSE_LABELS[selectedPurpose] || selectedPurpose}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-gray-400">Hora</Text>
          <Text className="text-sm text-gray-900 font-semibold">{timeStr}</Text>
        </View>
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
