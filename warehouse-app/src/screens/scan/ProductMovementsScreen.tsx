import React, { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Animated, {
  FadeIn, FadeOut, SlideInUp,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSequence, Easing, interpolate,
} from 'react-native-reanimated'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useScannerStore, type ScannedProduct } from '@/src/stores/scanner-store'
import { useAuthStore } from '@/src/stores/auth-store'
import { api } from '@/src/services/api'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'
import { useThemeStore } from '@/src/stores/theme-store'

// ─── Types ──────────────────────────────────────────────────────────
interface Movement {
  id: number
  date: string
  type: string
  typeLabel: string
  quantity: number
  stockBefore: number
  stockAfter: number
  reference: string | null
  fromWarehouse: string | null
  toWarehouse: string | null
  user: string
  notes: string | null
}

interface ProductInfo {
  id: number
  name: string
  sku: string
  barcode: string
}

const typeIcons: Record<string, string> = {
  in: '📥',
  reception: '📥',
  transfer_in: '🔄',
  return: '↩️',
  out: '📤',
  sale: '🛒',
  transfer_out: '🔄',
  wholesale: '🚚',
  scrap: '🗑️',
  adjustment: '⚙️',
  transfer: '🔄',
}

const typeColors: Record<string, string> = {
  in: '#10b981',
  reception: '#10b981',
  transfer_in: '#3b82f6',
  return: '#3b82f6',
  out: '#ef4444',
  sale: '#f59e0b',
  transfer_out: '#f59e0b',
  wholesale: '#eb5b0c',
  scrap: '#ef4444',
  adjustment: '#8b5cf6',
  transfer: '#3b82f6',
}

// ─── Barcode Icon ───────────────────────────────────────────────────
function BarcodeIcon({ size = 24, color = '#eb5b0c' }: { size?: number; color?: string }) {
  const bars = [3, 2, 4, 2, 3, 1, 4, 2, 3, 2, 1, 3]
  const h = size
  const gap = size * 0.06
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: h, gap }}>
      {bars.map((w, i) => (
        <View key={i} style={{
          width: Math.max(w * (size / 24), 1),
          height: i % 3 === 0 ? h : h * 0.8,
          backgroundColor: color,
          borderRadius: 0.5,
        }} />
      ))}
    </View>
  )
}

// ─── Inline Scan Toast ──────────────────────────────────────────────
function ScanToast({ message, type }: { message: string; type: 'success' | 'error' }) {
  const isSuccess = type === 'success'
  return (
    <Animated.View
      entering={SlideInUp.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        position: 'absolute', top: 0, left: 16, right: 16, zIndex: 50,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isSuccess ? '#10b981' : '#ef4444',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        shadowColor: isSuccess ? '#10b981' : '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 8 }}>
        {isSuccess ? '✓' : '✕'}
      </Text>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  )
}

// ─── Scanner Idle Animation ─────────────────────────────────────────
function ScannerIdle({ isDark, colors }: { isDark: boolean; colors: any }) {
  const pulse1 = useSharedValue(0.4)
  const pulse2 = useSharedValue(0.3)
  const scanLine = useSharedValue(0)

  React.useEffect(() => {
    pulse1.value = withRepeat(withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true)
    pulse2.value = withDelay(400, withRepeat(withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true))
    scanLine.value = withRepeat(withSequence(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
    ), -1, false)
  }, [])

  const ring1Style = useAnimatedStyle(() => ({
    opacity: pulse1.value,
    transform: [{ scale: 1 + (1 - pulse1.value) * 0.3 }],
  }))
  const ring2Style = useAnimatedStyle(() => ({
    opacity: pulse2.value,
    transform: [{ scale: 1 + (1 - pulse2.value) * 0.5 }],
  }))
  const lineStyle = useAnimatedStyle(() => ({
    top: interpolate(scanLine.value, [0, 1], [16, 56]),
  }))

  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[ring2Style, {
          position: 'absolute', width: 140, height: 140, borderRadius: 70,
          borderWidth: 2, borderColor: '#8b5cf6',
        }]} />
        <Animated.View style={[ring1Style, {
          position: 'absolute', width: 110, height: 110, borderRadius: 55,
          borderWidth: 2, borderColor: '#8b5cf6',
        }]} />
        <View style={{
          width: 80, height: 80, borderRadius: 20,
          backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.08)',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <Text style={{ fontSize: 36 }}>📋</Text>
          <Animated.View style={[lineStyle, {
            position: 'absolute', left: 8, right: 8, height: 2,
            backgroundColor: '#8b5cf6', borderRadius: 1,
          }]} />
        </View>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 24 }}>
        Movimientos de Producto
      </Text>
      <Text style={{
        fontSize: 13, color: colors.textSecondary, marginTop: 8,
        textAlign: 'center', paddingHorizontal: 40, lineHeight: 20,
      }}>
        Escanea el código de barras de un producto para ver su historial de movimientos
      </Text>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 28, backgroundColor: isDark ? '#2d2a28' : '#f5f5f4',
        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
      }}>
        <BarcodeIcon size={18} color={colors.textSecondary} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
          Presiona el botón lateral del escáner
        </Text>
      </View>
    </View>
  )
}

