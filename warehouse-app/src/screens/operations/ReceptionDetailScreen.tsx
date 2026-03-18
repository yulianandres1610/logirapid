import React, { useState, useCallback, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated'
import { LotExpirationForm } from '@/src/components/LotExpirationForm'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore, type PendingOrder, type OperationLine } from '@/src/stores/operations-store'
import { useScannerStore } from '@/src/stores/scanner-store'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'
import { useThemeStore } from '@/src/stores/theme-store'

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
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
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
  const { receiveOrder, isLoading } = useOperationsStore()
  const { processBarcode, isProcessing } = useScannerStore()
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>(
    (order.lines || []).map((l) => ({ ...l, receivedQuantity: 0, lotNumber: '', expirationDate: '' })),
  )
  const [activeLotIndex, setActiveLotIndex] = useState<number | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [lastScannedIdx, setLastScannedIdx] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1200)
  }, [])

  const handleScan = useCallback(async (barcode: string) => {
    const product = await processBarcode(barcode)
    if (!product) {
      playErrorBeep()
      vibrateError()
      showToast('error', 'Producto no encontrado')
      return
    }

    const idx = receiveLines.findIndex(
      (l) => l.productId === product.productId && (!l.variantId || l.variantId === product.variantId),
    )

    if (idx >= 0) {
      const line = receiveLines[idx]
      const expected = line.expectedQuantity || line.quantity
      if (line.receivedQuantity < expected) {
        const updated = [...receiveLines]
        updated[idx] = { ...updated[idx], receivedQuantity: updated[idx].receivedQuantity + 1 }
        setReceiveLines(updated)
        setActiveLotIndex(idx)
        setLastScannedIdx(idx)
        playSuccessBeep()
        vibrateSuccess()
        showToast('success', `${product.name} (${updated[idx].receivedQuantity}/${expected})`)
      } else {
        playErrorBeep()
        vibrateError()
        showToast('error', `${product.name} — Cantidad completa`)
      }
    } else {
      playErrorBeep()
      vibrateError()
      showToast('error', 'No está en esta orden')
    }
  }, [receiveLines, showToast])

  useDataWedge(handleScan)

  const handleLotConfirm = (lotNumber: string, expirationDate: string) => {
    if (activeLotIndex !== null) {
      const updated = [...receiveLines]
      updated[activeLotIndex] = { ...updated[activeLotIndex], lotNumber, expirationDate }
      setReceiveLines(updated)
      setActiveLotIndex(null)
    }
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

    setConfirming(true)
    try {
      await receiveOrder(order.type, order.id, linesToSend)
      showToast('success', '¡Recepción completada!')
      setTimeout(() => navigation.goBack(), 600)
    } catch (err: any) {
      showToast('error', err.message || 'Error al confirmar')
    }
    setConfirming(false)
  }

  const totalExpected = receiveLines.reduce((s, l) => s + (l.expectedQuantity || l.quantity), 0)
  const totalReceived = receiveLines.reduce((s, l) => s + l.receivedQuantity, 0)
  const pct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0
  const allComplete = totalReceived >= totalExpected && totalExpected > 0

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>Recibir Orden</Text>
        {isProcessing && <ActivityIndicator size="small" color="#eb5b0c" />}
      </View>

      {/* Confirming overlay */}
      {confirming && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: isDark ? '#2d2a28' : '#fff', borderRadius: 24, padding: 32, alignItems: 'center',
          }}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>Procesando...</Text>
          </View>
        </View>
      )}

      {/* Order info + progress */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff',
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
          borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
        }}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>📥</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#3b82f6' }}>{order.orderNumber}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{order.supplierName}</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: isDark ? '#2d2a28' : '#fff',
          borderRadius: 16, padding: 14, marginBottom: 8,
          borderWidth: 1, borderColor: allComplete ? '#10b981' : isDark ? '#3f3b39' : '#f0efee',
        }}>
          <View style={{
            width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
            backgroundColor: allComplete ? 'rgba(16,185,129,0.15)' : isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)',
          }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: allComplete ? '#10b981' : '#3b82f6' }}>{pct}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                {totalReceived} de {totalExpected} unidades
              </Text>
              {allComplete && <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>✓ COMPLETO</Text>}
            </View>
            <View style={{ height: 6, backgroundColor: isDark ? '#3f3b39' : '#e7e5e4', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{
                height: '100%', borderRadius: 3,
                backgroundColor: allComplete ? '#10b981' : '#3b82f6',
                width: `${Math.min(pct, 100)}%`,
              }} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {activeLotIndex !== null && (
          <LotExpirationForm
            onConfirm={handleLotConfirm}
            onSkip={() => setActiveLotIndex(null)}
          />
        )}

        {receiveLines.map((line, idx) => {
          const expected = line.expectedQuantity || line.quantity
          const isComplete = line.receivedQuantity >= expected
          const isLastScanned = idx === lastScannedIdx

          return (
            <View
              key={`${line.productId}-${line.variantId}-${idx}`}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: isComplete
                  ? isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4'
                  : isDark ? '#2d2a28' : '#fff',
                borderRadius: 14, padding: 10, marginBottom: 6,
                borderWidth: isLastScanned ? 1.5 : 1,
                borderColor: isLastScanned ? '#3b82f6'
                  : isComplete ? isDark ? 'rgba(16,185,129,0.2)' : '#dcfce7'
                  : isDark ? '#3f3b39' : '#f0efee',
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: isLastScanned
                  ? isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'
                  : isDark ? '#3f3b39' : '#f5f5f4',
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
              }}>
                {isComplete ? (
                  <Text style={{ fontSize: 18 }}>✅</Text>
                ) : (
                  <Text style={{ fontSize: 18 }}>📦</Text>
                )}
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text numberOfLines={1} style={{
                  fontSize: 13, fontWeight: '700',
                  color: isLastScanned ? '#3b82f6' : colors.text,
                }}>
                  {line.name}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginTop: 1 }}>{line.sku}</Text>
                {line.lotNumber ? (
                  <Text style={{ fontSize: 9, color: '#2563eb', fontWeight: '600', marginTop: 2 }}>
                    Lote: {line.lotNumber} {line.expirationDate ? `| ${line.expirationDate}` : ''}
                  </Text>
                ) : null}
              </View>
              <View style={{
                backgroundColor: isComplete ? '#10b981' : isDark ? '#3f3b39' : '#e7e5e4',
                borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 50, alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: 14, fontWeight: '900',
                  color: isComplete ? '#fff' : colors.text,
                }}>
                  {line.receivedQuantity}/{expected}
                </Text>
              </View>
            </View>
          )
        })}

        {receiveLines.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>📥</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>
              Sin líneas — escanea productos para agregar
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom confirm button */}
      {totalReceived > 0 && (
        <Animated.View entering={FadeIn.duration(150)} style={{
          padding: 16, paddingBottom: 20, backgroundColor: isDark ? '#0c0a09' : '#fff',
          borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
        }}>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8} style={{
            backgroundColor: allComplete ? '#10b981' : '#3b82f6',
            borderRadius: 18, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            shadowColor: allComplete ? '#10b981' : '#3b82f6',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {allComplete ? 'Completar Recepción' : `Confirmar Parcial (${totalReceived}/${totalExpected})`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Inline toast */}
      {toast && <ScanToast message={toast.message} type={toast.type} />}
    </View>
  )
}
