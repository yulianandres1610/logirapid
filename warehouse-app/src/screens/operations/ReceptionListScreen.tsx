import React, { useEffect } from 'react'
import { ScrollView, Text, TouchableOpacity, View, RefreshControl, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { OperationsStackParamList } from '@/src/navigation/types'

type Nav = NativeStackNavigationProp<OperationsStackParamList>
import Animated, { FadeIn } from 'react-native-reanimated'
import { Badge } from '@/src/components/ui/Badge'
import { useOperationsStore } from '@/src/stores/operations-store'
import { useThemeStore } from '@/src/stores/theme-store'

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
  const [refreshing, setRefreshing] = React.useState(false)

  useEffect(() => {
    fetchPendingOrders()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPendingOrders()
    setRefreshing(false)
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eb5b0c" />}
      >
        {isLoading && pendingOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Cargando...</Text>
          </View>
        ) : pendingOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 36 }}>📥</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Sin recepciones</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
              No hay órdenes pendientes de recibir
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
              <Animated.View key={order.id} entering={FadeIn.delay(i * 60).duration(200)}>
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
