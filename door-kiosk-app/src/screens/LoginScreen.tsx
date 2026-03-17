import React, { useState, useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'
import { PinPad } from '../components/PinPad'

export function LoginScreen() {
  const loginGuard = useKioskStore(s => s.loginGuard)

  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pin.length >= 4 && !loading) {
      doLogin()
    }
  }, [pin])

  const doLogin = async () => {
    if (pin.length < 4) return
    setLoading(true)
    setError(null)

    const result = await loginGuard(pin)
    if (!result.success) {
      setError(result.error || 'PIN invalido')
      setPin('')
    }
    setLoading(false)
  }

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-6">
      {/* Brand header */}
      <View className="items-center mb-6">
        <View
          className="w-16 h-16 bg-orange-500 rounded-3xl items-center justify-center mb-4"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 }}
        >
          <Text className="text-white text-2xl font-bold">🛡</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900 tracking-tight">Control de Acceso</Text>
        <Text className="text-sm text-gray-400 mt-1">Ingrese su PIN de guardia</Text>
      </View>

      {/* Card */}
      <View
        className="bg-white rounded-3xl w-full max-w-[320px] px-6 py-6"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 10 }}
      >
        {/* Error */}
        {error && (
          <View className="mb-4 p-3 bg-red-50 rounded-2xl flex-row items-center gap-2">
            <View className="w-7 h-7 bg-red-100 rounded-full items-center justify-center">
              <Text className="text-red-500 text-xs">!</Text>
            </View>
            <Text className="text-red-600 text-sm flex-1 font-medium">{error}</Text>
          </View>
        )}

        {/* PIN dots */}
        <View className="flex-row justify-center gap-3 mb-5">
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              className={`w-14 h-14 rounded-2xl items-center justify-center ${
                i < pin.length
                  ? 'bg-orange-500'
                  : 'bg-gray-100'
              }`}
              style={i < pin.length ? {
                shadowColor: '#ea580c',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              } : {}}
            >
              <View
                className={`w-3 h-3 rounded-full ${
                  i < pin.length ? 'bg-white' : 'bg-gray-300'
                }`}
              />
            </View>
          ))}
        </View>

        {/* Keypad */}
        <PinPad
          onDigit={(d) => {
            if (pin.length < 4) {
              setPin(prev => prev + d)
              setError(null)
            }
          }}
          onDelete={() => {
            setPin(prev => prev.slice(0, -1))
            setError(null)
          }}
          disabled={loading}
        />

        {loading && (
          <View className="flex-row items-center justify-center gap-2 mt-4">
            <ActivityIndicator size="small" color="#f97316" />
            <Text className="text-sm text-orange-500 font-medium">Autenticando...</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <Text className="text-xs text-gray-300 mt-6 font-medium tracking-wider">
        LogiRapid
      </Text>
    </View>
  )
}
