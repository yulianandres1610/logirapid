import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Switch } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useAuthStore } from '@/src/stores/auth-store'
import { useWarehouseStore } from '@/src/stores/warehouse-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { getCurrentVersion } from '@/src/services/app-updater'
import { useUpdateStore } from '@/src/stores/update-store'
import {
  getWifiInfo,
  scanWifiNetworks,
  connectToWifi,
  setWifiEnabled,
  type WifiNetwork,
} from '@/src/services/device-info'

interface WifiInfo {
  enabled: boolean
  ssid: string
  signalLevel: number
  ip: string
  isConnected?: boolean
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', color, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  )
}

function WifiSignalBars({ level, size = 14 }: { level: number; size?: number }) {
  const bars = [0.3, 0.5, 0.7, 1.0]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: size, gap: 1.5 }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3, height: size * h, borderRadius: 1,
            backgroundColor: i < level ? '#eb5b0c' : '#d6d3d1'
          }}
        />
      ))}
    </View>
  )
}

export function SettingsScreen() {
  const { user, warehouseId, warehouseName, setWarehouse, logout } = useAuthStore()
  const { warehouses, fetchWarehouses } = useWarehouseStore()
  const { isDark, colors, toggle: toggleTheme } = useThemeStore()

  const [wifiInfo, setWifiInfo] = useState<WifiInfo | null>(null)
  const [networks, setNetworks] = useState<WifiNetwork[]>([])
  const [scanning, setScanning] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [passwordModal, setPasswordModal] = useState<{ ssid: string; isSecured: boolean } | null>(null)
  const [password, setPassword] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState<'idle' | 'up-to-date' | 'error'>('idle')

  const { version: appVersion, versionCode: appVersionCode } = getCurrentVersion()
  const checkNow = useUpdateStore((s) => s.checkNow)

  const handleCheckUpdate = useCallback(async () => {
    setCheckingUpdate(true)
    setUpdateResult('idle')
    try {
      const info = await checkNow()
      if (info.updateAvailable) {
        // The UpdateModal (in App.tsx) handles the update flow.
        // checkNow() already sets showModal=true in the store,
        // so the modal will appear automatically.
      } else {
        setUpdateResult('up-to-date')
        setTimeout(() => setUpdateResult('idle'), 3000)
      }
    } catch {
      setUpdateResult('error')
      setTimeout(() => setUpdateResult('idle'), 3000)
    } finally {
      setCheckingUpdate(false)
    }
  }, [checkNow])

  useEffect(() => {
    fetchWarehouses()
    refreshWifi()
  }, [])

  const refreshWifi = useCallback(async () => {
    const info = await getWifiInfo()
    setWifiInfo(info)
  }, [])

  const handleScanWifi = useCallback(async () => {
    setScanning(true)
    const results = await scanWifiNetworks()
    setNetworks(results.sort((a, b) => b.level - a.level))
    setScanning(false)
    await refreshWifi()
  }, [])

  const handleConnectWifi = async (ssid: string, pwd: string) => {
    setConnecting(ssid)
    setPasswordModal(null)
    setPassword('')
    const success = await connectToWifi(ssid, pwd)
    setConnecting(null)
    if (success) {
      Alert.alert('Conectado', `Conectado a "${ssid}"`)
      setTimeout(refreshWifi, 2000)
    } else {
      Alert.alert('Error', `No se pudo conectar a "${ssid}"`)
    }
  }

  const handleNetworkPress = (network: WifiNetwork) => {
    if (network.secure) {
      setPasswordModal({ ssid: network.ssid, isSecured: true })
    } else {
      handleConnectWifi(network.ssid, '')
    }
  }

  const handleToggleWifi = async (enabled: boolean) => {
    await setWifiEnabled(enabled)
    setTimeout(refreshWifi, 1500)
  }

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar Sesión', style: 'destructive', onPress: logout },
    ])
  }

  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: 8,
    elevation: isDark ? 0 : 1,
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Theme Toggle */}
      <View style={cardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>{isDark ? '🌙' : '☀️'}</Text>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {isDark ? 'Tema Oscuro' : 'Tema Claro'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Cambiar apariencia
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#d6d3d1', true: '#fdba74' }}
            thumbColor={isDark ? '#eb5b0c' : '#a8a29e'}
          />
        </View>
      </View>

      {/* User */}
      <View style={cardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{
            width: 48, height: 48, backgroundColor: '#eb5b0c', borderRadius: 16,
            alignItems: 'center', justifyContent: 'center', marginRight: 16
          }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
              {(user?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{user?.email}</Text>
            <View style={{ backgroundColor: '#fff4eb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' }}>
              <Text style={{ color: '#eb5b0c', fontSize: 11, fontWeight: '700' }}>{user?.role}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.separator }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Empresa</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{user?.companyName || '-'}</Text>
        </View>
      </View>

      {/* WiFi */}
      <View style={cardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionHeader title="Red WiFi" color={colors.textSecondary} />
          <Switch
            value={wifiInfo?.enabled ?? false}
            onValueChange={handleToggleWifi}
            trackColor={{ false: '#d6d3d1', true: '#fdba74' }}
            thumbColor={wifiInfo?.enabled ? '#eb5b0c' : '#a8a29e'}
          />
        </View>

        {wifiInfo?.ssid ? (
          <View style={{
            backgroundColor: '#fff4eb', borderRadius: 16, padding: 16, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center'
          }}>
            <View style={{
              width: 40, height: 40, backgroundColor: '#eb5b0c', borderRadius: 12,
              alignItems: 'center', justifyContent: 'center', marginRight: 12
            }}>
              <Text style={{ fontSize: 18, color: '#fff' }}>📶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#9a3412' }}>{wifiInfo.ssid}</Text>
              <Text style={{ fontSize: 12, color: '#eb5b0c', marginTop: 2 }}>Conectado • {wifiInfo.ip}</Text>
            </View>
            <WifiSignalBars level={wifiInfo.signalLevel} />
          </View>
        ) : (
          <View style={{
            backgroundColor: colors.inputBg, borderRadius: 16, padding: 16, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center'
          }}>
            <View style={{
              width: 40, height: 40, backgroundColor: colors.inputBorder, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center', marginRight: 12
            }}>
              <Text style={{ fontSize: 18 }}>📵</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }}>Sin conexión WiFi</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleScanWifi}
          style={{
            backgroundColor: isDark ? '#3f3b39' : '#1c1917', borderRadius: 16,
            paddingVertical: 12, alignItems: 'center', marginBottom: 12
          }}
          activeOpacity={0.8}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Buscar Redes</Text>
          )}
        </TouchableOpacity>

        {networks.length > 0 && (
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Redes disponibles
            </Text>
            {networks.map((net) => (
              <TouchableOpacity
                key={net.ssid}
                onPress={() => handleNetworkPress(net)}
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: colors.separator
                }}
                activeOpacity={0.6}
                disabled={connecting === net.ssid}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <WifiSignalBars level={net.level} size={12} />
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500', marginLeft: 12 }}>{net.ssid}</Text>
                  {net.secure && <Text style={{ fontSize: 10, marginLeft: 6 }}>🔒</Text>}
                </View>
                {connecting === net.ssid ? (
                  <ActivityIndicator color="#eb5b0c" size="small" />
                ) : (
                  <Text style={{ color: '#eb5b0c', fontSize: 12, fontWeight: '700' }}>Conectar</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Password inline */}
      {passwordModal && (
        <View style={{
          backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16,
          borderWidth: 2, borderColor: '#ffc999',
          shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15, shadowRadius: 12, elevation: 4
        }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
            Conectar a "{passwordModal.ssid}"
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>Ingresa la contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={{
              backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
              borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
              fontSize: 14, color: colors.text, marginBottom: 12
            }}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => { setPasswordModal(null); setPassword('') }}
              style={{
                flex: 1, backgroundColor: isDark ? '#3f3b39' : '#e7e5e4',
                borderRadius: 16, paddingVertical: 12, alignItems: 'center'
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleConnectWifi(passwordModal.ssid, password)}
              style={{
                flex: 1, backgroundColor: '#eb5b0c', borderRadius: 16,
                paddingVertical: 12, alignItems: 'center'
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Conectar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Warehouse */}
      <View style={cardStyle}>
        <SectionHeader title="Almacén de Trabajo" color={colors.textSecondary} />
        {warehouseName && (
          <View style={{
            backgroundColor: '#fff4eb', borderRadius: 12, padding: 12, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center'
          }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>🏭</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#d14f09' }}>{warehouseName}</Text>
          </View>
        )}
        <View style={{
          borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 16,
          overflow: 'hidden', backgroundColor: colors.inputBg
        }}>
          <Picker
            selectedValue={warehouseId}
            onValueChange={(val) => {
              if (val) {
                const w = warehouses.find((wh) => wh.id === val)
                if (w) setWarehouse(w.id, w.name)
              }
            }}
            style={{ color: colors.text }}
            dropdownIconColor={colors.textSecondary}
          >
            <Picker.Item label="Cambiar almacén..." value={null} color={colors.textMuted} />
            {warehouses.map((w) => (
              <Picker.Item key={w.id} label={w.name} value={w.id} color={colors.text} />
            ))}
          </Picker>
        </View>
      </View>

      {/* App Info */}
      <View style={cardStyle}>
        <SectionHeader title="Aplicación" color={colors.textSecondary} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.separator }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Versión</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{appVersion}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.separator }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Build</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{appVersionCode}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.separator }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Servidor</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>fabrica.servisumic.com</Text>
        </View>

        {/* Check for updates button */}
        <TouchableOpacity
          onPress={handleCheckUpdate}
          disabled={checkingUpdate}
          style={{
            backgroundColor: isDark ? '#3f3b39' : '#1c1917',
            borderRadius: 16,
            paddingVertical: 12,
            alignItems: 'center',
            marginTop: 12,
          }}
          activeOpacity={0.8}
        >
          {checkingUpdate ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {updateResult === 'up-to-date' ? '✓ Estás al día' : updateResult === 'error' ? 'Error al buscar' : 'Buscar Actualizaciones'}
            </Text>
          )}
        </TouchableOpacity>
        {updateResult === 'up-to-date' && (
          <Text style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', marginTop: 6 }}>
            Tienes la última versión
          </Text>
        )}
        {updateResult === 'error' && (
          <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginTop: 6 }}>
            No se pudo verificar. Revisa la conexión.
          </Text>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        onPress={handleLogout}
        style={{
          backgroundColor: '#ef4444', borderRadius: 16, paddingVertical: 16, alignItems: 'center',
          shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25, shadowRadius: 8, elevation: 4
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}