// ─── Movement Row ───────────────────────────────────────────────────
function MovementRow({ item, isDark, colors, index }: {
  item: Movement; isDark: boolean; colors: any; index: number
}) {
  const isPositive = item.quantity > 0
  const color = typeColors[item.type] || (isPositive ? '#10b981' : '#ef4444')
  const icon = typeIcons[item.type] || (isPositive ? '📥' : '📤')

  const dateStr = (() => {
    try {
      const d = new Date(item.date)
      const day = d.getDate().toString().padStart(2, '0')
      const month = (d.getMonth() + 1).toString().padStart(2, '0')
      const year = d.getFullYear()
      const hours = d.getHours().toString().padStart(2, '0')
      const mins = d.getMinutes().toString().padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${mins}`
    } catch {
      return item.date
    }
  })()

  return (
    <Animated.View entering={FadeIn.delay(Math.min(index * 40, 400)).duration(200)}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isDark ? '#2d2a28' : '#fff',
        borderRadius: 14, padding: 12, marginBottom: 6,
        borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
      }}>
        {/* Icon */}
        <View style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: color + '15',
          alignItems: 'center', justifyContent: 'center', marginRight: 10,
        }}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
            {item.typeLabel || item.type}
          </Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginTop: 2 }}>
            {dateStr}
          </Text>
          {item.reference ? (
            <Text numberOfLines={1} style={{ fontSize: 10, color: '#3b82f6', fontWeight: '600', marginTop: 1 }}>
              {item.reference}
            </Text>
          ) : null}
          {item.fromWarehouse || item.toWarehouse ? (
            <Text numberOfLines={1} style={{ fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>
              {item.fromWarehouse ? `De: ${item.fromWarehouse}` : ''}
              {item.fromWarehouse && item.toWarehouse ? ' → ' : ''}
              {item.toWarehouse ? `A: ${item.toWarehouse}` : ''}
            </Text>
          ) : null}
        </View>

        {/* Quantity + stock after */}
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{
            backgroundColor: color,
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 44, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>
              {isPositive ? '+' : ''}{item.quantity}
            </Text>
          </View>
          <Text style={{ fontSize: 9, color: colors.textSecondary, marginTop: 3, fontWeight: '600' }}>
            Stock: {item.stockAfter}
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

// ─── Movements Detail View ──────────────────────────────────────────
function MovementsDetail({ product, currentStock, movements, isDark, colors, onClear }: {
  product: ProductInfo; currentStock: number; movements: Movement[]
  isDark: boolean; colors: any; onClear: () => void
}) {
  // Count by type
  const inCount = movements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
  const outCount = movements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)

  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product header */}
        <View style={{
          backgroundColor: isDark ? '#2d2a28' : '#fff',
          borderRadius: 18, padding: 16, marginBottom: 10,
          borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
        }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 }}>
            {product.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View style={{
              backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                SKU: {product.sku}
              </Text>
            </View>
            {product.barcode ? (
              <View style={{
                backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
                borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                  BC: {product.barcode}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 14, padding: 12, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#3b82f6' }}>{currentStock}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>
              Stock Actual
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 14, padding: 12, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#10b981' }}>+{inCount}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>
              Entradas
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 14, padding: 12, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#ef4444' }}>-{outCount}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>
              Salidas
            </Text>
          </View>
        </View>

        {/* Movements list */}
        <Text style={{
          fontSize: 11, fontWeight: '700', color: colors.textSecondary,
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
        }}>
          {movements.length} movimiento{movements.length !== 1 ? 's' : ''}
        </Text>

        {movements.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 30 }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
              Sin movimientos registrados
            </Text>
          </View>
        ) : (
          movements.map((m, idx) => (
            <MovementRow key={m.id} item={m} isDark={isDark} colors={colors} index={idx} />
          ))
        )}

        {/* Scan another */}
        <TouchableOpacity onPress={onClear} activeOpacity={0.8} style={{
          backgroundColor: '#eb5b0c',
          borderRadius: 14, paddingVertical: 14, alignItems: 'center',
          flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12,
          shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
        }}>
          <BarcodeIcon size={20} color="#fff" />
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
            Escanear otro producto
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────
export function ProductMovementsScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation()
  const { processBarcode, isProcessing } = useScannerStore()
  const warehouseId = useAuthStore((s) => s.warehouseId)

  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [currentStock, setCurrentStock] = useState(0)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const handleScan = useCallback(async (barcode: string) => {
    const scanned = await processBarcode(barcode)
    if (!scanned || !warehouseId) {
      showToast('error', 'Producto no encontrado')
      return
    }

    showToast('success', scanned.name)
    setLoading(true)

    try {
      const data = await api.get<any>(
        `/api/market/warehouses/${warehouseId}/product-movements?productId=${scanned.productId}${scanned.variantId ? `&variantId=${scanned.variantId}` : ''}`,
      )

      const p = data?.product || { id: scanned.productId, name: scanned.name, sku: scanned.sku, barcode: scanned.barcode }
      setProduct({
        id: p.id ?? scanned.productId,
        name: p.name ?? scanned.name,
        sku: p.sku ?? scanned.sku,
        barcode: p.barcode ?? scanned.barcode,
      })
      setCurrentStock(data?.currentStock ?? scanned.currentStock ?? 0)

      const rawMovements = data?.movements || (Array.isArray(data) ? data : [])
      setMovements(rawMovements.map((m: any) => ({
        id: m.id,
        date: m.date || m.created_at || '',
        type: m.type || '',
        typeLabel: m.typeLabel || m.type_label || m.type || '',
        quantity: m.quantity ?? 0,
        stockBefore: m.stockBefore ?? m.stock_before ?? 0,
        stockAfter: m.stockAfter ?? m.stock_after ?? 0,
        reference: m.reference || null,
        fromWarehouse: m.fromWarehouse || m.from_warehouse || null,
        toWarehouse: m.toWarehouse || m.to_warehouse || null,
        user: m.user || '',
        notes: m.notes || null,
      })))
    } catch (err: any) {
      setProduct({
        id: scanned.productId,
        name: scanned.name,
        sku: scanned.sku,
        barcode: scanned.barcode,
      })
      setCurrentStock(scanned.currentStock)
      setMovements([])
      showToast('error', err.message || 'Error al cargar movimientos')
    }
    setLoading(false)
  }, [processBarcode, warehouseId, showToast])

  useDataWedge(handleScan)

  const handleClear = useCallback(() => {
    setProduct(null)
    setMovements([])
    setCurrentStock(0)
  }, [])

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
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ marginRight: 14 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
          }}>
            <Text style={{ fontSize: 22, color: '#eb5b0c', fontWeight: '700' }}>‹</Text>
          </View>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, flex: 1 }}>
          Movimientos
        </Text>
        {(isProcessing || loading) && <ActivityIndicator size="small" color="#eb5b0c" />}
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: isDark ? '#2d2a28' : '#fff', borderRadius: 20, padding: 28, alignItems: 'center',
          }}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 12 }}>
              Cargando movimientos...
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {product && !loading ? (
        <MovementsDetail
          product={product}
          currentStock={currentStock}
          movements={movements}
          isDark={isDark}
          colors={colors}
          onClear={handleClear}
        />
      ) : !loading ? (
        <ScannerIdle isDark={isDark} colors={colors} />
      ) : null}

      {/* Toast */}
      {toast && <ScanToast message={toast.message} type={toast.type} />}
    </View>
  )
}
