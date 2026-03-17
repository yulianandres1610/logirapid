import React from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

export function TodayLogScreen() {
  const todayLogs = useKioskStore(s => s.todayLogs)
  const hideTodayLog = useKioskStore(s => s.hideTodayLog)

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '--:--'
    }
  }

  const insideCount = todayLogs.filter(l => !l.exitTime).length
  const exitedCount = todayLogs.filter(l => l.exitTime).length

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className="px-5 pt-3 pb-3 bg-white flex-row items-center justify-between"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
      >
        <View>
          <Text className="text-xl font-bold text-gray-900 tracking-tight">Registro de Hoy</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{todayLogs.length} registros</Text>
        </View>
        <Pressable
          onPress={hideTodayLog}
          className="px-4 py-2.5 bg-gray-100 rounded-2xl active:bg-gray-200"
        >
          <Text className="text-xs font-bold text-gray-500">← Volver</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      <View className="px-5 py-3 flex-row gap-3">
        <View className="flex-1 bg-orange-500 rounded-2xl py-3 items-center"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 }}>
          <Text className="text-2xl font-black text-white">{insideCount}</Text>
          <Text className="text-[10px] text-white/80 font-bold tracking-wide">DENTRO</Text>
        </View>
        <View className="flex-1 bg-orange-400 rounded-2xl py-3 items-center"
          style={{ shadowColor: '#fb923c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 }}>
          <Text className="text-2xl font-black text-white">{exitedCount}</Text>
          <Text className="text-[10px] text-white/80 font-bold tracking-wide">SALIERON</Text>
        </View>
        <View className="flex-1 bg-orange-600 rounded-2xl py-3 items-center"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 }}>
          <Text className="text-2xl font-black text-white">{todayLogs.length}</Text>
          <Text className="text-[10px] text-white/80 font-bold tracking-wide">TOTAL</Text>
        </View>
      </View>

      {todayLogs.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-gray-400 text-sm mt-3 font-medium">Cargando registros...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5">
          <View className="gap-2 pb-4">
            {todayLogs.map(log => (
              <View
                key={log.id}
                className="flex-row items-center bg-white p-3 rounded-2xl"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              >
                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                  log.exitTime ? 'bg-orange-100' : 'bg-orange-50'
                }`}>
                  <Text className="text-lg">{log.exitTime ? '↙' : '↗'}</Text>
                </View>

                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                    {log.visitorName}
                  </Text>
                  <Text className="text-xs text-gray-400">{log.idNumber}</Text>
                </View>

                <View className="items-end">
                  <Text className="text-xs text-orange-500 font-semibold">
                    {formatTime(log.entryTime)}
                  </Text>
                  {log.exitTime ? (
                    <Text className="text-xs text-orange-400 font-semibold">
                      {formatTime(log.exitTime)}
                    </Text>
                  ) : (
                    <View className="mt-0.5 px-2 py-0.5 bg-orange-500 rounded-full">
                      <Text className="text-[9px] text-white font-bold">DENTRO</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
