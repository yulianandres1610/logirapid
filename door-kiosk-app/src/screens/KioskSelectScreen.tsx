import React from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'
import type { AvailableKiosk } from '../store/types'

export function KioskSelectScreen() {
  const guard = useKioskStore(s => s.guard)
  const kiosks = useKioskStore(s => s.availableKiosks)
  const selectKiosk = useKioskStore(s => s.selectKiosk)
  const logoutFull = useKioskStore(s => s.logoutFull)

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-6 pt-10" contentContainerStyle={{ alignItems: 'center' }}>
        {/* Header */}
        <View className="items-center mb-8">
          <View
            className="w-16 h-16 bg-orange-500 rounded-3xl items-center justify-center mb-4"
            style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 }}
          >
            <Text className="text-2xl">🚪</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 tracking-tight">Seleccionar Puerta</Text>
          {guard && (
            <Text className="text-sm text-gray-400 mt-1">
              {guard.name}
            </Text>
          )}
        </View>

        {/* Kiosk list */}
        <View className="w-full max-w-[340px] gap-3">
          {kiosks.map((kiosk: AvailableKiosk) => (
            <Pressable
              key={kiosk.id}
              onPress={() => selectKiosk(kiosk)}
              className="bg-white rounded-2xl p-4 active:bg-orange-50"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                  <Text className="text-xl">🚪</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">
                    {kiosk.name}
                  </Text>
                  {kiosk.location && (
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {kiosk.location}
                    </Text>
                  )}
                </View>
                <View className="w-8 h-8 bg-orange-50 rounded-full items-center justify-center">
                  <Text className="text-orange-500 text-sm font-bold">→</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {kiosks.length === 0 && (
          <View className="bg-orange-50 rounded-2xl p-5 w-full max-w-[340px] items-center">
            <Text className="text-sm text-orange-600 font-medium">
              No hay puertas disponibles
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Back */}
      <View className="px-6 pb-8 pt-3">
        <Pressable onPress={logoutFull} className="py-3 items-center active:opacity-60">
          <Text className="text-gray-400 text-sm font-medium">← Volver al inicio</Text>
        </Pressable>
      </View>
    </View>
  )
}
