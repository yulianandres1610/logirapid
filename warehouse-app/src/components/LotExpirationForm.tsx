import React, { useState } from 'react'
import { View, Text, TextInput } from 'react-native'
import { Button } from './ui/Button'

interface LotExpirationFormProps {
  onConfirm: (lotNumber: string, expirationDate: string) => void
  onSkip?: () => void
}

export function LotExpirationForm({ onConfirm, onSkip }: LotExpirationFormProps) {
  const [lotNumber, setLotNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')

  return (
    <View
      className="bg-brand-50 rounded-2xl p-4 mt-2 border border-brand-100"
      style={{ shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
    >
      <Text className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Lote y Vencimiento</Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-xs text-dark-400 mb-1 font-medium">Lote</Text>
          <TextInput
            value={lotNumber}
            onChangeText={setLotNumber}
            placeholder="Ej: LOT-2026-001"
            placeholderTextColor="#a8a29e"
            className="bg-white border border-dark-200 rounded-2xl px-3 py-2.5 text-sm text-dark-800"
          />
        </View>
        <View className="flex-1">
          <Text className="text-xs text-dark-400 mb-1 font-medium">Vencimiento</Text>
          <TextInput
            value={expirationDate}
            onChangeText={setExpirationDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#a8a29e"
            className="bg-white border border-dark-200 rounded-2xl px-3 py-2.5 text-sm text-dark-800"
          />
        </View>
      </View>
      <View className="flex-row gap-2 mt-3">
        {onSkip && (
          <Button variant="ghost" size="sm" onPress={onSkip}>
            Omitir
          </Button>
        )}
        <Button
          size="sm"
          onPress={() => onConfirm(lotNumber, expirationDate)}
          disabled={!lotNumber}
        >
          Confirmar
        </Button>
      </View>
    </View>
  )
}
