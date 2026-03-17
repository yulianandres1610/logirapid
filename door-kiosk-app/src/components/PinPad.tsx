import React from 'react'
import { View, Text, Pressable } from 'react-native'

interface PinPadProps {
  onDigit: (digit: string) => void
  onDelete: () => void
  disabled?: boolean
}

const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const

export function PinPad({ onDigit, onDelete, disabled }: PinPadProps) {
  return (
    <View className="gap-2">
      {[0, 1, 2, 3].map(row => (
        <View key={row} className="flex-row gap-2">
          {keys.slice(row * 3, row * 3 + 3).map((key, i) => {
            if (key === null) {
              return <View key={`empty-${i}`} className="flex-1 h-14" />
            }

            const isDel = key === 'del'

            return (
              <Pressable
                key={`key-${key}`}
                onPress={() => {
                  if (isDel) onDelete()
                  else onDigit(key.toString())
                }}
                disabled={disabled}
                className={`flex-1 h-14 rounded-2xl items-center justify-center ${
                  isDel
                    ? 'bg-gray-100 active:bg-gray-200'
                    : 'bg-white border border-gray-100 active:bg-orange-50 active:border-orange-300'
                } ${disabled ? 'opacity-40' : ''}`}
                style={!isDel ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                } : {}}
              >
                <Text
                  className={`font-semibold ${
                    isDel ? 'text-gray-500 text-lg' : 'text-gray-800 text-xl'
                  }`}
                >
                  {isDel ? '⌫' : key}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ))}
    </View>
  )
}
