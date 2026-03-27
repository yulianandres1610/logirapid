import React, { useState, useCallback, useRef } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore, type WholesaleDelivery } from '@/src/stores/operations-store'
import { useScannerStore } from '@/src/stores/scanner-store'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'
import { useThemeStore } from '@/src/stores/theme-store'

interface DispatchLine {
  lineId: number | null
  productId: number
  variantId: number | null
  name: string
  sku: string
  barcode: string
  imageUrl?: string
  quantity: number
  expectedQuantity: number
  dispatchedQuantity: number
}

function ScanToast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <Animated.View
      entering={SlideInUp.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        position: 'absolute', top: 0, left: 16, right: 16, zIndex: 50,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        shadowColor: type === 'success' ? '#10b981' : '#ef4444',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 8 }}>
        {type === 'success' ? '✓' : '✕'}
      </Text>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  )
}

export function WholesaleDetailScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation()
  const route = useRoute<RouteProp<{ params: { delivery: WholesaleDelivery } }, 'params'>>()
  const delivery = route.params.delivery
  const { validateWholesale, completeWholesale, isLoading } = useOperationsStore()
  const { processBarcode, isProcessing } = useScannerStore()

  const [lines, setLines] = useState<DispatchLine[]>(
    (delivery.lines || []).map(l => ({
      ...l,
      expectedQuantity: l.expectedQuantity || l.quantity,
      dispatchedQuantity: l.validatedQuantity || 0,
    }))
  )
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [lastScannedIdx, setLastScannedIdx] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flatListRef = useRef<FlatList>(null)

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const findLineByBarcode = useCallback((barcode: string): number => {
    const code = barcode.trim().toLowerCase()
    return lines.findIndex(
      l => (l.barcode && l.barcode.toLowerCase() === code) ||
           (l.sku && l.sku.toLowerCase() === code)
    )
  }, [lines])

  const incrementLine = useCallback((idx: number) => {
    const updated = [...lines]
    updated[idx] = { ...updated[idx], dispatchedQuantity: updated[idx].dispatchedQuantity + 1 }
    setLines(updated)
    setLastScannedIdx(idx)
    const expected = updated[idx].expectedQuantity
    showToast('success', `${updated[idx].name} (${updated[idx].dispatchedQuantity}/${expected})`)
    flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 })
  }, [lines, showToast])

  const handleScan = useCallback(async (barcode: string) => {
    let idx = findLineByBarcode(barcode)

    if (idx < 0) {
      const product = await processBarcode(barcode)
      if (!product) {
        playErrorBeep(); vibrateError()
        showToast('error', 'Producto no encontrado')
        return
      }
      idx = lines.findIndex(
        l => l.productId === product.productId && (!l.variantId || l.variantId === product.variantId)
      )
      if (idx < 0) {
        playErrorBeep(); vibrateError()
        showToast('error', `"${product.name}" no está en este despacho`)
        return
      }
    }

    const line = lines[idx]
    if (line.dispatchedQuantity >= line.expectedQuantity) {
      playErrorBeep(); vibrateError()
      showToast('error', `${line.name} — cantidad completa`)
      return
    }

    playSuccessBeep(); vibrateSuccess()
    incrementLine(idx)
  }, [lines, findLineByBarcode, incrementLine, showToast])

  useDataWedge(handleScan)

  const handleDispatchAll = () => {
    Alert.alert('Despachar Todo', '¿Marcar todas las cantidades como despachadas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Despachar Todo',
        onPress: () => {
          setLines(prev => prev.map(l => ({ ...l, dispatchedQuantity: l.expectedQuantity })))
          showToast('success', 'Todas las cantidades marcadas')
        },
      },
    ])
  }

  const handleConfirm = () => {
    const linesToSend = lines
      .filter(l => l.dispatchedQuantity > 0)
      .map(l => ({ lineId: l.lineId, quantityValidated: l.dispatchedQuantity }))

    if (linesToSend.length === 0) {
      showToast('error', 'No hay productos despachados')
      return
    }

    Alert.alert(
      allComplete ? 'Completar Despacho' : 'Confirmar Parcial',
      `${totalDispatched} de ${totalExpected} unidades.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: allComplete ? 'Completar' : 'Confirmar Parcial',
          onPress: async () => {
            setConfirming(true)
            try {
              await validateWholesale(delivery.id, linesToSend)
              if (allComplete) {
                await completeWholesale(delivery.id)
              }
              showToast('success', allComplete ? '¡Despacho completado!' : 'Despacho parcial validado')
              setTimeout(() => navigation.goBack(), 600)
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Error al confirmar')
            }
            setConfirming(false)
          },
        },
      ]
    )
  }

  const totalExpected = lines.reduce((s, l) => s + l.expectedQuantity, 0)
  const totalDispatched = lines.reduce((s, l) => s + l.dispatchedQuantity, 0)
  const pct = totalExpected > 0 ? Math.round((totalDispatched / totalExpected) * 100) : 0
  const allComplete = totalDispatched >= totalExpected && totalExpected > 0

  const renderItem = useCallback(({ item: line, index: idx }: { item: DispatchLine; index: number }) => {
    const expected = line.expectedQuantity
    const isComplete = line.dispatchedQuantity >= expected
    const isLast = idx === lastScannedIdx
    const hasDisp = line.dispatchedQuantity > 0

    return (
      <View style={{
        backgroundColor: isComplete ? (isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4')
          : isLast ? (isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff')
          : isDark ? '#2d2a28' : '#fff',
        borderRadius: 14, padding: 12, marginBottom: 8, marginHorizontal: 16,
        borderWidth: isLast ? 2 : 1,
        borderColor: isLast ? '#3b82f6' : isComplete ? (isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7') : isDark ? '#3f3b39' : '#f0efee',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: isComplete ? 'rgba(16,185,129,0.15)' : isDark ? '#3f3b39' : '#f5f5f4',
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
          }}>
            <Text style={{ fontSize: 16 }}>{isComplete ? '✅' : '📦'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{line.name}</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
              {line.sku}{line.barcode && line.barcode !== line.sku ? ` | ${line.barcode}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>PEDIDO</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textSecondary }}>{expected}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity onPress={() => {
              if (line.dispatchedQuantity > 0) {
                const u = [...lines]; u[idx] = { ...u[idx], dispatchedQuantity: u[idx].dispatchedQuantity - 1 }; setLines(u)
              }
            }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#3f3b39' : '#f5f5f4' }} activeOpacity={0.6}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textMuted }}>−</Text>
            </TouchableOpacity>
            <View style={{
              minWidth: 56, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: isComplete ? '#10b981' : hasDisp ? '#3b82f6' : (isDark ? '#3f3b39' : '#e7e5e4'), paddingHorizontal: 8,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: (isComplete || hasDisp) ? '#fff' : colors.text }}>{line.dispatchedQuantity}</Text>
            </View>
            <TouchableOpacity onPress={() => {
              if (line.dispatchedQuantity < expected) {
                const u = [...lines]; u[idx] = { ...u[idx], dispatchedQuantity: u[idx].dispatchedQuantity + 1 }; setLines(u); setLastScannedIdx(idx)
              }
            }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eb5b0c' }} activeOpacity={0.6}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => {
            const u = [...lines]; u[idx] = { ...u[idx], dispatchedQuantity: expected }; setLines(u); setLastScannedIdx(idx)
          }} disabled={isComplete} style={{
            paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
            backgroundColor: isComplete ? (isDark ? '#3f3b39' : '#f5f5f4') : (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff'),
          }} activeOpacity={0.7}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: isComplete ? colors.textMuted : '#3b82f6' }}>{isComplete ? 'Listo' : 'Todo'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }, [lines, lastScannedIdx, isDark, colors])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: isDark ? 0 : 1, borderBottomColor: isDark ? 'transparent' : '#e7e5e4' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#3f3b39' : '#f5f5f4' }}>
            <Text style={{ fontSize: 20, color: '#eb5b0c', fontWeight: '700' }}>‹</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{delivery.invoiceNumber}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{delivery.customerName} · Despacho</Text>
        </View>
        {isProcessing && <ActivityIndicator size="small" color="#eb5b0c" />}
      </View>

      {confirming && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: isDark ? '#2d2a28' : '#fff', borderRadius: 24, padding: 32, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>Procesando despacho...</Text>
          </View>
        </View>
      )}

      {/* Progress + Despachar Todo */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.separator }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{totalDispatched}/{totalExpected} unidades</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!allComplete && (
              <TouchableOpacity onPress={handleDispatchAll} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#eb5b0c' }} activeOpacity={0.7}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Despachar Todo</Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 13, fontWeight: '800', color: allComplete ? '#10b981' : '#3b82f6' }}>{allComplete ? '✓ COMPLETO' : `${pct}%`}</Text>
          </View>
        </View>
        <View style={{ height: 6, backgroundColor: isDark ? '#3f3b39' : '#e7e5e4', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ height: '100%', borderRadius: 3, backgroundColor: allComplete ? '#10b981' : '#3b82f6', width: `${Math.min(pct, 100)}%` }} />
        </View>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>Escanee productos o use los botones +/- para despachar</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={lines}
        keyExtractor={(item, idx) => `${item.productId}-${item.variantId}-${idx}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>📭</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>Sin productos para despachar</Text>
          </View>
        }
      />

      {totalDispatched > 0 && (
        <Animated.View entering={FadeIn.duration(150)} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 20,
          backgroundColor: isDark ? '#0c0a09' : '#fff',
          borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
          shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
        }}>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8} style={{
            backgroundColor: allComplete ? '#10b981' : '#3b82f6',
            borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            shadowColor: allComplete ? '#10b981' : '#3b82f6',
            shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {allComplete ? '✓ Completar Despacho' : `Confirmar Parcial (${totalDispatched}/${totalExpected})`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {toast && <ScanToast message={toast.message} type={toast.type} />}
    </View>
  )
}
