import React, { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated'
import { LotExpirationForm } from '@/src/components/LotExpirationForm'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore, type PendingOrder, type OperationLine } from '@/src/stores/operations-store'
import { useScannerStore } from '@/src/stores/scanner-store'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'
import { useThemeStore } from '@/src/stores/theme-store'
import { api } from '@/src/services/api'

interface ReceiveLine extends OperationLine {
  receivedQuantity: number
  lotNumber: string
  expirationDate: string
}

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
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  )
}

export function ReceptionDetailScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation()
  const route = useRoute<RouteProp<{ params: { order: PendingOrder } }, 'params'>>()
  const order = route.params.order
  const { receiveOrder } = useOperationsStore()
  const { processBarcode, isProcessing } = useScannerStore()
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>(
    (order.lines || []).map((l) => ({
      ...l,
      receivedQuantity: (l as any).quantityReceived || 0,
      lotNumber: '',
      expirationDate: '',
    })),
  )
  const [activeLotIndex, setActiveLotIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [lastScannedIdx, setLastScannedIdx] = useState<number | null>(null)
  const [loadingLines, setLoadingLines] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flatListRef = useRef<FlatList>(null)

  // If order has no lines (came from pending list), fetch them from API
  useEffect(() => {
    if (receiveLines.length === 0 && order.id && order.type === 'purchase') {
      setLoadingLines(true)
      api.get<any>(`/api/market/purchases/${order.id}`)
        .then((data) => {
          if (data?.lines && data.lines.length > 0) {
            const mapped = data.lines.map((l: any) => ({
              lineId: l.id,
              productId: l.productId,
              variantId: l.variantId || null,
              name: l.variantName ? `${l.productName} - ${l.variantName}` : l.productName,
              sku: l.variantSku || l.productSku || '',
              barcode: l.variantBarcode || l.productBarcode || l.variantSku || l.productSku || '',
              quantity: parseFloat(l.quantity) || 0,
              expectedQuantity: parseFloat(l.quantity) || 0,
              imageUrl: l.productImage || null,
              unitPrice: parseFloat(l.unitPrice) || 0,
              receivedQuantity: parseFloat(l.quantityReceived) || 0,
              lotNumber: '',
              expirationDate: '',
            }))
            setReceiveLines(mapped)
          }
        })
        .catch((err) => console.error('[ReceptionDetail] Failed to load lines:', err))
        .finally(() => setLoadingLines(false))
    }
  }, [])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  // Find line by barcode directly (O(1) lookup by barcode in order lines)
  const findLineByBarcode = useCallback((barcode: string): number => {
    const code = barcode.trim().toLowerCase()
    return receiveLines.findIndex(
      (l) => (l.barcode && l.barcode.toLowerCase() === code) ||
             (l.sku && l.sku.toLowerCase() === code)
    )
  }, [receiveLines])

  const handleScan = useCallback(async (barcode: string) => {
    // First try direct match in order lines (fastest)
    let idx = findLineByBarcode(barcode)

    if (idx >= 0) {
      // Direct match — increment
      const line = receiveLines[idx]
      const expected = line.expectedQuantity || line.quantity
      const updated = [...receiveLines]
      updated[idx] = { ...updated[idx], receivedQuantity: updated[idx].receivedQuantity + 1 }
      setReceiveLines(updated)
      setLastScannedIdx(idx)
      setActiveLotIndex(idx)
      playSuccessBeep()
      vibrateSuccess()
      showToast('success', `${line.name} (${updated[idx].receivedQuantity}/${expected})`)
      // Scroll to item
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 })
      return
    }

    // Fallback: use server-side barcode lookup
    const product = await processBarcode(barcode)
    if (!product) {
      playErrorBeep()
      vibrateError()
      showToast('error', 'Producto no encontrado')
      return
    }

    idx = receiveLines.findIndex(
      (l) => l.productId === product.productId && (!l.variantId || l.variantId === product.variantId),
    )

    if (idx >= 0) {
      const line = receiveLines[idx]
      const expected = line.expectedQuantity || line.quantity
      const updated = [...receiveLines]
      updated[idx] = { ...updated[idx], receivedQuantity: updated[idx].receivedQuantity + 1 }
      setReceiveLines(updated)
      setLastScannedIdx(idx)
      setActiveLotIndex(idx)
      playSuccessBeep()
      vibrateSuccess()
      showToast('success', `${product.name} (${updated[idx].receivedQuantity}/${expected})`)
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 })
    } else {
      playErrorBeep()
      vibrateError()
      showToast('error', `"${product.name}" no está en esta orden`)
    }
  }, [receiveLines, findLineByBarcode, showToast])

  useDataWedge(handleScan)

  const handleLotConfirm = (lotNumber: string, expirationDate: string) => {
    if (activeLotIndex !== null) {
      const updated = [...receiveLines]
      updated[activeLotIndex] = { ...updated[activeLotIndex], lotNumber, expirationDate }
      setReceiveLines(updated)
      setActiveLotIndex(null)
    }
  }

  const handleIncrement = (idx: number) => {
    const updated = [...receiveLines]
    updated[idx] = { ...updated[idx], receivedQuantity: updated[idx].receivedQuantity + 1 }
    setReceiveLines(updated)
    setLastScannedIdx(idx)
  }

  const handleDecrement = (idx: number) => {
    if (receiveLines[idx].receivedQuantity > 0) {
      const updated = [...receiveLines]
      updated[idx] = { ...updated[idx], receivedQuantity: updated[idx].receivedQuantity - 1 }
      setReceiveLines(updated)
    }
  }

  const handleReceiveAll = (idx: number) => {
    const line = receiveLines[idx]
    const expected = line.expectedQuantity || line.quantity
    const updated = [...receiveLines]
    updated[idx] = { ...updated[idx], receivedQuantity: expected }
    setReceiveLines(updated)
    setLastScannedIdx(idx)
  }

  const handleConfirm = async () => {
    const linesToSend = receiveLines
      .filter((l) => l.receivedQuantity > 0)
      .map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.receivedQuantity,
        lotNumber: l.lotNumber || undefined,
        expirationDate: l.expirationDate || undefined,
      }))

    if (linesToSend.length === 0) {
      showToast('error', 'No hay productos recibidos')
      return
    }

    Alert.alert(
      allComplete ? 'Completar Recepción' : 'Confirmar Parcial',
      `${totalReceived} de ${totalExpected} unidades.\n¿Confirmar recepción?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setConfirming(true)
            try {
              await receiveOrder(order.type, order.id, linesToSend)
              showToast('success', '¡Recepción completada!')
              setTimeout(() => navigation.goBack(), 600)
            } catch (err: any) {
              showToast('error', err.message || 'Error al confirmar')
            }
            setConfirming(false)
          },
        },
      ]
    )
  }

  const totalExpected = receiveLines.reduce((s, l) => s + (l.expectedQuantity || l.quantity), 0)
  const totalReceived = receiveLines.reduce((s, l) => s + l.receivedQuantity, 0)
  const linesWithReceived = receiveLines.filter(l => l.receivedQuantity > 0).length
  const pct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0
  const allComplete = totalReceived >= totalExpected && totalExpected > 0

  const renderItem = useCallback(({ item: line, index: idx }: { item: ReceiveLine; index: number }) => {
    const expected = line.expectedQuantity || line.quantity
    const isComplete = line.receivedQuantity >= expected
    const isLastScanned = idx === lastScannedIdx
    const hasReceived = line.receivedQuantity > 0

    return (
      <View
        style={{
          backgroundColor: isComplete
            ? isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4'
            : isLastScanned
              ? isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff'
              : isDark ? '#2d2a28' : '#fff',
          borderRadius: 14, padding: 12, marginBottom: 8, marginHorizontal: 16,
          borderWidth: isLastScanned ? 2 : 1,
          borderColor: isLastScanned ? '#3b82f6'
            : isComplete ? isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7'
            : isDark ? '#3f3b39' : '#f0efee',
        }}
      >
        {/* Product info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: isComplete ? 'rgba(16,185,129,0.15)' : isDark ? '#3f3b39' : '#f5f5f4',
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
          }}>
            <Text style={{ fontSize: 16 }}>{isComplete ? '✅' : '📦'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {line.name}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
              SKU: {line.sku}{line.barcode && line.barcode !== line.sku ? ` | ${line.barcode}` : ''}
            </Text>
          </View>
        </View>

        {/* Quantity row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Expected */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>ESPERADO</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textSecondary }}>{expected}</Text>
          </View>

          {/* +/- Controls */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              onPress={() => handleDecrement(idx)}
              style={{
                width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
              }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textMuted }}>−</Text>
            </TouchableOpacity>

            <View style={{
              minWidth: 56, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: isComplete ? '#10b981' : hasReceived ? '#3b82f6' : (isDark ? '#3f3b39' : '#e7e5e4'),
              paddingHorizontal: 8,
            }}>
              <Text style={{
                fontSize: 18, fontWeight: '900',
                color: (isComplete || hasReceived) ? '#fff' : colors.text,
              }}>
                {line.receivedQuantity}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleIncrement(idx)}
              style={{
                width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#eb5b0c',
              }}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Receive All button */}
          <TouchableOpacity
            onPress={() => handleReceiveAll(idx)}
            disabled={isComplete}
            style={{
              paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
              backgroundColor: isComplete ? (isDark ? '#3f3b39' : '#f5f5f4') : (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff'),
            }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: 11, fontWeight: '700',
              color: isComplete ? colors.textMuted : '#3b82f6',
            }}>
              {isComplete ? 'Listo' : 'Todo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lot info */}
        {line.lotNumber ? (
          <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.separator }}>
            <Text style={{ fontSize: 10, color: '#2563eb', fontWeight: '600' }}>
              Lote: {line.lotNumber} {line.expirationDate ? `| Exp: ${line.expirationDate}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }, [receiveLines, lastScannedIdx, isDark, colors])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: colors.card,
        borderBottomWidth: isDark ? 0 : 1,
        borderBottomColor: isDark ? 'transparent' : '#e7e5e4',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <View style={{
            width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
          }}>
            <Text style={{ fontSize: 20, color: '#eb5b0c', fontWeight: '700' }}>‹</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{order.orderNumber}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{order.supplierName}</Text>
        </View>
        {isProcessing && <ActivityIndicator size="small" color="#eb5b0c" />}
      </View>

      {/* Confirming overlay */}
      {confirming && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ backgroundColor: isDark ? '#2d2a28' : '#fff', borderRadius: 24, padding: 32, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>Procesando...</Text>
          </View>
        </View>
      )}

      {/* Progress bar */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.separator,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
            {totalReceived}/{totalExpected} unidades ({linesWithReceived}/{receiveLines.length} productos)
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: allComplete ? '#10b981' : '#3b82f6' }}>
            {allComplete ? '✓ COMPLETO' : `${pct}%`}
          </Text>
        </View>
        <View style={{ height: 6, backgroundColor: isDark ? '#3f3b39' : '#e7e5e4', borderRadius: 3, overflow: 'hidden' }}>
          <View style={{
            height: '100%', borderRadius: 3,
            backgroundColor: allComplete ? '#10b981' : '#3b82f6',
            width: `${Math.min(pct, 100)}%`,
          }} />
        </View>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
          Escanee los productos con el lector de código de barras
        </Text>
      </View>

      {/* Lot form */}
      {activeLotIndex !== null && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <LotExpirationForm
            onConfirm={handleLotConfirm}
            onSkip={() => setActiveLotIndex(null)}
          />
        </View>
      )}

      {/* Product list */}
      <FlatList
        ref={flatListRef}
        data={receiveLines}
        keyExtractor={(item, idx) => `${item.productId}-${item.variantId}-${idx}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            {loadingLines ? (
              <>
                <ActivityIndicator size="large" color="#eb5b0c" />
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12 }}>
                  Cargando productos...
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📭</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>
                  Sin productos en esta orden
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* Bottom confirm button */}
      {totalReceived > 0 && (
        <Animated.View entering={FadeIn.duration(150)} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: 16, paddingBottom: 20, backgroundColor: isDark ? '#0c0a09' : '#fff',
          borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
          shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
        }}>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8} style={{
            backgroundColor: allComplete ? '#10b981' : '#3b82f6',
            borderRadius: 16, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            shadowColor: allComplete ? '#10b981' : '#3b82f6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {allComplete ? '✓ Completar Recepción' : `Confirmar Parcial (${totalReceived}/${totalExpected})`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Toast */}
      {toast && <ScanToast message={toast.message} type={toast.type} />}
    </View>
  )
}
