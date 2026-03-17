import React from 'react'
import { Text, Pressable } from 'react-native'

interface PurposeButtonProps {
  label: string
  emoji: string
  onPress: () => void
  disabled?: boolean
}

export function PurposeButton({ label, emoji, onPress, disabled }: PurposeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 min-h-[80px] bg-white rounded-2xl border-2 border-orange-200 items-center justify-center p-3 active:bg-orange-50 active:border-orange-400 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <Text className="text-2xl mb-1">{emoji}</Text>
      <Text className="text-sm font-semibold text-gray-800 text-center">{label}</Text>
    </Pressable>
  )
}
