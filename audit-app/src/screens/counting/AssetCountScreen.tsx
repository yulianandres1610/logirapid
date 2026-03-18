import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator,
} from 'react-native'
import { useAuthStore } from '@/src/stores/auth-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { useAuditStore, type FixedAsset } from '@/src/stores/audit-store'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { CountProgress } from '@/src/components/CountProgress'

export function AssetCountScreen() {
  const warehouseId = useAuthStore((s) => s.warehouseId)!
  const warehouseName = useAuthStore((s) => s.warehouseName)
  const { isDark, colors } = useThemeStore()

  const {
    assets, isLoadingAssets, foundAssets, lastScannedAssetId,
    fetchAssets, scanAssetBarcode, markAssetFound, markAssetMissing,
    saveAssetCount, completeAssetCount, checkExistingCount, loadExistingCount,
    resetAssetCount,
  } = useAuditStore()

  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [filter, setFilter] = useState<'all' | 'found' | 'missing'>('all')
  const flatListRef = useRef<FlatList>(null)

  // Filtered assets
  const filteredAssets = React.useMemo(() => {
    let items = assets

    // Apply status filter
    if (filter === 'found') {
      items = items.filter((a) => foundAssets.has(a.id))
    } else if (filter === 'missing') {
      items = items.filter((a) => !foundAssets.has(a.id))
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.assetCode.toLowerCase().includes(q) ||
          (a.barcode && a.barcode.toLowerCase().includes(q)) ||
          (a.categoryName && a.categoryName.toLowerCase().includes(q))
      )
    }

    return items
  }, [assets, foundAssets, search, filter])

  const totalAssets = assets.length
  const foundCount = foundAssets.size

  // Initialize
  useEffect(() => {
    const init = async () => {
      await fetchAssets(warehouseId)
      const existingId = await checkExistingCount(warehouseId, 'fixed_assets')
      if (existingId) {
        await loadExistingCount(existingId)
      }
      setInitialized(true)
    }
    init()
  }, [warehouseId])

  // DataWedge scanner
  useDataWedge(
    useCallback((barcode: string) => {
      const result = scanAssetBarcode(barcode)
      if (result) {
        const index = filteredAssets.findIndex((a) => a.id === result.id)
        if (index >= 0 && flatListRef.current) {
          flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.3 })
        }
      }
    }, [filteredAssets])
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveAssetCount(warehouseId)
      Alert.alert('Guardado', 'Progreso guardado correctamente')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = () => {
    const missing = totalAssets - foundCount
    Alert.alert(
      'Finalizar Conteo de Activos',
      `Encontrados: ${foundCount}/${totalAssets}\n${missing > 0 ? `${missing} activos no encontrados` : 'Todos los activos verificados'}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setCompleting(true)
            try {
              await completeAssetCount(warehouseId)
              Alert.alert('Completado', 'Conteo de activos finalizado')
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo completar')
            } finally {
              setCompleting(false)
            }
          },
        },
      ]
    )
  }

  const handleNewCount = () => {
    Alert.alert(
      'Nuevo Conteo',
      '¿Deseas descartar el conteo actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Nuevo Conteo', style: 'destructive', onPress: resetAssetCount },
      ]
    )
  }

  const renderItem = useCallback(({ item }: { item: FixedAsset }) => {
    const isFound = foundAssets.has(item.id)
    const isHighlighted = item.id === lastScannedAssetId

    return (
      <View
        style={{
          backgroundColor: isHighlighted ? (isDark ? 'rgba(235,91,12,0.15)' : '#fff4eb') : colors.card,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: isHighlighted ? '#eb5b0c' : colors.cardBorder,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {item.assetCode}
              {item.barcode ? ` | ${item.barcode}` : ''}
            </Text>
            {item.categoryName && (
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                {item.categoryName}
              </Text>
            )}
            {item.responsibleName && (
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                Resp: {item.responsibleName}
              </Text>
            )}
          </View>

          {/* Status chip + toggle */}
          <TouchableOpacity
            onPress={() => isFound ? markAssetMissing(item.id) : markAssetFound(item.id)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
              backgroundColor: isFound ? '#dcfce7' : '#fef2f2',
              minWidth: 90, alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '700',
              color: isFound ? '#16a34a' : '#dc2626',
            }}>
              {isFound ? 'Encontrado' : 'No encontrado'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Value */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.separator }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Valor: ${item.currentValue.toFixed(2)}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Estado: {item.condition}</Text>
        </View>
      </View>
    )
  }, [foundAssets, lastScannedAssetId, isDark, colors])

  if (!initialized || isLoadingAssets) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#eb5b0c" />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Cargando activos...</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.card,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Conteo de Activos Fijos</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{warehouseName}</Text>
          </View>
          <TouchableOpacity onPress={handleNewCount} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        <CountProgress counted={foundCount} total={totalAssets} colors={colors} />

        {/* Filter chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {(['all', 'found', 'missing'] as const).map((f) => {
            const isActive = filter === f
            const label = f === 'all' ? `Todos (${totalAssets})` : f === 'found' ? `Encontrados (${foundCount})` : `Faltantes (${totalAssets - foundCount})`
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
                  backgroundColor: isActive
                    ? (f === 'found' ? '#dcfce7' : f === 'missing' ? '#fef2f2' : '#fff4eb')
                    : (isDark ? '#3f3b39' : '#f5f5f4'),
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '700',
                  color: isActive
                    ? (f === 'found' ? '#16a34a' : f === 'missing' ? '#dc2626' : '#eb5b0c')
                    : colors.textMuted,
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', marginTop: 10,
          backgroundColor: colors.inputBg, borderRadius: 12,
          paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputBorder,
        }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar activo, código o barcode..."
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '700' }}>X</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Asset List */}
      <FlatList
        ref={flatListRef}
        data={filteredAssets}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={7}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📭</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>
              {search ? 'Sin resultados' : 'Sin activos fijos'}
            </Text>
          </View>
        }
      />

      {/* Bottom Actions */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10,
        backgroundColor: colors.card,
        borderTopWidth: 1, borderTopColor: colors.cardBorder,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
      }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            flex: 1, backgroundColor: isDark ? '#3f3b39' : '#1c1917',
            borderRadius: 14, paddingVertical: 14, alignItems: 'center',
          }}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Guardar</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleComplete}
          disabled={completing}
          style={{
            flex: 1, backgroundColor: '#3b82f6',
            borderRadius: 14, paddingVertical: 14, alignItems: 'center',
            shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
          }}
          activeOpacity={0.8}
        >
          {completing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Finalizar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
