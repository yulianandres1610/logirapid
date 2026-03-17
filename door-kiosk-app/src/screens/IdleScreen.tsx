import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'
import { useClock } from '../hooks/useClock'
import { useBattery } from '../hooks/useBattery'

export function IdleScreen() {
  const kioskName = useKioskStore(s => s.kiosk?.name ?? 'Kiosk')
  const guardName = useKioskStore(s => s.guard?.name ?? '')
  const stats = useKioskStore(s => s.stats)
  const errorMessage = useKioskStore(s => s.errorMessage)
  const step = useKioskStore(s => s.step)
  const logoutGuard = useKioskStore(s => s.logoutGuard)
  const showTodayLog = useKioskStore(s => s.showTodayLog)
  const showInsideVisitors = useKioskStore(s => s.showInsideVisitors)
  const enterPrintMode = useKioskStore(s => s.enterPrintMode)
  const time = useClock()
  const battery = useBattery()

  const timeStr = time.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const dateStr = time.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const openSettings = () => {
    useKioskStore.setState({ step: 'settings' as any })
  }

  // Battery color logic: green > 50, yellow 21-50, red <= 20
  const getBatteryBarColor = () => {
    if (battery.level > 50) return 'bg-green-500'
    if (battery.level > 20) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getBatteryTextColor = () => {
    if (battery.level > 50) return 'text-green-600'
    if (battery.level > 20) return 'text-yellow-600'
    return 'text-red-500'
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Status bar - like a phone */}
      <View className="px-4 pt-2 pb-1.5 flex-row items-center justify-between bg-gray-50">
        {/* Battery indicator */}
        {battery.level >= 0 && (
          <View className="flex-row items-center gap-1.5">
            <View className="w-7 h-3.5 rounded-sm border border-gray-400 overflow-hidden relative">
              <View
                className={`h-full ${getBatteryBarColor()}`}
                style={{ width: `${Math.max(8, battery.level)}%` }}
              />
            </View>
            <View className="w-1 h-1.5 bg-gray-400 rounded-r-sm -ml-1" />
            <Text className={`text-xs font-bold ${getBatteryTextColor()}`}>
              {battery.level}%
            </Text>
            {battery.charging && (
              <Text className="text-xs text-green-500 font-bold">+</Text>
            )}
          </View>
        )}
        {/* Settings & Logout */}
        <View className="flex-row items-center gap-2 ml-auto">
          <Pressable
            onPress={openSettings}
            className="w-8 h-8 bg-white rounded-full items-center justify-center active:bg-gray-100"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }}
          >
            <Text className="text-gray-400 text-sm">&#9881;</Text>
          </Pressable>
          <Pressable
            onPress={logoutGuard}
            className="px-3 py-1.5 bg-white rounded-full active:bg-gray-100"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }}
          >
            <Text className="text-xs font-semibold text-gray-400">Salir</Text>
          </Pressable>
        </View>
      </View>

      {/* Guard & Kiosk info */}
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-center gap-2.5">
          <View className="w-9 h-9 bg-orange-500 rounded-xl items-center justify-center">
            <Text className="text-white text-[11px] font-black">LR</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
              {guardName}
            </Text>
            <Text className="text-xs text-gray-400 font-medium" numberOfLines={1}>
              {kioskName}
            </Text>
          </View>
        </View>
      </View>

      {/* Clock - centered and prominent */}
      <View className="items-center pt-4 pb-5">
        <Text
          className="font-black text-gray-900 tracking-tighter"
          style={{ fontSize: 72, lineHeight: 76 }}
        >
          {timeStr}
        </Text>
        <Text className="text-sm text-gray-400 capitalize mt-2 font-medium">{dateStr}</Text>
      </View>

      {/* Stats cards */}
      <View className="px-5 mb-5">
        <View className="flex-row gap-3">
          <Pressable
            onPress={showInsideVisitors}
            className="flex-1 bg-white rounded-2xl py-5 items-center active:bg-orange-50"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Text className="text-xs text-gray-400 font-semibold tracking-wider mb-2">DENTRO</Text>
            <Text
              className="font-black text-orange-500"
              style={{ fontSize: 36, lineHeight: 40 }}
            >
              {stats?.visitorsInside ?? 0}
            </Text>
          </Pressable>

          <Pressable
            onPress={showTodayLog}
            className="flex-1 bg-white rounded-2xl py-5 items-center active:bg-orange-50"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          >
            <Text className="text-xs text-gray-400 font-semibold tracking-wider mb-2">HOY</Text>
            <Text
              className="font-black text-orange-500"
              style={{ fontSize: 36, lineHeight: 40 }}
            >
              {stats?.totalVisitorsToday ?? 0}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Scan prompt */}
      <View className="flex-1 items-center justify-center px-6 pb-4">
        <View
          className="w-24 h-24 bg-orange-500 rounded-3xl items-center justify-center mb-4"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }}
        >
          <Text className="text-white text-2xl font-black">ID</Text>
        </View>
        <Text className="text-xl font-bold text-gray-900 tracking-tight">Escanee el carnet</Text>
        <Text className="text-xs text-gray-400 mt-1 font-medium">de identidad del visitante</Text>
      </View>

      {/* Print Label button */}
      <View className="px-5 pb-4">
        <Pressable
          onPress={enterPrintMode}
          className="bg-white rounded-2xl py-3.5 flex-row items-center justify-center active:bg-orange-50"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
        >
          <Text className="text-orange-500 text-sm font-bold">Imprimir Etiqueta</Text>
        </Pressable>
      </View>

      {/* Error overlay */}
      {step === 'error' && errorMessage ? (
        <View
          className="absolute bottom-4 left-4 right-4 bg-red-500 rounded-2xl p-4"
          style={{ shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 }}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center">
              <Text className="text-white text-lg font-bold">!</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-bold">{errorMessage}</Text>
              <Text className="text-white/70 text-xs mt-0.5">Intente de nuevo</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
