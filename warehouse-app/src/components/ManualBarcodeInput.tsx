import React, { useState } from 'react'
import { View, TextInput, TouchableOpacity, Text } from 'react-native'

interface ManualBarcodeInputProps {
  onSubmit: (barcode: string) => void
  placeholder?: string
}

export function ManualBarcodeInput({ onSubmit, placeholder = 'Código de barras...' }: ManualBarcodeInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
      setValue('')
    }
  }

  return (
    <View className="flex-row items-center gap-2 mb-4">
      <View className="flex-1 bg-white border border-dark-200 rounded-2xl flex-row items-center px-4">
        <Text className="text-dark-300 mr-2">🔎</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor="#a8a29e"
          className="flex-1 py-3 text-sm text-dark-800"
          returnKeyType="search"
          autoCapitalize="none"
        />
      </View>
      <TouchableOpacity
        onPress={handleSubmit}
        className="bg-brand-500 rounded-2xl px-5 py-3.5"
        activeOpacity={0.8}
        style={{ shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
      >
        <Text className="text-white font-bold text-sm">Buscar</Text>
      </TouchableOpacity>
    </View>
  )
}
