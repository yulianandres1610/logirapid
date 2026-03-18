import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, Image } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated'
import { QuantityInput } from './QuantityInput'
import { useThemeStore } from '@/src/stores/theme-store'
import type { OperationLine } from '@/src/stores/operations-store'

interface ProductLineItemProps {
  line: OperationLine
  index: number
  onQuantityChange: (index: number, qty: number) => void
  onRemove?: (index: number) => void
  showExpected?: boolean
  showValidated?: boolean
  isLastScanned?: boolean
}

export function ProductLineItem({
  line,
  index,
  onQuantityChange,
  onRemove,
  showExpected,
  showValidated,
  isLastScanned,
}: ProductLineItemProps) {
  const { isDark } = useThemeStore()
  const glowOpacity = useSharedValue(0)

  useEffect(() => {
    if (isLastScanned) {
      // Pulse glow animation: flash in then slowly fade
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0.5, { duration: 600 }),
      )
    } else {
      glowOpacity.value = withTiming(0, { duration: 200 })
    }
  }, [isLastScanned])

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }))

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? '#2d2a28' : '#fff',
        borderRadius: 16,
        padding: 10,
        marginBottom: 8,
        borderWidth: isLastScanned ? 1.5 : 1,
        borderColor: isLastScanned
          ? '#eb5b0c'
          : isDark ? '#3f3b39' : '#f0efee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        overflow: 'hidden',
      }}
    >
      {/* Orange glow overlay for last scanned */}
      {isLastScanned && (
        <Animated.View
          style={[
            glowStyle,
            {
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: isDark ? 'rgba(235,91,12,0.08)' : 'rgba(235,91,12,0.05)',
              borderRadius: 16,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Product image */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: isLastScanned
            ? isDark ? 'rgba(235,91,12,0.2)' : 'rgba(235,91,12,0.1)'
            : isDark ? '#3f3b39' : '#f5f5f4',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginRight: 10,
        }}
      >
        {line.imageUrl ? (
          <Image
            source={{ uri: line.imageUrl }}
            style={{ width: 44, height: 44, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ fontSize: 20 }}>📦</Text>
        )}
      </View>

      {/* Name + SKU */}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: isLastScanned ? '#eb5b0c' : isDark ? '#fafaf9' : '#1c1917',
          }}
        >
          {line.name}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: isDark ? '#78716c' : '#a8a29e',
            fontWeight: '500',
            marginTop: 1,
          }}
        >
          {line.sku}
        </Text>
        {line.lotNumber && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              marginTop: 3,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ fontSize: 9, color: '#2563eb', fontWeight: '600' }}>
              Lote: {line.lotNumber} {line.expirationDate ? `| ${line.expirationDate}` : ''}
            </Text>
          </View>
        )}
        {showExpected && line.expectedQuantity !== undefined && (
          <Text style={{ fontSize: 10, color: isDark ? '#78716c' : '#a8a29e', marginTop: 2 }}>
            Esperado: {line.expectedQuantity}
          </Text>
        )}
        {showValidated && line.validatedQuantity !== undefined && (
          <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '700', marginTop: 2 }}>
            Validado: {line.validatedQuantity}/{line.expectedQuantity}
          </Text>
        )}
      </View>

      {/* Quantity */}
      <QuantityInput
        value={line.quantity}
        onChange={(qty) => onQuantityChange(index, qty)}
      />

      {/* Remove button */}
      {onRemove && (
        <TouchableOpacity
          onPress={() => onRemove(index)}
          activeOpacity={0.7}
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 6,
          }}
        >
          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
