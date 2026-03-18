import React from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'

interface QuantityInputProps {
  value: number
  onChange: (qty: number) => void
  min?: number
  max?: number
  colors: {
    inputBg: string
    inputBorder: string
    text: string
    textMuted: string
  }
  isDark: boolean
}

export function QuantityInput({ value, onChange, min = 0, max, colors, isDark }: QuantityInputProps) {
  const decrement = () => {
    const next = value - 1
    if (next >= min) onChange(next)
  }

  const increment = () => {
    if (max !== undefined && value >= max) return
    onChange(value + 1)
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.inputBg, borderRadius: 12,
      borderWidth: 1, borderColor: colors.inputBorder,
    }}>
      <TouchableOpacity
        onPress={decrement}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        activeOpacity={0.6}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textMuted }}>−</Text>
      </TouchableOpacity>
      <TextInput
        value={String(value)}
        onChangeText={(t) => {
          const n = parseInt(t, 10)
          if (!isNaN(n) && n >= min && (max === undefined || n <= max)) onChange(n)
        }}
        keyboardType="numeric"
        style={{
          width: 48, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text,
        }}
        selectTextOnFocus
      />
      <TouchableOpacity
        onPress={increment}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        activeOpacity={0.6}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#eb5b0c' }}>+</Text>
      </TouchableOpacity>
    </View>
  )
}
