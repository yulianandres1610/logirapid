import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuthStore } from '@/src/stores/auth-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { useDeviceStatus } from '@/src/hooks/useDeviceStatus'

const ACTIONS = [
  { label: 'Contar Productos', icon: '📦', tab: 'Productos', color: '#eb5b0c' },
  { label: 'Contar Activos Fijos', icon: '🏷️', tab: 'Activos', color: '#3b82f6' },
  { label: 'Ver Reportes', icon: '📊', screen: 'ReportList', color: '#10b981' },
  { label: 'Configuración', icon: '⚙️', tab: 'Config', color: '#6b7280' },
]

function BatteryIcon({ level, isCharging, isDark }: { level: number; isCharging: boolean; isDark: boolean }) {
  const baseColor = isDark ? '#fff' : '#1c1917'
  const getBatteryColor = () => {
    if (isCharging) return '#10b981'
    if (level <= 15) return '#ef4444'
    if (level <= 30) return '#f59e0b'
    return baseColor
  }
  const borderColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(28,25,23,0.3)'

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {isCharging && <Text style={{ fontSize: 10, color: '#10b981', marginRight: 2 }}>⚡</Text>}
      <View style={{
        width: 22, height: 11, borderRadius: 3, borderWidth: 1.5,
        borderColor, justifyContent: 'center', paddingHorizontal: 1.5
      }}>
        <View style={{
          width: `${Math.max(level, 5)}%` as any, height: 6, borderRadius: 1.5,
          backgroundColor: getBatteryColor()
        }} />
      </View>
      <View style={{
        width: 2, height: 5, backgroundColor: borderColor,
        borderTopRightRadius: 1, borderBottomRightRadius: 1, marginLeft: 0.5
      }} />
    </View>
  )
}

function WifiIcon({ signalLevel, isDark }: { signalLevel: number; isDark: boolean }) {
  const activeColor = isDark ? '#fff' : '#1c1917'
  const inactiveColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(28,25,23,0.15)'
  const bars = [0.3, 0.5, 0.7, 1.0]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 12, gap: 1.5 }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3, height: 12 * h, borderRadius: 1,
            backgroundColor: i < signalLevel ? activeColor : inactiveColor
          }}
        />
      ))}
    </View>
  )
}

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>()
  const warehouseName = useAuthStore((s) => s.warehouseName)
  const warehouseId = useAuthStore((s) => s.warehouseId)
  const { isDark, colors } = useThemeStore()
  const { battery, wifi, time, date } = useDeviceStatus()

  if (!warehouseId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🏭</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Selecciona un almacén</Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
          Ve a Configuración para elegir tu almacén
        </Text>
      </View>
    )
  }

  const clockColor = isDark ? '#ffffff' : '#1c1917'
  const dateColor = isDark ? 'rgba(255,255,255,0.5)' : '#78716c'
  const chipBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
  const chipText = isDark ? '#fff' : '#1c1917'
  const labelColor = isDark ? 'rgba(255,255,255,0.7)' : '#78716c'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Status Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <WifiIcon signalLevel={wifi ? 3 : 0} isDark={isDark} />
          {wifi ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>{wifi}</Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sin conexión</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
            {battery.level >= 0 ? `${battery.level}%` : ''}
          </Text>
          <BatteryIcon level={battery.level} isCharging={battery.charging} isDark={isDark} />
        </View>
      </View>

      {/* Clock & Warehouse */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 }}>
        <Text style={{ color: clockColor, fontWeight: '200', fontSize: 80, lineHeight: 86, letterSpacing: -3 }}>
          {time}
        </Text>
        <Text style={{ color: dateColor, fontSize: 15, fontWeight: '500', marginTop: 6 }}>{date}</Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', marginTop: 14,
          backgroundColor: chipBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6
        }}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🏭</Text>
          <Text style={{ color: chipText, fontWeight: '700', fontSize: 13 }}>{warehouseName}</Text>
        </View>
      </View>

      {/* Action Grid */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {ACTIONS.map((app) => (
            <TouchableOpacity
              key={app.label}
              onPress={() => {
                if (app.screen) {
                  navigation.navigate(app.screen)
                } else if (app.tab) {
                  (navigation as any).navigate(app.tab)
                }
              }}
              activeOpacity={0.7}
              style={{ alignItems: 'center', marginBottom: 14, width: '25%' }}
            >
              <View
                style={{
                  width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: app.color,
                  shadowColor: app.color, shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
                }}
              >
                <Text style={{ fontSize: 24 }}>{app.icon}</Text>
              </View>
              <Text style={{ color: labelColor, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 6 }}>
                {app.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}
