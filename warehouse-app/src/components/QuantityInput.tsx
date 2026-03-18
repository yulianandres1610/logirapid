import React from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'

interface QuantityInputProps {
  value: number
  onChange: (qty: number) => void
  min?: number
  max?: number
}

export function QuantityInput({ value, onChange, min = 0, max }: QuantityInputProps) {
  const decrement = () => {
    const next = value - 1
    if (next >= min) onChange(next)
  }

  const increment = () => {
    if (max !== undefined && value >= max) return
    onChange(value + 1)
  }

  return (
    <View className="flex-row items-center bg-dark-50 rounded-xl border border-dark-200">
      <TouchableOpacity
        onPress={decrement}
        className="w-10 h-10 items-center justify-center"
        activeOpacity={0.6}
      >
        <Text className="text-lg font-bold text-dark-500">−</Text>
      </TouchableOpacity>
      <TextInput
        value={String(value)}
        onChangeText={(t) => {
          const n = parseInt(t, 10)
          if (!isNaN(n) && n >= min && (max === undefined || n <= max)) onChange(n)
        }}
        keyboardType="numeric"
        className="w-12 text-center text-base font-bold text-dark-800"
        selectTextOnFocus
      />
      <TouchableOpacity
        onPress={increment}
        className="w-10 h-10 items-center justify-center"
        activeOpacity={0.6}
      >
        <Text className="text-lg font-bold text-brand-500">+</Text>
      </TouchableOpacity>
    </View>
  )
}
