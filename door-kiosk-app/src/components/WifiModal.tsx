import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native'

const { SystemInfo } = NativeModules

interface WifiNetwork {
  ssid: string
  level: number
  secure: boolean
}

interface WifiModalProps {
  visible: boolean
  onClose: () => void
}

export function WifiModal({ visible, onClose }: WifiModalProps) {
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
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        )
      } catch {
        // ignore
      }
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
    if (visible) {
      scanNetworks()
    } else {
      setSelectedNetwork(null)
      setPassword('')
      setMessage('')
    }
  }, [visible])

  const handleConnect = async () => {
    if (!selectedNetwork) return
    setConnecting(true)
    setMessage('')
    try {
      const result = await SystemInfo.connectToWifi(selectedNetwork.ssid, password)
      setMessage(result || 'Conectado')
      setSelectedNetwork(null)
      setPassword('')
      // Re-scan after connecting
      setTimeout(scanNetworks, 3000)
    } catch (e: any) {
      setMessage(e.message || 'Error al conectar')
    }
    setConnecting(false)
  }

  const signalBars = (level: number) => {
    const bars = ['▁', '▂', '▃', '▅', '█']
    return bars.slice(0, Math.max(1, level + 1)).join('')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="bg-white rounded-t-3xl max-h-[85%]"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 }}
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-gray-100">
            <View>
              <Text className="text-lg font-bold text-gray-900">Redes WiFi</Text>
              {currentSsid ? (
                <Text className="text-xs text-orange-500 font-medium mt-0.5">
                  Conectado: {currentSsid}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={scanNetworks}
                className="px-3 py-2 bg-orange-50 rounded-xl active:bg-orange-100"
              >
                <Text className="text-xs font-bold text-orange-500">Buscar</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                className="px-3 py-2 bg-gray-100 rounded-xl active:bg-gray-200"
              >
                <Text className="text-xs font-bold text-gray-500">Cerrar</Text>
              </Pressable>
            </View>
          </View>

          {/* Password input for selected network */}
          {selectedNetwork && (
            <View className="px-5 py-3 bg-orange-50 border-b border-orange-100">
              <Text className="text-sm font-bold text-gray-900 mb-2">
                {selectedNetwork.ssid}
              </Text>
              {selectedNetwork.secure ? (
                <>
                  <TextInput
                    className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-900 border border-gray-200 mb-2"
                    placeholder="Contrasena WiFi"
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
                      <Text className="text-gray-600 text-sm font-medium">Cancel</Text>
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
            <View className="px-5 py-2 bg-gray-50">
              <Text className="text-xs text-gray-600 font-medium">{message}</Text>
            </View>
          ) : null}

          {/* Network list */}
          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#f97316" />
              <Text className="text-gray-400 text-sm mt-3">Buscando redes...</Text>
            </View>
          ) : (
            <ScrollView className="px-5 py-2" style={{ maxHeight: 400 }}>
              <View className="gap-1.5 pb-4">
                {networks.map(net => (
                  <Pressable
                    key={net.ssid}
                    onPress={() => { setSelectedNetwork(net); setPassword(''); setMessage('') }}
                    className={`flex-row items-center p-3 rounded-2xl active:bg-orange-50 ${
                      currentSsid === net.ssid ? 'bg-orange-50' : 'bg-white'
                    }`}
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}
                  >
                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                      currentSsid === net.ssid ? 'bg-orange-500' : 'bg-gray-100'
                    }`}>
                      <Text className={`text-sm ${currentSsid === net.ssid ? 'text-white' : 'text-gray-600'}`}>
                        {signalBars(net.level)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">{net.ssid}</Text>
                      <Text className="text-xs text-gray-400">
                        {net.secure ? 'Protegida' : 'Abierta'}
                        {currentSsid === net.ssid ? ' • Conectada' : ''}
                      </Text>
                    </View>
                    {currentSsid === net.ssid && (
                      <Text className="text-orange-500 text-xs font-bold">✓</Text>
                    )}
                  </Pressable>
                ))}
                {networks.length === 0 && !loading && (
                  <View className="py-6 items-center">
                    <Text className="text-gray-400 text-sm">No se encontraron redes</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}
