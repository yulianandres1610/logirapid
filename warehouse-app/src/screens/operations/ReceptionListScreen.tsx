import React, { useEffect, useState, useCallback } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View, RefreshControl, ActivityIndicator, Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { OperationsStackParamList } from '@/src/navigation/types'

type Nav = NativeStackNavigationProp<OperationsStackParamList>
import Animated, { FadeIn } from 'react-native-reanimated'
import { Badge } from '@/src/components/ui/Badge'
import { useOperationsStore } from '@/src/stores/operations-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { api } from '@/src/services/api'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'

const typeLabels: Record<string, string> = {
  purchase: 'Compra',
  consignment: 'Consignación',
  production: 'Producción',
}

const typeColors: Record<string, 'info' | 'orange' | 'success'> = {
  purchase: 'info',
  consignment: 'orange',
  production: 'success',
}

const typeIcons: Record<string, string> = {
  purchase: '🛒',
  consignment: '🤝',
  production: '🏭',
}

export function ReceptionListScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation<Nav>()
  const { pendingOrders, fetchPendingOrders, isLoading } = useOperationsStore()
  const [refreshing, setRefreshing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    fetchPendingOrders()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPendingOrders()
    setRefreshing(false)
  }

  // Handle barcode scan — search for purchase by number
  const handleScan = useCallback(async (barcode: string) => {
    const code = barcode.trim()
    if (!code || scanning) return

    setScanning(true)
    try {
      const data = await api.get<any>(`/api/market/purchases/${encodeURIComponent(code)}`)

      if (data) {
        playSuccessBeep()
        vibrateSuccess()

        const order = {
          id: data.id,
          orderNumber: data.purchaseNumber,
          type: 'purchase' as const,
          supplierName: data.supplierName || '',
          status: data.status,
          createdAt: data.createdAt || '',
          totalItems: data.lines?.length || 0,
          lines: (data.lines || []).map((l: any) => ({
            lineId: l.id,
            productId: l.productId,
            variantId: l.variantId,
            name: l.variantName ? `${l.productName} - ${l.variantName}` : l.productName,
            sku: l.productSku || '',
            barcode: l.productBarcode || l.productSku || '',
            quantity: parseFloat(l.quantity) || 0,
            expectedQuantity: parseFloat(l.quantity) || 0,
            imageUrl: l.productImage || null,
          })),
        }

        setManualCode('')
        navigation.navigate('ReceptionDetail', { order })
      }
    } catch (err: any) {
      playErrorBeep()
      vibrateError()
      Alert.alert(
        'No encontrada',
        `No se encontró orden de compra con código "${code}".\n\nVerifique el código (ej: PUR-2026-0060).`,
        [{ text: 'OK' }]
      )
    } finally {
      setScanning(false)
    }
  }, [navigation, scanning])

  useDataWedge(handleScan)

  const handleManualSearch = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: colors.card,
        borderBottomWidth: isDark ? 0 : 1,
        borderBottomColor: isDark ? 'transparent' : '#e7e5e4',
      }}>
        <TouchableOpacity onPress={() => navigation.navigate('OperationsMenu')} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ marginRight: 14 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
          }}>
            <Text style={{ fontSize: 22, color: '#eb5b0c', fontWeight: '700' }}>‹</Text>
          </View>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>Recepciones</Text>
      </View>

      {/* Scan Section */}
      <View style={{
        backgroundColor: isDark ? '#2d2a28' : '#fff',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: isDark ? '#3f3b39' : '#e7e5e4',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Escanear Factura / Orden de Compra
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.inputBg, borderRadius: 12,
            paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputBorder,
          }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>📋</Text>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="PUR-2026-0060"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text, fontWeight: '600' }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleManualSearch}
            />
          </View>
          <TouchableOpacity
            onPress={handleManualSearch}
            disabled={scanning || !manualCode.trim()}
            style={{
              width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: manualCode.trim() ? '#eb5b0c' : (isDark ? '#3f3b39' : '#e7e5e4'),
            }}
            activeOpacity={0.7}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ fontSize: 20 }}>🔍</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
          Escanee el código de barras de la factura o escriba el número de compra
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eb5b0c" />}
      >
        {isLoading && pendingOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Cargando...</Text>
          </View>
        ) : pendingOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 36 }}>📥</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Sin recepciones pendientes</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
              Escanee el código de una factura para cargar una recepción
            </Text>
          </View>
        ) : (
          <>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: colors.textSecondary,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>
              {pendingOrders.length} orden{pendingOrders.length !== 1 ? 'es' : ''} pendiente{pendingOrders.length !== 1 ? 's' : ''}
            </Text>

            {pendingOrders.map((order, i) => (
              <Animated.View key={`${order.type}-${order.id}`} entering={FadeIn.delay(i * 60).duration(200)}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ReceptionDetail', { order })}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isDark ? '#2d2a28' : '#fff',
                    borderRadius: 16, padding: 14, marginBottom: 10,
                    borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 22 }}>{typeIcons[order.type] || '📥'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{order.orderNumber}</Text>
                        <Badge variant={typeColors[order.type] || 'default'}>
                          {typeLabels[order.type] || order.type}
                        </Badge>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {order.supplierName}
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? '#57534e' : '#a8a29e', marginTop: 1 }}>
                        {order.totalItems} productos
                      </Text>
                    </View>
                    <View style={{
                      width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
                    }}>
                      <Text style={{ color: '#eb5b0c', fontWeight: '800' }}>›</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}
