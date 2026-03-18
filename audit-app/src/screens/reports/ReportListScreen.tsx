import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { HomeStackParamList } from '@/src/navigation/types'
import { useAuthStore } from '@/src/stores/auth-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { useAuditStore, type AuditCount } from '@/src/stores/audit-store'

export function ReportListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>()
  const warehouseId = useAuthStore((s) => s.warehouseId)
  const { isDark, colors } = useThemeStore()
  const { reports, isLoadingReports, fetchReports } = useAuditStore()
  const [activeTab, setActiveTab] = useState<'products' | 'fixed_assets'>('products')

  useEffect(() => {
    if (warehouseId) {
      fetchReports(warehouseId, activeTab)
    }
  }, [warehouseId, activeTab])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return { bg: '#fff4eb', text: '#eb5b0c' }
      case 'completed': return { bg: '#dcfce7', text: '#16a34a' }
      case 'applied': return { bg: '#dbeafe', text: '#2563eb' }
      default: return { bg: '#f5f5f4', text: '#78716c' }
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'En Progreso'
      case 'completed': return 'Completado'
      case 'applied': return 'Aplicado'
      default: return status
    }
  }

  const renderItem = ({ item }: { item: AuditCount }) => {
    const statusStyle = getStatusColor(item.status)

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('ReportDetail', { countId: item.id })}
        activeOpacity={0.7}
        style={{
          backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10,
          borderWidth: 1, borderColor: colors.cardBorder,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{item.countNumber}</Text>
          <View style={{ backgroundColor: statusStyle.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusStyle.text }}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{item.warehouseName}</Text>

        {item.auditType === 'products' ? (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Productos: {item.totalProducts || 0}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Diferencias: {item.productsWithDifferences || 0}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: '#16a34a' }}>
              Encontrados: {item.assetsFound || 0}
            </Text>
            <Text style={{ fontSize: 12, color: '#dc2626' }}>
              Faltantes: {item.assetsMissing || 0}
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
          {item.startedAt ? formatDate(item.startedAt) : ''}
          {item.countedByName ? ` - ${item.countedByName}` : ''}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Tabs */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
        backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
      }}>
        <TouchableOpacity
          onPress={() => setActiveTab('products')}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: activeTab === 'products' ? '#eb5b0c' : (isDark ? '#3f3b39' : '#f5f5f4'),
          }}
        >
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: activeTab === 'products' ? '#fff' : colors.textSecondary,
          }}>Productos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('fixed_assets')}
          style={{
            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: activeTab === 'fixed_assets' ? '#3b82f6' : (isDark ? '#3f3b39' : '#f5f5f4'),
          }}
        >
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: activeTab === 'fixed_assets' ? '#fff' : colors.textSecondary,
          }}>Activos Fijos</Text>
        </TouchableOpacity>
      </View>

      {isLoadingReports ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#eb5b0c" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>
                Sin reportes
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>
                Los conteos completados aparecerán aquí
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}
