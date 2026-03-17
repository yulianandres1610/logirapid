import React, { useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

const PURPOSES = [
  { id: 'compra', label: 'Compra', icon: '🛒' },
  { id: 'reunion', label: 'Reunion', icon: '🤝' },
  { id: 'empleado', label: 'Empleado', icon: '🏢' },
  { id: 'otro', label: 'Otro', icon: '✏️' },
]

export function PurposeSelectScreen() {
  const visitor = useKioskStore(s => s.visitor)
  const selectPurpose = useKioskStore(s => s.selectPurpose)
  const [showOtroInput, setShowOtroInput] = useState(false)
  const [otroNote, setOtroNote] = useState('')

  // Parse date manually to avoid timezone shift
  const formatDob = (dob: string | null) => {
    if (!dob) return null
    // Handle "1983-02-16" or "1983-02-16T00:00:00.000Z"
    const dateOnly = dob.split('T')[0]
    const parts = dateOnly.split('-')
    if (parts.length === 3) {
      const dd = parts[2].padStart(2, '0')
      const mm = parts[1].padStart(2, '0')
      return `${dd}/${mm}/${parts[0]}`
    }
    return dob
  }

  const handlePurpose = (id: string) => {
    if (id === 'otro') {
      setShowOtroInput(true)
    } else {
      selectPurpose(id)
    }
  }

  const handleOtroSubmit = () => {
    const note = otroNote.trim()
    selectPurpose(note || 'otro')
  }

  if (showOtroInput) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View
          className="bg-white rounded-3xl w-full max-w-[320px] p-5"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 }}
        >
          <Text className="text-lg font-bold text-gray-900 mb-1 text-center">Motivo de visita</Text>
          <Text className="text-sm text-gray-400 mb-4 text-center">{visitor?.fullName}</Text>

          <TextInput
            className="bg-gray-50 rounded-2xl px-4 py-3 text-base text-gray-900 border border-gray-200 mb-4"
            placeholder="Escriba el motivo..."
            placeholderTextColor="#9ca3af"
            value={otroNote}
            onChangeText={setOtroNote}
            autoFocus
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <Pressable
            onPress={handleOtroSubmit}
            className="w-full py-3.5 bg-orange-500 rounded-2xl items-center active:bg-orange-600 mb-2"
            style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }}
          >
            <Text className="text-white text-base font-bold">Confirmar</Text>
          </Pressable>

          <Pressable
            onPress={() => { setShowOtroInput(false); setOtroNote('') }}
            className="w-full py-2.5 items-center active:opacity-60"
          >
            <Text className="text-gray-400 text-sm font-medium">Cancelar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50 px-5 pt-4">
      {/* Visitor info card */}
      <View
        className="bg-white rounded-3xl p-4 mb-4"
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
      >
        <View className="flex-row items-center">
          <View
            className="w-12 h-12 bg-orange-500 rounded-2xl items-center justify-center mr-3"
            style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}
          >
            <Text className="text-white text-lg font-black">ID</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
              {visitor?.fullName}
            </Text>
            <View className="flex-row gap-3 mt-0.5">
              <Text className="text-xs text-gray-400">
                CI: <Text className="text-gray-600 font-semibold">{visitor?.idNumber}</Text>
              </Text>
              {visitor?.dateOfBirth && (
                <Text className="text-xs text-gray-400">
                  Nac: <Text className="text-gray-600 font-semibold">{formatDob(visitor.dateOfBirth)}</Text>
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Section title */}
      <Text className="text-xs font-bold text-gray-400 tracking-wide mb-3 px-1">PROPOSITO DE VISITA</Text>

      {/* Purpose grid — fill remaining space */}
      <View className="flex-1">
        <View className="flex-row gap-3 mb-3 flex-1">
          {PURPOSES.slice(0, 2).map(p => (
            <Pressable
              key={p.id}
              onPress={() => handlePurpose(p.id)}
              className="flex-1 bg-white rounded-3xl items-center justify-center active:bg-orange-50"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
            >
              <View
                className="w-16 h-16 bg-orange-500 rounded-2xl items-center justify-center mb-2"
                style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}
              >
                <Text style={{ fontSize: 28 }}>{p.icon}</Text>
              </View>
              <Text className="text-sm font-bold text-gray-900">{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-3 mb-4 flex-1">
          {PURPOSES.slice(2).map(p => (
            <Pressable
              key={p.id}
              onPress={() => handlePurpose(p.id)}
              className="flex-1 bg-white rounded-3xl items-center justify-center active:bg-orange-50"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
            >
              <View
                className={`w-16 h-16 rounded-2xl items-center justify-center mb-2 ${
                  p.id === 'otro' ? 'bg-orange-300' : 'bg-orange-500'
                }`}
                style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}
              >
                <Text style={{ fontSize: 28 }}>{p.icon}</Text>
              </View>
              <Text className="text-sm font-bold text-gray-900">{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}
