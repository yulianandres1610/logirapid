import React, { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Animated, {
  FadeIn, FadeOut, SlideInUp,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSequence, Easing, interpolate,
} from 'react-native-reanimated'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useScannerStore, type ScannedProduct } from '@/src/stores/scanner-store'
import { useThemeStore } from '@/src/stores/theme-store'

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
      {/* Animated rings */}
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[ring2Style, {
          position: 'absolute', width: 140, height: 140, borderRadius: 70,
          borderWidth: 2, borderColor: '#eb5b0c',
        }]} />
        <Animated.View style={[ring1Style, {
          position: 'absolute', width: 110, height: 110, borderRadius: 55,
          borderWidth: 2, borderColor: '#eb5b0c',
        }]} />
        <View style={{
          width: 80, height: 80, borderRadius: 20,
          backgroundColor: isDark ? 'rgba(235,91,12,0.1)' : 'rgba(235,91,12,0.08)',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <BarcodeIcon size={36} color="#eb5b0c" />
          <Animated.View style={[lineStyle, {
            position: 'absolute', left: 8, right: 8, height: 2,
            backgroundColor: '#eb5b0c', borderRadius: 1,
          }]} />
        </View>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 24 }}>
        Consulta de Stock
      </Text>
      <Text style={{
        fontSize: 13, color: colors.textSecondary, marginTop: 8,
        textAlign: 'center', paddingHorizontal: 40, lineHeight: 20,
      }}>
        Escanea el código de barras de un producto para ver su ficha completa
      </Text>

      {/* Visual hint */}
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

