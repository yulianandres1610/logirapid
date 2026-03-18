import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { Button } from '@/src/components/ui/Button'
import { Card } from '@/src/components/ui/Card'
import { Badge } from '@/src/components/ui/Badge'
import { ManualBarcodeInput } from '@/src/components/ManualBarcodeInput'
import { OperationSummary } from '@/src/components/OperationSummary'
import { ScanFeedbackOverlay } from '@/src/components/ScanFeedbackOverlay'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore, type WholesaleDelivery } from '@/src/stores/operations-store'
import { useScannerStore } from '@/src/stores/scanner-store'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'
import { useThemeStore } from '@/src/stores/theme-store'

export function WholesaleDetailScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation()
  const route = useRoute<RouteProp<{ params: { delivery: WholesaleDelivery } }, 'params'>>()
  const delivery = route.params.delivery
  const { validateWholesale, completeWholesale, isLoading } = useOperationsStore()
  const { processBarcode } = useScannerStore()
  const [validatedLines, setValidatedLines] = useState<Map<number, number>>(new Map())
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message?: string } | null>(null)

  const handleScan = useCallback(async (barcode: string) => {
    const product = await processBarcode(barcode)
    if (!product) {
      setFeedback({ type: 'error', message: 'Producto no encontrado' })
      setTimeout(() => setFeedback(null), 1000)
      return
    }

    const matchingLine = delivery.lines.find(
      (l) => l.productId === product.productId && (!l.variantId || l.variantId === product.variantId),
    )

    if (matchingLine && matchingLine.lineId) {
      const current = validatedLines.get(matchingLine.lineId) || 0
      const expected = matchingLine.expectedQuantity || matchingLine.quantity
      if (current < expected) {
        const updated = new Map(validatedLines)
        updated.set(matchingLine.lineId, current + 1)
        setValidatedLines(updated)
        playSuccessBeep()
        vibrateSuccess()
        setFeedback({ type: 'success', message: `${product.name} (${current + 1}/${expected})` })
      } else {
        playErrorBeep()
        vibrateError()
        setFeedback({ type: 'error', message: 'Cantidad completa' })
      }
    } else {
      playErrorBeep()
      vibrateError()
      setFeedback({ type: 'error', message: 'No está en este despacho' })
    }
    setTimeout(() => setFeedback(null), 1000)
  }, [delivery, validatedLines])

  useDataWedge(handleScan)

  const handleValidate = async () => {
    const lines = Array.from(validatedLines.entries()).map(([lineId, qty]) => ({
      lineId,
      quantityValidated: qty,
    }))
    try {
      await validateWholesale(delivery.id, lines)
      Alert.alert('Éxito', 'Despacho validado')
    } catch (err: any) {
      Alert.alert('Error', err.message)
    }
  }

  const handleComplete = async () => {
    Alert.alert(
      'Completar Despacho',
      '¿Completar y cerrar este despacho?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: async () => {
            try {
              await completeWholesale(delivery.id)
              Alert.alert('Éxito', 'Despacho completado')
              navigation.goBack()
            } catch (err: any) {
              Alert.alert('Error', err.message)
            }
          },
        },
      ],
    )
  }

  const totalExpected = delivery.lines.reduce((s, l) => s + (l.expectedQuantity || l.quantity), 0)
  const totalValidated = Array.from(validatedLines.values()).reduce((s, v) => s + v, 0)
  const allComplete = totalValidated >= totalExpected

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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>Despacho</Text>
      </View>

      <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
        <View
          className="bg-white rounded-2xl p-4 mb-4 border border-dark-100"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
        >
          <Text className="text-base font-bold text-dark-800">{delivery.invoiceNumber}</Text>
          <Text className="text-sm text-dark-400">{delivery.customerName}</Text>
        </View>

        <ManualBarcodeInput onSubmit={handleScan} />

        <OperationSummary
          lines={delivery.lines.map((l) => ({
            ...l,
            validatedQuantity: validatedLines.get(l.lineId!) || 0,
            expectedQuantity: l.expectedQuantity || l.quantity,
          }))}
          title="Progreso"
          showProgress
        />

        {delivery.lines.map((line) => {
          const validated = validatedLines.get(line.lineId!) || 0
          const expected = line.expectedQuantity || line.quantity
          const isComplete = validated >= expected

          return (
            <View
              key={line.lineId}
              className={`bg-white rounded-2xl p-4 mb-2 border ${isComplete ? 'border-emerald-200 bg-emerald-50' : 'border-dark-100'}`}
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
            >
              <Text className="text-sm font-bold text-dark-800" numberOfLines={1}>
                {line.name}
              </Text>
              <Text className="text-xs text-dark-400 mt-0.5 font-medium">{line.sku}</Text>
              <View className="flex-row items-center mt-2 justify-between">
                <Text className={`text-sm font-bold ${isComplete ? 'text-emerald-600' : 'text-brand-500'}`}>
                  {validated} / {expected}
                </Text>
                {isComplete && <Badge variant="success">Completo</Badge>}
              </View>
            </View>
          )
        })}
      </ScrollView>

      <View style={{ padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder }} className="gap-2">
        {!allComplete && (
          <Button
            onPress={handleValidate}
            loading={isLoading}
            disabled={totalValidated === 0}
            variant="secondary"
            size="lg"
          >
            {`Validar Parcial (${totalValidated}/${totalExpected})`}
          </Button>
        )}
        {allComplete && (
          <Button onPress={handleComplete} loading={isLoading} size="lg">
            Completar Despacho
          </Button>
        )}
      </View>

      <ScanFeedbackOverlay type={feedback?.type || null} message={feedback?.message} />
    </View>
  )
}
