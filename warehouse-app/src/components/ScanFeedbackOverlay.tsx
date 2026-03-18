import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'

interface ScanFeedbackOverlayProps {
  type: 'success' | 'error' | null
  message?: string
}

export function ScanFeedbackOverlay({ type, message }: ScanFeedbackOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (type) {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 500)
      return () => clearTimeout(timer)
    }
  }, [type])

  if (!visible || !type) return null

  return (
    <View
      className={`absolute inset-0 items-center justify-center z-50 ${
        type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
      }`}
      pointerEvents="none"
    >
      <View
        className={`rounded-3xl w-20 h-20 items-center justify-center ${
          type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}
        style={{
          shadowColor: type === 'success' ? '#10b981' : '#ef4444',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text className="text-white text-3xl font-black">
          {type === 'success' ? '✓' : '✕'}
        </Text>
      </View>
      {message && (
        <Text className="text-white text-base font-bold mt-3 text-center px-4 bg-dark-800/70 rounded-2xl py-2">
          {message}
        </Text>
      )}
    </View>
  )
}