// ─── Product Detail Card ────────────────────────────────────────────
function ProductDetailCard({ product, isDark, colors, onClear }: {
  product: ScannedProduct; isDark: boolean; colors: any; onClear: () => void
}) {
  const stockStatus = product.currentStock <= 0 ? 'out'
    : product.quantityAvailable <= 5 ? 'low' : 'ok'
  const statusColor = stockStatus === 'out' ? '#ef4444' : stockStatus === 'low' ? '#f59e0b' : '#10b981'
  const statusLabel = stockStatus === 'out' ? 'Sin Stock' : stockStatus === 'low' ? 'Stock Bajo' : 'En Stock'

  // Format stock numbers: use commas, hide decimals if .0
  const fmtQty = (n: number) => {
    const s = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '')
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  // Dynamic font size based on number length
  const qtyFont = (n: number) => {
    const len = fmtQty(n).length
    if (len > 8) return 16
    if (len > 6) return 18
    if (len > 4) return 22
    return 26
  }

  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        {product.image ? (
          <View style={{
            alignItems: 'center', marginBottom: 16,
            backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 20, padding: 16,
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Image
              source={{ uri: product.image }}
              style={{ width: 180, height: 180, borderRadius: 16 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={{
            alignItems: 'center', marginBottom: 16,
            backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 20, padding: 24,
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <View style={{
              width: 100, height: 100, borderRadius: 24,
              backgroundColor: isDark ? '#1c1917' : '#fafaf9',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 48 }}>📦</Text>
            </View>
          </View>
        )}

        {/* Name + Category */}
        <View style={{
          backgroundColor: isDark ? '#2d2a28' : '#fff',
          borderRadius: 18, padding: 16, marginBottom: 10,
          borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 }}>
            {product.name}
          </Text>
          {product.description ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 }}>
              {product.description}
            </Text>
          ) : null}
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
            {product.category ? (
              <View style={{
                backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
                borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '700' }}>
                  {product.category}
                </Text>
              </View>
            ) : null}
            <View style={{
              backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                {product.unit}
              </Text>
            </View>
          </View>
        </View>

        {/* Stock Status — Big card */}
        <View style={{
          backgroundColor: isDark ? '#2d2a28' : '#fff',
          borderRadius: 18, padding: 16, marginBottom: 10,
          borderWidth: 1.5, borderColor: statusColor + '40',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{
              width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor, marginRight: 8,
              shadowColor: statusColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6,
            }} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: statusColor }}>{statusLabel}</Text>
            {product.warehouseName ? (
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 'auto', fontWeight: '600' }}>
                {product.warehouseName}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{
              flex: 1, alignItems: 'center',
              backgroundColor: isDark ? '#1c1917' : '#fafaf9',
              borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4,
            }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: qtyFont(product.currentStock), fontWeight: '900', color: statusColor }}>
                {fmtQty(product.currentStock)}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>
                En Mano
              </Text>
            </View>
            <View style={{
              flex: 1, alignItems: 'center',
              backgroundColor: isDark ? '#1c1917' : '#fafaf9',
              borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4,
            }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: qtyFont(product.quantityAvailable), fontWeight: '900', color: '#3b82f6' }}>
                {fmtQty(product.quantityAvailable)}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>
                Disponible
              </Text>
            </View>
            <View style={{
              flex: 1, alignItems: 'center',
              backgroundColor: isDark ? '#1c1917' : '#fafaf9',
              borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4,
            }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: qtyFont(product.quantityReserved), fontWeight: '900', color: '#f59e0b' }}>
                {fmtQty(product.quantityReserved)}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>
                Reservado
              </Text>
            </View>
          </View>
        </View>

        {/* Prices */}
        <View style={{
          flexDirection: 'row', gap: 10, marginBottom: 10,
        }}>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 16, padding: 14, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>
              Costo
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>
              ${product.costPrice?.toFixed(2) || '0.00'}
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 16, padding: 14, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>
              Venta
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#10b981' }}>
              ${product.sellingPrice?.toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>

        {/* Variants */}
        {product.variants && product.variants.length > 0 && (
          <View style={{
            backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 18, padding: 16, marginBottom: 10,
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: colors.textSecondary,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>
              {product.variants.length} Variante{product.variants.length !== 1 ? 's' : ''}
            </Text>
            {product.variants.map((v, idx) => (
              <View key={v.id} style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: isDark ? '#3f3b39' : '#f5f5f4',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{v.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginTop: 2 }}>
                    SKU: {v.sku} {v.barcode ? `· BC: ${v.barcode}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{
                    backgroundColor: v.stock > 0 ? '#10b981' : '#ef4444',
                    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{v.stock}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                    ${v.price?.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Lots / Expiration */}
        {product.lots && product.lots.length > 0 && (
          <View style={{
            backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 18, padding: 16, marginBottom: 10,
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: colors.textSecondary,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
            }}>
              {product.lots.length} Lote{product.lots.length !== 1 ? 's' : ''} Disponible{product.lots.length !== 1 ? 's' : ''}
            </Text>
            {product.lots.map((lot: any, idx: number) => {
              const isExpired = lot.expirationDate && new Date(lot.expirationDate) < new Date()
              const isNearExpiry = lot.expirationDate && !isExpired &&
                (new Date(lot.expirationDate).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000

              const formatDate = (d: string | null) => {
                if (!d) return 'Sin vencimiento'
                const date = new Date(d)
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
              }

              return (
                <View key={lot.lotNumber + idx} style={{
                  paddingVertical: 10,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: isDark ? '#3f3b39' : '#f5f5f4',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{lot.lotNumber}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                        <Text style={{
                          fontSize: 12, fontWeight: '600',
                          color: isExpired ? '#ef4444' : isNearExpiry ? '#f59e0b' : colors.textSecondary,
                        }}>
                          {isExpired ? '⚠ Vencido: ' : isNearExpiry ? '⏰ Vence: ' : 'Vence: '}
                          {formatDate(lot.expirationDate)}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          · ${lot.unitCost?.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <View style={{
                      backgroundColor: isExpired ? '#fef2f2' : isNearExpiry ? '#fffbeb' : (isDark ? '#1c1917' : '#f0fdf4'),
                      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
                    }}>
                      <Text style={{
                        fontSize: 16, fontWeight: '900',
                        color: isExpired ? '#ef4444' : isNearExpiry ? '#f59e0b' : '#10b981',
                      }}>
                        {lot.quantityAvailable}
                      </Text>
                      <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '600' }}>uds</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Scan another button */}
        <TouchableOpacity onPress={onClear} activeOpacity={0.8} style={{
          backgroundColor: '#eb5b0c',
          borderRadius: 14, paddingVertical: 14, alignItems: 'center',
          flexDirection: 'row', justifyContent: 'center', gap: 8,
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
export function StockInquiryScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation()
  const { processBarcode, isProcessing, clear } = useScannerStore()
  const [product, setProduct] = useState<ScannedProduct | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const handleScan = useCallback(async (barcode: string) => {
    const result = await processBarcode(barcode)
    if (result) {
      setProduct(result)
      showToast('success', result.name)
    } else {
      setProduct(null)
      showToast('error', 'Producto no encontrado')
    }
  }, [processBarcode, showToast])

  useDataWedge(handleScan)

  const handleClear = useCallback(() => {
    setProduct(null)
    clear()
  }, [clear])

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
          Consulta de Stock
        </Text>
        {isProcessing && <ActivityIndicator size="small" color="#eb5b0c" />}
      </View>

      {/* Loading overlay */}
      {isProcessing && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: isDark ? '#2d2a28' : '#fff', borderRadius: 20, padding: 28, alignItems: 'center',
          }}>
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 12 }}>
              Buscando producto...
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {product ? (
          <ProductDetailCard product={product} isDark={isDark} colors={colors} onClear={handleClear} />
        ) : (
          <ScannerIdle isDark={isDark} colors={colors} />
        )}
      </View>

      {/* Toast */}
      {toast && <ScanToast message={toast.message} type={toast.type} />}
    </View>
  )
}
