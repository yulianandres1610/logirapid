import React from 'react'
import { View, Text } from 'react-native'

interface CountProgressProps {
  counted: number
  total: number
  colors: {
    text: string
    textSecondary: string
    inputBg: string
  }
}

export function CountProgress({ counted, total, colors }: CountProgressProps) {
  const percent = total > 0 ? Math.round((counted / total) * 100) : 0

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
          {counted}/{total} contados
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#eb5b0c' }}>{percent}%</Text>
      </View>
      <View style={{
        height: 6, backgroundColor: colors.inputBg, borderRadius: 3, overflow: 'hidden',
      }}>
        <View style={{
          height: '100%', width: `${percent}%`,
          backgroundColor: percent === 100 ? '#10b981' : '#eb5b0c',
          borderRadius: 3,
        }} />
      </View>
    </View>
  )
}
