import React, { useState, useEffect } from 'react'
import { View, Text, ActivityIndicator, Pressable, Image } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'
import { PinPad } from '../components/PinPad'

export function GuardPinScreen() {
  const kioskName = useKioskStore(s => s.kiosk?.name ?? 'Control de Acceso')
  const kioskLocation = useKioskStore(s => s.kiosk?.location)
  const companyLogo = useKioskStore(s => s.kiosk?.companyLogo)
  const authenticateGuard = useKioskStore(s => s.authenticateGuard)
  const logoutFull = useKioskStore(s => s.logoutFull)

  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pin.length >= 4 && !loading) {
      verifyPin()
    }
  }, [pin])

  const verifyPin = async () => {
    if (pin.length < 4) return
    setLoading(true)
    setError(null)

    const success = await authenticateGuard(pin)
    if (!success) {
      setError('PIN invalido')
      setPin('')
    }
    setLoading(false)
  }

  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-6">
      {/* Company logo + kiosk name */}
      <View className="items-center mb-5">
        {companyLogo ? (
          <Image
            source={{ uri: companyLogo }}
            className="w-20 h-20 rounded-2xl mb-3"
            resizeMode="contain"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 }}
          />
        ) : (
          <View
            className="w-16 h-16 bg-orange-500 rounded-2xl items-center justify-center mb-3"
            style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
          >
            <Text className="text-white text-xl">🛡</Text>
          </View>
        )}
        <Text className="text-xl font-bold text-gray-900 tracking-tight">{kioskName}</Text>
        {kioskLocation && (
          <Text className="text-xs text-gray-400 mt-1">{kioskLocation}</Text>
        )}
      </View>

      {/* Card — PIN dots + keypad only */}
      <View
        className="bg-white rounded-3xl w-full max-w-[320px] px-6 py-5"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 10 }}
      >
        {/* Error */}
        {error && (
          <View className="mb-3 p-2.5 bg-red-50 rounded-xl flex-row items-center gap-2">
            <View className="w-6 h-6 bg-red-100 rounded-full items-center justify-center">
              <Text className="text-red-500 text-[10px]">!</Text>
            </View>
            <Text className="text-red-600 text-sm flex-1 font-medium">{error}</Text>
          </View>
        )}

        {/* PIN dots */}
        <View className="flex-row justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              className={`w-12 h-12 rounded-2xl items-center justify-center ${
                i < pin.length ? 'bg-orange-500' : 'bg-gray-100'
              }`}
              style={i < pin.length ? {
                shadowColor: '#ea580c',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              } : {}}
            >
              <View className={`w-2.5 h-2.5 rounded-full ${i < pin.length ? 'bg-white' : 'bg-gray-300'}`} />
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
          <View className="flex-row items-center justify-center gap-2 mt-3">
            <ActivityIndicator size="small" color="#f97316" />
            <Text className="text-sm text-orange-500 font-medium">Verificando...</Text>
          </View>
        )}
      </View>

      {/* Change kiosk */}
      <Pressable onPress={logoutFull} className="mt-5 py-2 px-4 active:opacity-60">
        <Text className="text-sm text-gray-400 font-medium">Cambiar puerta</Text>
      </Pressable>
    </View>
  )
}
