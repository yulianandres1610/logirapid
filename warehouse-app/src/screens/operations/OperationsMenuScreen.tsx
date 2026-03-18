import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { OperationsStackParamList } from '@/src/navigation/types'
import { useThemeStore } from '@/src/stores/theme-store'

const OPERATIONS = [
  { id: 'TransferCreate', label: 'Transferir', icon: '🔄', description: 'Enviar productos a otro almacén', color: '#eb5b0c' },
  { id: 'TransferValidate', label: 'Validar Transferencia', icon: '✅', description: 'Recibir y validar cantidades', color: '#10b981' },
  { id: 'ReceptionList', label: 'Recibir Mercancía', icon: '📥', description: 'Compras, consignaciones, producción', color: '#3b82f6' },
  { id: 'WholesaleList', label: 'Despacho Mayoreo', icon: '🚚', description: 'Validar y completar despachos', color: '#8b5cf6' },
  { id: 'ScrapAdjustment', label: 'Scrap / Ajuste', icon: '♻️', description: 'Merma, daño, ajuste de inventario', color: '#ef4444' },
] as const

export function OperationsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OperationsStackParamList>>()
  const { colors, isDark } = useThemeStore()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Operaciones</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>Selecciona una operación</Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}>
        {OPERATIONS.map((op) => (
          <TouchableOpacity
            key={op.id}
            onPress={() => navigation.navigate(op.id as any)}
            activeOpacity={0.8}
          >
            <View
              style={{
                backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden',
                borderWidth: 1, borderColor: colors.cardBorder,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 8, elevation: isDark ? 0 : 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <View style={{
                  width: 56, height: 56, backgroundColor: op.color, borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center', marginRight: 16
                }}>
                  <Text style={{ fontSize: 24 }}>{op.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{op.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{op.description}</Text>
                </View>
                <View style={{
                  width: 32, height: 32, backgroundColor: colors.inputBg, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>›</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}
