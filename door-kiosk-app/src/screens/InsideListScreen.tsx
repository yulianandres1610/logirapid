import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

function ElapsedTime({ entryTime }: { entryTime: string }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const diffMs = now - new Date(entryTime).getTime()
  if (diffMs < 0) return <Text className="text-xs text-gray-400">--</Text>

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let timeStr = ''
  if (days > 0) {
    timeStr = `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    timeStr = `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    timeStr = `${minutes}m ${seconds}s`
  } else {
    timeStr = `${seconds}s`
  }

  return (
    <Text className="text-xs font-bold text-orange-500">{timeStr}</Text>
  )
}

const PURPOSE_LABELS: Record<string, string> = {
  compra: 'Compra',
  reunion: 'Reunion',
  empleado: 'Empleado',
  entrega: 'Entrega',
  otro: 'Otro',
}

export function InsideListScreen() {
  const todayLogs = useKioskStore(s => s.todayLogs)
  const hideInsideVisitors = useKioskStore(s => s.hideInsideVisitors)

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className="px-5 pt-3 pb-3 bg-white flex-row items-center justify-between"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
      >
        <View>
          <Text className="text-xl font-bold text-gray-900 tracking-tight">Visitantes Dentro</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{todayLogs.length} persona{todayLogs.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          onPress={hideInsideVisitors}
          className="px-4 py-2.5 bg-gray-100 rounded-2xl active:bg-gray-200"
        >
          <Text className="text-xs font-bold text-gray-500">← Volver</Text>
        </Pressable>
      </View>

      {todayLogs.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-gray-400 text-sm mt-3 font-medium">Cargando...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-3">
          <View className="gap-2 pb-4">
            {todayLogs.map(log => (
              <View
                key={log.id}
                className="bg-white p-3.5 rounded-2xl"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-orange-500 rounded-xl items-center justify-center mr-3">
                    <Text className="text-white text-sm font-black">
                      {log.visitorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                      {log.visitorName}
                    </Text>
                    <Text className="text-xs text-gray-400">{log.idNumber}</Text>
                  </View>
                  <View className="items-end">
                    <ElapsedTime entryTime={log.entryTime} />
                  </View>
                </View>

                {/* Purpose + entry time row */}
                <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                  {log.visitPurpose && (
                    <View className="px-2.5 py-1 bg-orange-50 rounded-full mr-2">
                      <Text className="text-[10px] font-bold text-orange-500">
                        {PURPOSE_LABELS[log.visitPurpose] || log.visitPurpose}
                      </Text>
                    </View>
                  )}
                  <Text className="text-[10px] text-gray-400 ml-auto">
                    Entrada: {new Date(log.entryTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
