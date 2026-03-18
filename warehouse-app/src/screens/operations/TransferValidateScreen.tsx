import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { OperationsStackParamList } from '@/src/navigation/types'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInUp,
  Easing,
} from 'react-native-reanimated'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore, type Transfer } from '@/src/stores/operations-store'
import { useScannerStore } from '@/src/stores/scanner-store'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'
import { useThemeStore } from '@/src/stores/theme-store'

// ─── Custom Header ───────────────────────────────────────────────────
function ScreenHeader({ title, onBack, isDark, colors }: { title: string; onBack: () => void; isDark: boolean; colors: any }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: isDark ? 0 : 1,
      borderBottomColor: isDark ? 'transparent' : '#e7e5e4',
    }}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ marginRight: 14 }}>
        <View style={{
          width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
        }}>
          <Text style={{ fontSize: 22, color: '#eb5b0c', fontWeight: '700' }}>‹</Text>
        </View>
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>{title}</Text>
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

// ─── Barcode Scanner Icon ────────────────────────────────────────────
function BarcodeIcon({ size = 36, color = '#eb5b0c' }: { size?: number; color?: string }) {
  const barWidths = [3, 2, 4, 2, 3, 1, 4, 2, 3, 2, 4, 1, 3]
  const gap = 1.5
  const totalWidth = barWidths.reduce((s, w) => s + w, 0) + (barWidths.length - 1) * gap
  const scale = (size * 0.7) / totalWidth
  const barHeight = size * 0.65

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: barHeight }}>
        {barWidths.map((w, i) => (
          <View key={i} style={{
            width: w * scale, height: i % 3 === 0 ? barHeight : barHeight * 0.85,
            backgroundColor: color, borderRadius: 0.5, marginLeft: i > 0 ? gap * scale : 0,
          }} />
        ))}
      </View>
    </View>
  )
}

