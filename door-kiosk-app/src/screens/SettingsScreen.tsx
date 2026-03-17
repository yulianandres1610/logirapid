import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native'
import { useKioskStore } from '../store/kiosk-store'
import { useBattery } from '../hooks/useBattery'

const { SystemInfo } = NativeModules

interface WifiNetwork {
  ssid: string
  level: number
  secure: boolean
}

export function SettingsScreen() {
  const kioskName = useKioskStore(s => s.kiosk?.name ?? 'Kiosk')
  const goBack = useCallback(() => {
    useKioskStore.setState({ step: 'idle' })
  }, [])

  const battery = useBattery()
  const [networks, setNetworks] = useState<WifiNetwork[]>([])
  const [loading, setLoading] = useState(false)
  const [currentSsid, setCurrentSsid] = useState('')
  const [selectedNetwork, setSelectedNetwork] = useState<WifiNetwork | null>(null)
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
      } catch {}
    }
  }

  const scanNetworks = async () => {
    setLoading(true)
    setMessage('')
    try {
      await requestPermissions()
      const current = await SystemInfo.getCurrentWifi()
      setCurrentSsid(current || '')
      const list = await SystemInfo.getWifiList()
      setNetworks(list || [])
    } catch (e: any) {
      setMessage(e.message || 'Error al escanear')
    }
    setLoading(false)
  }

  useEffect(() => {
    scanNetworks()
  }, [])

  const handleConnect = async () => {
    if (!selectedNetwork) return
    setConnecting(true)
    setMessage('')
    try {
      const result = await SystemInfo.connectToWifi(selectedNetwork.ssid, password)
      setMessage(result || 'Conectado')
      setSelectedNetwork(null)
      setPassword('')
      setTimeout(scanNetworks, 3000)
    } catch (e: any) {
      setMessage(e.message || 'Error al conectar')
    }
    setConnecting(false)
  }

  const getBatteryColor = () => {
    if (battery.charging) return 'text-orange-500'
    if (battery.level > 50) return 'text-gray-700'
    if (battery.level > 20) return 'text-orange-500'
    return 'text-red-500'
  }

  const getBatteryBg = () => {
    if (battery.charging) return 'bg-orange-50'
    if (battery.level > 50) return 'bg-gray-50'
    if (battery.level > 20) return 'bg-orange-50'
    return 'bg-red-50'
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        className="px-5 pt-3 pb-3 bg-white flex-row items-center justify-between"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
      >
        <View>
          <Text className="text-xl font-bold text-gray-900 tracking-tight">Configuracion</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{kioskName}</Text>
        </View>
        <Pressable
          onPress={goBack}
          className="px-4 py-2.5 bg-gray-100 rounded-2xl active:bg-gray-200"
        >
          <Text className="text-xs font-bold text-gray-500">← Volver</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5 pt-4">
        {/* Battery card */}
        <View
          className="bg-white rounded-3xl p-4 mb-4"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
        >
          <Text className="text-xs font-bold text-gray-400 tracking-wide mb-3">BATERIA</Text>
          <View className="flex-row items-center">
            <View className={`w-12 h-12 ${getBatteryBg()} rounded-2xl items-center justify-center mr-3`}>
              <Text className={`text-2xl font-black ${getBatteryColor()}`}>
                {battery.level >= 0 ? `${battery.level}` : '--'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {battery.level >= 0 ? `${battery.level}%` : 'Leyendo...'}
              </Text>
              <Text className="text-xs text-gray-400">
                {battery.charging ? 'Cargando' : 'En uso'}
              </Text>
            </View>
            {/* Battery bar */}
            <View className="w-20 h-8 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <View
                className={`h-full ${battery.level > 20 ? 'bg-orange-400' : 'bg-red-400'}`}
                style={{ width: `${Math.max(5, battery.level)}%` }}
              />
            </View>
          </View>
        </View>

        {/* WiFi section */}
        <View
          className="bg-white rounded-3xl p-4 mb-4"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-xs font-bold text-gray-400 tracking-wide">WIFI</Text>
              {currentSsid ? (
                <Text className="text-sm text-orange-500 font-semibold mt-0.5">{currentSsid}</Text>
              ) : (
                <Text className="text-sm text-gray-400 mt-0.5">No conectado</Text>
              )}
            </View>
            <Pressable
              onPress={scanNetworks}
              className="px-3 py-2 bg-orange-500 rounded-xl active:bg-orange-600"
              style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}
            >
              <Text className="text-xs font-bold text-white">Buscar</Text>
            </Pressable>
          </View>

          {/* Password input */}
          {selectedNetwork && (
            <View className="bg-orange-50 rounded-2xl p-3 mb-3">
              <Text className="text-sm font-bold text-gray-900 mb-2">
                {selectedNetwork.ssid}
              </Text>
              {selectedNetwork.secure ? (
                <>
                  <TextInput
                    className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-900 border border-gray-200 mb-2"
                    placeholder="Contrasena"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoFocus
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleConnect}
                      disabled={connecting || !password}
                      className={`flex-1 py-2.5 rounded-xl items-center ${
                        connecting || !password ? 'bg-gray-300' : 'bg-orange-500 active:bg-orange-600'
                      }`}
                    >
                      {connecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white text-sm font-bold">Conectar</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => { setSelectedNetwork(null); setPassword('') }}
                      className="px-4 py-2.5 bg-gray-200 rounded-xl active:bg-gray-300"
                    >
                      <Text className="text-gray-600 text-sm font-medium">X</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => { setPassword(''); handleConnect() }}
                  disabled={connecting}
                  className="py-2.5 bg-orange-500 rounded-xl items-center active:bg-orange-600"
                >
                  {connecting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-sm font-bold">Conectar (abierta)</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}

          {/* Message */}
          {message ? (
            <View className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
              <Text className="text-xs text-gray-600 font-medium">{message}</Text>
            </View>
          ) : null}

          {/* Network list */}
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="large" color="#f97316" />
              <Text className="text-gray-400 text-xs mt-2">Buscando redes...</Text>
            </View>
          ) : (
            <View className="gap-1.5">
              {networks.map(net => {
                const isConnected = currentSsid === net.ssid
                const bars = Math.max(1, net.level + 1)
                return (
                  <Pressable
                    key={net.ssid}
                    onPress={() => { setSelectedNetwork(net); setPassword(''); setMessage('') }}
                    className={`flex-row items-center p-3 rounded-2xl active:bg-orange-50 ${
                      isConnected ? 'bg-orange-50' : 'bg-gray-50'
                    }`}
                  >
                    {/* Signal bars */}
                    <View className="flex-row items-end gap-px mr-3 h-5">
                      {[1, 2, 3, 4].map(i => (
                        <View
                          key={i}
                          className={`w-1 rounded-sm ${
                            i <= bars
                              ? (isConnected ? 'bg-orange-500' : 'bg-gray-500')
                              : 'bg-gray-200'
                          }`}
                          style={{ height: 4 + i * 3 }}
                        />
                      ))}
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold ${isConnected ? 'text-orange-600' : 'text-gray-900'}`}>
                        {net.ssid}
                      </Text>
                      <Text className="text-[10px] text-gray-400">
                        {net.secure ? 'Protegida' : 'Abierta'}
                      </Text>
                    </View>
                    {isConnected && (
                      <View className="px-2 py-1 bg-orange-500 rounded-full">
                        <Text className="text-[9px] text-white font-bold">CONECTADA</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
              {networks.length === 0 && !loading && (
                <View className="py-4 items-center">
                  <Text className="text-gray-400 text-sm">No se encontraron redes</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
