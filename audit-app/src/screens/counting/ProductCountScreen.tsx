import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator,
} from 'react-native'
import { useAuthStore } from '@/src/stores/auth-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { useAuditStore, type Product, type ProductVariant } from '@/src/stores/audit-store'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { QuantityInput } from '@/src/components/QuantityInput'
import { CountProgress } from '@/src/components/CountProgress'

type CountableItem = {
  key: string
  productId: number
  variantId?: number
  name: string
  sku: string
  barcode: string | null
  systemQty: number
}

export function ProductCountScreen() {
  const warehouseId = useAuthStore((s) => s.warehouseId)!
  const warehouseName = useAuthStore((s) => s.warehouseName)
  const { isDark, colors } = useThemeStore()

  const {
    products, isLoadingProducts, countedItems, lastScannedKey,
    fetchProducts, scanBarcode, setQuantity, incrementQuantity,
    saveCount, completeCount, checkExistingCount, loadExistingCount,
    restoreFromLocal, resetProductCount, persistLocally,
  } = useAuditStore()

  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  // Build flat list of countable items (products + variant rows)
  const allItems: CountableItem[] = React.useMemo(() => {
    const items: CountableItem[] = []
    for (const p of products) {
      if (p.hasVariants && p.variants) {
        for (const v of p.variants) {
          items.push({
            key: `${p.id}-${v.id}`,
            productId: p.id,
            variantId: v.id,
            name: `${p.name} - ${v.name}`,
            sku: v.sku || p.sku,
            barcode: v.barcode || p.barcode,
            systemQty: v.stock,
          })
        }
      } else {
        items.push({
          key: `${p.id}`,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          systemQty: p.stock,
        })
      }
    }
    return items
  }, [products])

  // Filtered items
  const filteredItems = React.useMemo(() => {
    if (!search.trim()) return allItems
    const q = search.toLowerCase()
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.barcode && item.barcode.toLowerCase().includes(q))
    )
  }, [allItems, search])

  // Stats
  const totalItems = allItems.length
  const countedCount = Array.from(countedItems.entries()).filter(([, qty]) => qty > 0).length

  // Initialize
  useEffect(() => {
    const init = async () => {
      await fetchProducts(warehouseId)

      // Check for existing in-progress count on server
      const existingId = await checkExistingCount(warehouseId, 'products')
      if (existingId) {
        // Try to restore from local first (may have more recent data)
        const restored = await restoreFromLocal(warehouseId)
        if (!restored) {
          await loadExistingCount(existingId)
        }
      } else {
        // Try local backup
        await restoreFromLocal(warehouseId)
      }

      setInitialized(true)
    }
    init()
  }, [warehouseId])

  // DataWedge scanner
  useDataWedge(
    useCallback((barcode: string) => {
      const result = scanBarcode(barcode)
      if (result) {
        // Scroll to the scanned item
        const key = result.variant
          ? `${result.product.id}-${result.variant.id}`
          : `${result.product.id}`
        const index = filteredItems.findIndex((item) => item.key === key)
        if (index >= 0 && flatListRef.current) {
          flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.3 })
        }
      }
    }, [filteredItems])
  )

  // Auto-scroll on scan
  useEffect(() => {
    if (lastScannedKey && flatListRef.current) {
      const index = filteredItems.findIndex((item) => item.key === lastScannedKey)
      if (index >= 0) {
        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.3 })
      }
    }
  }, [lastScannedKey])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveCount(warehouseId)
      Alert.alert('Guardado', 'Progreso guardado correctamente')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = () => {
    Alert.alert(
      'Finalizar Conteo',
      `¿Estás seguro de finalizar el conteo?\n\n${countedCount}/${totalItems} productos contados`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setCompleting(true)
            try {
              await completeCount(warehouseId)
              Alert.alert('Completado', 'Conteo finalizado exitosamente')
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
      '¿Deseas descartar el conteo actual y comenzar uno nuevo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Nuevo Conteo',
          style: 'destructive',
          onPress: () => {
            resetProductCount()
            useAuditStore.getState().clearLocal(warehouseId)
          },
        },
      ]
    )
  }

  const renderItem = useCallback(({ item }: { item: CountableItem }) => {
    const counted = countedItems.get(item.key) || 0
    const diff = counted - item.systemQty
    const isHighlighted = item.key === lastScannedKey

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              SKU: {item.sku}
              {item.barcode ? ` | ${item.barcode}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* System qty */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>SISTEMA</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary }}>{item.systemQty}</Text>
          </View>

          {/* Quantity input */}
          <QuantityInput
            value={counted}
            onChange={(qty) => setQuantity(item.productId, item.variantId, qty)}
            colors={colors}
            isDark={isDark}
          />

          {/* Difference */}
          <View style={{ alignItems: 'center', minWidth: 50 }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>DIF.</Text>
            <Text style={{
              fontSize: 16, fontWeight: '800',
              color: diff === 0 ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444'
            }}>
              {diff > 0 ? `+${diff}` : diff}
            </Text>
          </View>
        </View>
      </View>
    )
  }, [countedItems, lastScannedKey, isDark, colors])

  if (!initialized || isLoadingProducts) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#eb5b0c" />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Cargando productos...</Text>
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
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Conteo de Productos</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{warehouseName}</Text>
          </View>
          <TouchableOpacity onPress={handleNewCount} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20 }}>🔄</Text>
          </TouchableOpacity>
        </View>

        <CountProgress counted={countedCount} total={totalItems} colors={colors} />

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
            placeholder="Buscar producto, SKU o barcode..."
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text,
            }}
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

      {/* Product List */}
      <FlatList
        ref={flatListRef}
        data={filteredItems}
        keyExtractor={(item) => item.key}
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
              {search ? 'Sin resultados' : 'Sin productos'}
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
            flex: 1, backgroundColor: '#eb5b0c',
            borderRadius: 14, paddingVertical: 14, alignItems: 'center',
            shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 3 },
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