// ─── Scanner Animation ──────────────────────────────────────────────
function ScannerAnimation({ isDark }: { isDark: boolean }) {
  const pulse1 = useSharedValue(0.6)
  const scanLine = useSharedValue(0)

  useEffect(() => {
    pulse1.value = withRepeat(withSequence(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      withTiming(0.6, { duration: 1500, easing: Easing.in(Easing.ease) }),
    ), -1, false)
    scanLine.value = withRepeat(withSequence(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
    ), -1, false)
  }, [])

  const ring1Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse1.value }], opacity: 1 - pulse1.value * 0.5 }))
  const lineStyle = useAnimatedStyle(() => ({ top: `${scanLine.value * 100}%` as any }))

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 140 }}>
      <Animated.View style={[ring1Style, { position: 'absolute', width: 130, height: 130, borderRadius: 44, borderWidth: 2, borderColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)' }]} />
      <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View style={[lineStyle, { position: 'absolute', left: 8, right: 8, height: 2, backgroundColor: '#10b981', borderRadius: 1 }]} />
        <View style={{ position: 'absolute', top: 6, left: 6, width: 14, height: 14, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#10b981', borderTopLeftRadius: 5 }} />
        <View style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#10b981', borderTopRightRadius: 5 }} />
        <View style={{ position: 'absolute', bottom: 6, left: 6, width: 14, height: 14, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#10b981', borderBottomLeftRadius: 5 }} />
        <View style={{ position: 'absolute', bottom: 6, right: 6, width: 14, height: 14, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#10b981', borderBottomRightRadius: 5 }} />
        <BarcodeIcon size={32} color="#10b981" />
      </View>
    </View>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────────
function ProgressCircle({ validated, expected, isDark, colors }: { validated: number; expected: number; isDark: boolean; colors: any }) {
  const pct = expected > 0 ? Math.round((validated / expected) * 100) : 0
  const isComplete = pct >= 100

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: isDark ? '#2d2a28' : '#fff',
      borderRadius: 16, padding: 14, marginBottom: 12,
      borderWidth: 1, borderColor: isComplete ? '#10b981' : isDark ? '#3f3b39' : '#f0efee',
    }}>
      <View style={{
        width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: isComplete ? 'rgba(16,185,129,0.15)' : isDark ? 'rgba(235,91,12,0.1)' : 'rgba(235,91,12,0.08)',
      }}>
        <Text style={{
          fontSize: 18, fontWeight: '900',
          color: isComplete ? '#10b981' : '#eb5b0c',
        }}>{pct}%</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
            {validated} de {expected} unidades
          </Text>
          {isComplete && (
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>✓ COMPLETO</Text>
          )}
        </View>
        <View style={{
          height: 6, backgroundColor: isDark ? '#3f3b39' : '#e7e5e4', borderRadius: 3, overflow: 'hidden',
        }}>
          <Animated.View style={{
            height: '100%', borderRadius: 3,
            backgroundColor: isComplete ? '#10b981' : '#eb5b0c',
            width: `${Math.min(pct, 100)}%`,
          }} />
        </View>
      </View>
    </View>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────
export function TransferValidateScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OperationsStackParamList>>()
  const { colors, isDark } = useThemeStore()
  const { pendingTransfers, fetchPendingTransfers, validateTransfer, isLoading } = useOperationsStore()
  const { processBarcode, isProcessing } = useScannerStore()
  const [selected, setSelected] = useState<Transfer | null>(null)
  const [validatedLines, setValidatedLines] = useState<Map<number, number>>(new Map())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastScannedLineId, setLastScannedLineId] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    fetchPendingTransfers()
  }, [])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1200)
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPendingTransfers()
    setRefreshing(false)
  }

  const handleScan = useCallback(async (barcode: string) => {
    if (!selected) return
    const product = await processBarcode(barcode)
    if (!product) {
      playErrorBeep()
      vibrateError()
      showToast('error', 'Producto no encontrado')
      return
    }

    const matchingLine = selected.lines.find(
      (l) => l.productId === product.productId && (!l.variantId || l.variantId === product.variantId),
    )

    if (matchingLine && matchingLine.lineId) {
      const current = validatedLines.get(matchingLine.lineId) || 0
      const expected = matchingLine.expectedQuantity || matchingLine.quantity
      if (current < expected) {
        const updated = new Map(validatedLines)
        updated.set(matchingLine.lineId, current + 1)
        setValidatedLines(updated)
        setLastScannedLineId(matchingLine.lineId)
        playSuccessBeep()
        vibrateSuccess()
        showToast('success', `${product.name} (${current + 1}/${expected})`)
      } else {
        playErrorBeep()
        vibrateError()
        showToast('error', `${product.name} — Cantidad completa`)
      }
    } else {
      playErrorBeep()
      vibrateError()
      showToast('error', 'No está en esta transferencia')
    }
  }, [selected, validatedLines, showToast])

  useDataWedge(handleScan)

  const handleConfirm = async () => {
    if (!selected) return
    setConfirming(true)
    const lines = Array.from(validatedLines.entries()).map(([lineId, qty]) => ({
      lineId,
      quantityValidated: qty,
    }))
    try {
      await validateTransfer(selected.id, lines)
      showToast('success', '¡Transferencia validada!')
      setTimeout(() => {
        setSelected(null)
        setValidatedLines(new Map())
        setLastScannedLineId(null)
        fetchPendingTransfers()
      }, 600)
    } catch (err: any) {
      showToast('error', err.message || 'Error al validar')
    }
    setConfirming(false)
  }

  const handleBack = useCallback(() => {
    if (selected) {
      setSelected(null)
      setValidatedLines(new Map())
      setLastScannedLineId(null)
    } else {
      navigation.navigate('OperationsMenu')
    }
  }, [selected, navigation])

  // ─── List View ─────────────────────────────────────────────────
  if (!selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Validar Transferencia" onBack={() => navigation.navigate('OperationsMenu')} isDark={isDark} colors={colors} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eb5b0c" />}
        >
          {isLoading && pendingTransfers.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator size="large" color="#eb5b0c" />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>Cargando...</Text>
            </View>
          ) : pendingTransfers.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', marginBottom: 16,
              }}>
                <Text style={{ fontSize: 36 }}>✅</Text>
              </View>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Todo al día</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                No hay transferencias pendientes de validar
              </Text>
            </View>
          ) : (
            <>
              <Text style={{
                fontSize: 11, fontWeight: '700', color: colors.textSecondary,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
              }}>
                {pendingTransfers.length} transferencia{pendingTransfers.length !== 1 ? 's' : ''} pendiente{pendingTransfers.length !== 1 ? 's' : ''}
              </Text>

              {pendingTransfers.map((t, i) => (
                <Animated.View key={t.id} entering={FadeIn.delay(i * 60).duration(200)}>
                  <TouchableOpacity
                    onPress={() => { setSelected(t); setValidatedLines(new Map()); setLastScannedLineId(null) }}
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
                        backgroundColor: isDark ? 'rgba(235,91,12,0.1)' : '#fff4eb', marginRight: 12,
                      }}>
                        <Text style={{ fontSize: 22 }}>📦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{t.operationNumber}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          De: {t.sourceWarehouseName}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#57534e' : '#a8a29e', marginTop: 1 }}>
                          {t.totalItems} productos • {t.lines?.length || 0} líneas
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

  // ─── Scan/Validate View ────────────────────────────────────────
  const totalExpected = selected.lines.reduce((s, l) => s + (l.expectedQuantity || l.quantity), 0)
  const totalValidated = Array.from(validatedLines.values()).reduce((s, v) => s + v, 0)
  const allComplete = totalValidated >= totalExpected && totalExpected > 0

  // Build display lines — last scanned first
  const displayLines = selected.lines
    .map((line) => ({
      ...line,
      validated: validatedLines.get(line.lineId!) || 0,
      expected: line.expectedQuantity || line.quantity,
    }))
    .sort((a, b) => {
      if (a.lineId === lastScannedLineId) return -1
      if (b.lineId === lastScannedLineId) return 1
      // Then show incomplete first
      const aComplete = a.validated >= a.expected
      const bComplete = b.validated >= b.expected
      if (aComplete !== bComplete) return aComplete ? 1 : -1
      return 0
    })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Validar" onBack={handleBack} isDark={isDark} colors={colors} />

      {/* Confirming overlay */}
      {confirming && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: isDark ? '#2d2a28' : '#fff', borderRadius: 24, padding: 32, alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
          }}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>Validando...</Text>
          </View>
        </View>
      )}

      {/* Transfer info chip + progress */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
          borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5',
        }}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>{selected.operationNumber}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>De: {selected.sourceWarehouseName}</Text>
          </View>
          {isProcessing && <ActivityIndicator size="small" color="#10b981" />}
        </View>

        <ProgressCircle validated={totalValidated} expected={totalExpected} isDark={isDark} colors={colors} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {totalValidated === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 16 }}>
            <ScannerAnimation isDark={isDark} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 12 }}>
              Escanea para validar
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20, paddingHorizontal: 24 }}>
              Escanea cada producto de la transferencia para verificar las cantidades
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 24,
              backgroundColor: isDark ? '#2d2a28' : '#f5f5f4', borderRadius: 14,
              paddingHorizontal: 16, paddingVertical: 12,
            }}>
              <Text style={{ fontSize: 16, marginRight: 10 }}>💡</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18 }}>
                Cada escaneo incrementa +1 la cantidad validada
              </Text>
            </View>

            {/* Show expected products as preview */}
            <View style={{ width: '100%', marginTop: 20 }}>
              <Text style={{
                fontSize: 11, fontWeight: '700', color: colors.textSecondary,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
              }}>
                Productos esperados ({selected.lines.length})
              </Text>
              {selected.lines.map((line) => (
                <View key={line.lineId} style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: isDark ? '#2d2a28' : '#fff',
                  borderRadius: 12, padding: 10, marginBottom: 6,
                  borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
                  opacity: 0.7,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
                    alignItems: 'center', justifyContent: 'center', marginRight: 10,
                  }}>
                    <Text style={{ fontSize: 16 }}>📦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{line.name}</Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>{line.sku}</Text>
                  </View>
                  <View style={{
                    backgroundColor: isDark ? '#3f3b39' : '#e7e5e4',
                    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                      0/{line.expectedQuantity || line.quantity}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginBottom: 10,
              backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4',
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.15)' : '#dcfce7',
            }}>
              <BarcodeIcon size={18} color="#10b981" />
              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600', flex: 1, marginLeft: 8 }}>
                {allComplete ? '¡Todo validado! Confirma la recepción' : 'Sigue escaneando productos'}
              </Text>
            </View>

            {displayLines.map((line) => {
              const isComplete = line.validated >= line.expected
              const isLastScanned = line.lineId === lastScannedLineId

              return (
                <View key={line.lineId} style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: isComplete
                    ? isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4'
                    : isDark ? '#2d2a28' : '#fff',
                  borderRadius: 14, padding: 10, marginBottom: 6,
                  borderWidth: isLastScanned ? 1.5 : 1,
                  borderColor: isLastScanned ? '#10b981'
                    : isComplete ? isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7'
                    : isDark ? '#3f3b39' : '#f0efee',
                }}>
                  {/* Product icon */}
                  <View style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: isLastScanned
                      ? isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)'
                      : isDark ? '#3f3b39' : '#f5f5f4',
                    alignItems: 'center', justifyContent: 'center', marginRight: 10,
                  }}>
                    {isComplete ? (
                      <Text style={{ fontSize: 18 }}>✅</Text>
                    ) : (
                      <Text style={{ fontSize: 18 }}>📦</Text>
                    )}
                  </View>

                  {/* Name + SKU */}
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text numberOfLines={1} style={{
                      fontSize: 13, fontWeight: '700',
                      color: isLastScanned ? '#10b981' : colors.text,
                    }}>
                      {line.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginTop: 1 }}>
                      {line.sku}
                    </Text>
                  </View>

                  {/* Count badge */}
                  <View style={{
                    backgroundColor: isComplete ? '#10b981' : isDark ? '#3f3b39' : '#e7e5e4',
                    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 50, alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: 14, fontWeight: '900',
                      color: isComplete ? '#fff' : colors.text,
                    }}>
                      {line.validated}/{line.expected}
                    </Text>
                  </View>
                </View>
              )
            })}
          </>
        )}
      </ScrollView>

      {/* Bottom confirm button */}
      {totalValidated > 0 && (
        <Animated.View entering={FadeIn.duration(150)} style={{
          padding: 16, paddingBottom: 20, backgroundColor: isDark ? '#0c0a09' : '#fff',
          borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
        }}>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8} style={{
            backgroundColor: allComplete ? '#10b981' : '#eb5b0c',
            borderRadius: 18, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            shadowColor: allComplete ? '#10b981' : '#eb5b0c',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {allComplete ? 'Completar Validación' : `Validar Parcial (${totalValidated}/${totalExpected})`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Inline toast */}
      {toast && <ScanToast message={toast.message} type={toast.type} />}
    </View>
  )
}
