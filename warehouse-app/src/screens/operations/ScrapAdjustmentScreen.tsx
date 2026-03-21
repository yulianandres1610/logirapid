import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Picker } from '@react-native-picker/picker'
import { Button } from '@/src/components/ui/Button'
import { ProductLineItem } from '@/src/components/ProductLineItem'
import { OperationSummary } from '@/src/components/OperationSummary'
import { ManualBarcodeInput } from '@/src/components/ManualBarcodeInput'
import { ScanFeedbackOverlay } from '@/src/components/ScanFeedbackOverlay'
import { VariantSelector } from '@/src/components/VariantSelector'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore } from '@/src/stores/operations-store'
import { useScannerStore, type ScannedProduct } from '@/src/stores/scanner-store'
import { useThemeStore } from '@/src/stores/theme-store'

type OperationType = 'scrap' | 'adjustment'

const SCRAP_REASONS = ['Dañado', 'Vencido', 'Merma', 'Otro']

export function ScrapAdjustmentScreen() {
  const { colors, isDark } = useThemeStore()
  const navigation = useNavigation()
  const { currentLines, isLoading, addLine, updateLineQty, removeLine, confirmScrap, confirmAdjustment, reset } = useOperationsStore()
  const { processBarcode } = useScannerStore()
  const [opType, setOpType] = useState<OperationType>('scrap')
  const [reason, setReason] = useState('Dañado')
  const [notes, setNotes] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message?: string } | null>(null)
  const [pendingProduct, setPendingProduct] = useState<ScannedProduct | null>(null)

  const handleScan = useCallback(async (barcode: string) => {
    const product = await processBarcode(barcode)
    if (product) {
      if (product.variants && product.variants.length > 1) {
        setPendingProduct(product)
      } else {
        const qty = product.detectedWeight || 1
        addLine(product, qty)
        const info = product.detectedWeight ? ` (${product.detectedWeight} ${product.unit || 'kg'})` : ''
        setFeedback({ type: 'success', message: product.name + info })
      }
    } else {
      setFeedback({ type: 'error', message: 'Producto no encontrado' })
    }
    setTimeout(() => setFeedback(null), 1000)
  }, [])

  useDataWedge(handleScan)

  const handleVariantSelect = (variantId: number, variantName: string) => {
    if (pendingProduct) {
      const variant = pendingProduct.variants?.find((v) => v.id === variantId)
      addLine(
        { ...pendingProduct, variantId, name: `${pendingProduct.name} - ${variantName}`, sku: variant?.sku || pendingProduct.sku },
        1,
      )
      setPendingProduct(null)
    }
  }

  const handleConfirm = async () => {
    const label = opType === 'scrap' ? 'Scrap' : 'Ajuste'
    Alert.alert(
      `Confirmar ${label}`,
      `¿Registrar ${label.toLowerCase()} de ${currentLines.length} productos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              if (opType === 'scrap') {
                await confirmScrap(reason, notes)
              } else {
                await confirmAdjustment(reason || notes)
              }
              Alert.alert('Éxito', `${label} registrado correctamente`)
              navigation.goBack()
            } catch (err: any) {
              Alert.alert('Error', err.message)
            }
          },
        },
      ],
    )
  }

  React.useEffect(() => {
    return () => reset()
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
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>Scrap / Ajuste</Text>
      </View>

      <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
        {/* Type Selector */}
        <View className="flex-row gap-2 mb-4">
          {(['scrap', 'adjustment'] as const).map((t) => (
            <Button
              key={t}
              variant={opType === t ? 'default' : 'outline'}
              size="sm"
              onPress={() => setOpType(t)}
              className="flex-1"
            >
              {t === 'scrap' ? '♻️ Scrap' : '📊 Ajuste'}
            </Button>
          ))}
        </View>

        {/* Reason */}
        {opType === 'scrap' && (
          <View
            className="bg-white rounded-2xl p-5 mb-4 border border-dark-100"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
          >
            <Text className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-3">Motivo</Text>
            <View className="border border-dark-200 rounded-2xl overflow-hidden bg-dark-50">
              <Picker selectedValue={reason} onValueChange={setReason}>
                {SCRAP_REASONS.map((r) => (
                  <Picker.Item key={r} label={r} value={r} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Notes */}
        <View
          className="bg-white rounded-2xl p-5 mb-4 border border-dark-100"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
        >
          <Text className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-3">
            {opType === 'scrap' ? 'Notas (opcional)' : 'Razón del ajuste'}
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={opType === 'scrap' ? 'Observaciones...' : 'Ej: Conteo físico revela diferencia...'}
            placeholderTextColor="#a8a29e"
            multiline
            numberOfLines={2}
            className="bg-dark-50 border border-dark-200 rounded-2xl px-4 py-3 text-sm text-dark-800"
          />
        </View>

        <ManualBarcodeInput onSubmit={handleScan} />

        {currentLines.length > 0 && (
          <>
            <OperationSummary lines={currentLines} title="Resumen" />
            {currentLines.map((line, idx) => (
              <ProductLineItem
                key={`${line.productId}-${line.variantId}-${idx}`}
                line={line}
                index={idx}
                onQuantityChange={updateLineQty}
                onRemove={removeLine}
              />
            ))}
          </>
        )}

        {currentLines.length === 0 && (
          <View className="items-center py-20">
            <View className="w-20 h-20 bg-brand-50 rounded-3xl items-center justify-center mb-4">
              <Text className="text-4xl">{opType === 'scrap' ? '♻️' : '📊'}</Text>
            </View>
            <Text className="text-lg font-bold text-dark-700">
              Escanea productos
            </Text>
            <Text className="text-sm text-dark-400 text-center mt-2 px-8 leading-5">
              Escanea productos para {opType === 'scrap' ? 'dar de baja' : 'ajustar inventario'}
            </Text>
          </View>
        )}
      </ScrollView>

      {currentLines.length > 0 && (
        <View style={{ padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          <Button
            onPress={handleConfirm}
            loading={isLoading}
            variant={opType === 'scrap' ? 'danger' : 'default'}
            size="lg"
          >
            {opType === 'scrap' ? 'Confirmar Scrap' : 'Confirmar Ajuste'}
          </Button>
        </View>
      )}

      <ScanFeedbackOverlay type={feedback?.type || null} message={feedback?.message} />

      {pendingProduct && (
        <VariantSelector
          visible={!!pendingProduct}
          product={pendingProduct}
          onSelect={handleVariantSelect}
          onClose={() => setPendingProduct(null)}
        />
      )}
    </View>
  )
}
