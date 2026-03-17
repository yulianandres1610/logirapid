import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'

interface CountdownCircleProps {
  seconds: number
  onComplete: () => void
  color?: string
}

export function CountdownCircle({ seconds, onComplete, color = 'text-green-600' }: CountdownCircleProps) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) {
      onComplete()
      return
    }

    const timer = setTimeout(() => setRemaining(remaining - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining, onComplete])

  return (
    <View className="w-12 h-12 rounded-full border-2 border-gray-200 items-center justify-center">
      <Text className={`text-lg font-bold ${color}`}>{remaining}</Text>
    </View>
  )
}
