import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
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
import { ProductLineItem } from '@/src/components/ProductLineItem'
import { VariantSelector } from '@/src/components/VariantSelector'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useOperationsStore } from '@/src/stores/operations-store'
import { useScannerStore, type ScannedProduct } from '@/src/stores/scanner-store'
import { useWarehouseStore } from '@/src/stores/warehouse-store'
import { useAuthStore } from '@/src/stores/auth-store'
import { useThemeStore } from '@/src/stores/theme-store'

// ─── Step Indicator ──────────────────────────────────────────────────
function StepIndicator({ currentStep, isDark }: { currentStep: number; isDark: boolean }) {
  const steps = [
    { num: 1, label: 'Destino' },
    { num: 2, label: 'Escaneo' },
    { num: 3, label: 'Verificar' },
    { num: 4, label: 'Listo' },
  ]

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 24 }}>
      {steps.map((step, i) => {
        const isActive = currentStep === step.num
        const isCompleted = currentStep > step.num

        return (
          <React.Fragment key={step.num}>
            {i > 0 && (
              <View style={{
                flex: 1, height: 2, marginHorizontal: 4,
                backgroundColor: isCompleted || isActive ? '#eb5b0c' : isDark ? '#3f3b39' : '#e7e5e4',
                borderRadius: 1,
              }} />
            )}
            <View style={{ alignItems: 'center' }}>
              <View style={{
                width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isActive ? '#eb5b0c' : isCompleted ? '#10b981' : isDark ? '#3f3b39' : '#e7e5e4',
                shadowColor: isActive ? '#eb5b0c' : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isActive ? 0.4 : 0,
                shadowRadius: 4,
                elevation: isActive ? 3 : 0,
              }}>
                {isCompleted ? (
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>
                ) : (
                  <Text style={{
                    color: isActive ? '#fff' : isDark ? '#a8a29e' : '#78716c',
                    fontSize: 12, fontWeight: '800',
                  }}>{step.num}</Text>
                )}
              </View>
              <Text style={{
                fontSize: 8, fontWeight: '700', marginTop: 3, letterSpacing: 0.3,
                color: isActive ? '#eb5b0c' : isCompleted ? '#10b981' : isDark ? '#78716c' : '#a8a29e',
              }}>{step.label}</Text>
            </View>
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ─── Custom Header ───────────────────────────────────────────────────
function WizardHeader({ onBack, isDark, colors }: { onBack: () => void; isDark: boolean; colors: any }) {
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
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Nueva Transferencia</Text>
    </View>
  )
}

// ─── Inline Scan Toast ──────────────────────────────────────────────
function ScanToast({ message, type, isDark }: { message: string; type: 'success' | 'error'; isDark: boolean }) {
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

// ─── Step 1: Destination ─────────────────────────────────────────────
function StepDestination({
  warehouses,
  selectedId,
  onSelect,
  onNext,
  isDark,
  colors,
}: {
  warehouses: Array<{ id: number; name: string }>
  selectedId: number | null
  onSelect: (id: number | null) => void
  onNext: () => void
  isDark: boolean
  colors: any
}) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 20, marginTop: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
            ¿A dónde envías?
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
            Selecciona el almacén de destino
          </Text>
        </View>

        {warehouses.map((w, i) => {
          const isSelected = selectedId === w.id
          return (
            <Animated.View key={w.id} entering={FadeIn.delay(i * 60).duration(250)}>
              <TouchableOpacity
                onPress={() => onSelect(isSelected ? null : w.id)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 16, marginBottom: 10, borderRadius: 16,
                  borderWidth: 2,
                  borderColor: isSelected ? '#eb5b0c' : isDark ? '#3f3b39' : '#e7e5e4',
                  backgroundColor: isSelected
                    ? isDark ? 'rgba(235,91,12,0.1)' : '#fff4eb'
                    : isDark ? '#2d2a28' : '#fff',
                }}
              >
                <View style={{
                  width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? '#eb5b0c' : isDark ? '#3f3b39' : '#f5f5f4',
                }}>
                  <Text style={{ fontSize: 22 }}>📦</Text>
                </View>
                <Text style={{
                  flex: 1, fontSize: 15, fontWeight: '700', marginLeft: 14,
                  color: isSelected ? '#eb5b0c' : colors.text,
                }}>{w.name}</Text>
                <View style={{
                  width: 26, height: 26, borderRadius: 9,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isSelected ? '#eb5b0c' : isDark ? '#3f3b39' : '#e7e5e4',
                  borderWidth: isSelected ? 0 : 2,
                  borderColor: isDark ? '#57534e' : '#d6d3d1',
                }}>
                  {isSelected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                </View>
              </TouchableOpacity>
            </Animated.View>
          )
        })}

        {warehouses.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>No hay almacenes disponibles</Text>
          </View>
        )}
      </ScrollView>

      <View style={{
        padding: 20, paddingBottom: 24, backgroundColor: colors.bg,
        borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
      }}>
        <TouchableOpacity
          onPress={onNext} disabled={!selectedId} activeOpacity={0.8}
          style={{
            backgroundColor: selectedId ? '#eb5b0c' : isDark ? '#3f3b39' : '#d6d3d1',
            borderRadius: 18, paddingVertical: 16, alignItems: 'center',
            shadowColor: selectedId ? '#eb5b0c' : 'transparent',
            shadowOffset: { width: 0, height: 6 }, shadowOpacity: selectedId ? 0.3 : 0,
            shadowRadius: 12, elevation: selectedId ? 6 : 0,
          }}
        >
          <Text style={{
            color: selectedId ? '#fff' : isDark ? '#78716c' : '#a8a29e',
            fontSize: 16, fontWeight: '800',
          }}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </View>
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

// ─── Scanning Animation ──────────────────────────────────────────────
function ScannerAnimation({ isDark }: { isDark: boolean }) {
  const pulse1 = useSharedValue(0.6)
  const pulse2 = useSharedValue(0.4)
  const scanLine = useSharedValue(0)

  useEffect(() => {
    pulse1.value = withRepeat(withSequence(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      withTiming(0.6, { duration: 1500, easing: Easing.in(Easing.ease) }),
    ), -1, false)
    pulse2.value = withRepeat(withDelay(500, withSequence(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      withTiming(0.4, { duration: 1500, easing: Easing.in(Easing.ease) }),
    )), -1, false)
    scanLine.value = withRepeat(withSequence(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
    ), -1, false)
  }, [])

  const ring1Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse1.value }], opacity: 1 - pulse1.value * 0.5 }))
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ scale: pulse2.value }], opacity: 1 - pulse2.value * 0.6 }))
  const lineStyle = useAnimatedStyle(() => ({ top: `${scanLine.value * 100}%` as any }))

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <Animated.View style={[ring1Style, { position: 'absolute', width: 180, height: 180, borderRadius: 60, borderWidth: 2, borderColor: isDark ? 'rgba(235,91,12,0.3)' : 'rgba(235,91,12,0.2)' }]} />
      <Animated.View style={[ring2Style, { position: 'absolute', width: 140, height: 140, borderRadius: 46, borderWidth: 2, borderColor: isDark ? 'rgba(235,91,12,0.4)' : 'rgba(235,91,12,0.3)' }]} />
      <View style={{ width: 100, height: 100, borderRadius: 24, backgroundColor: isDark ? 'rgba(235,91,12,0.12)' : 'rgba(235,91,12,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View style={[lineStyle, { position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: '#eb5b0c', borderRadius: 1 }]} />
        <View style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#eb5b0c', borderTopLeftRadius: 6 }} />
        <View style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#eb5b0c', borderTopRightRadius: 6 }} />
        <View style={{ position: 'absolute', bottom: 8, left: 8, width: 18, height: 18, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#eb5b0c', borderBottomLeftRadius: 6 }} />
        <View style={{ position: 'absolute', bottom: 8, right: 8, width: 18, height: 18, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#eb5b0c', borderBottomRightRadius: 6 }} />
        <BarcodeIcon size={40} color="#eb5b0c" />
      </View>
    </View>
  )
}

// ─── Step 2: Scan Products ───────────────────────────────────────────
function StepProducts({
  destinationName, currentLines, lastScannedKey,
  onUpdateQty, onRemove, onNext, isProcessing, isDark, colors,
}: {
  destinationName: string; currentLines: any[]; lastScannedKey: string | null
  onUpdateQty: (index: number, qty: number) => void
  onRemove: (index: number) => void; onNext: () => void
  isProcessing: boolean; isDark: boolean; colors: any
}) {
  const totalProducts = currentLines.length
  const scrollRef = useRef<ScrollView>(null)

  const displayLines = React.useMemo(() => {
    return currentLines.map((line: any, idx: number) => ({ line, originalIndex: idx })).reverse()
  }, [currentLines])

  React.useEffect(() => {
    if (totalProducts > 0) scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [totalProducts, lastScannedKey])

  return (
    <View style={{ flex: 1 }}>
      {/* Destination chip + scan status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center',
          backgroundColor: isDark ? 'rgba(235,91,12,0.1)' : '#fff4eb',
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
        }}>
          <Text style={{ fontSize: 13, marginRight: 6 }}>📦</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#eb5b0c' }} numberOfLines={1}>→ {destinationName}</Text>
        </View>
        {isProcessing && <ActivityIndicator size="small" color="#eb5b0c" />}
        {totalProducts > 0 && (
          <View style={{ backgroundColor: '#eb5b0c', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{totalProducts}</Text>
          </View>
        )}
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {currentLines.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 24 }}>
            <ScannerAnimation isDark={isDark} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 12 }}>
              {isProcessing ? 'Procesando...' : 'Listo para escanear'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20, paddingHorizontal: 24 }}>
              Apunta el escáner al código de barras del producto
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 28, backgroundColor: isDark ? '#2d2a28' : '#f5f5f4', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontSize: 16, marginRight: 10 }}>💡</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18 }}>
                Presiona el botón lateral para escanear
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginBottom: 10,
              backgroundColor: isDark ? 'rgba(235,91,12,0.08)' : '#fff9f5',
              borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1, borderColor: isDark ? 'rgba(235,91,12,0.15)' : '#ffe4cc',
            }}>
              <BarcodeIcon size={18} color="#eb5b0c" />
              <Text style={{ fontSize: 11, color: '#eb5b0c', fontWeight: '600', flex: 1, marginLeft: 8 }}>
                Escanea más productos o revisa la transferencia
              </Text>
            </View>

            {displayLines.map(({ line, originalIndex }) => {
              const key = `${line.productId}-${line.variantId || 0}`
              return (
                <ProductLineItem
                  key={`${line.productId}-${line.variantId}-${originalIndex}`}
                  line={line} index={originalIndex}
                  onQuantityChange={onUpdateQty} onRemove={onRemove}
                  isLastScanned={key === lastScannedKey}
                />
              )
            })}
          </>
        )}
      </ScrollView>

      {/* Review button */}
      {currentLines.length > 0 && (
        <Animated.View entering={FadeIn.duration(150)} style={{
          padding: 16, paddingBottom: 20, backgroundColor: isDark ? '#0c0a09' : '#fff',
          borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
        }}>
          <TouchableOpacity onPress={onNext} activeOpacity={0.8} style={{
            backgroundColor: '#eb5b0c', borderRadius: 18, paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Revisar Transferencia</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              ({totalProducts})
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  )
}

// ─── Step 3: Verification ────────────────────────────────────────────
function StepVerification({
  destinationName, currentLines, onBack, onConfirm, isDark, colors,
}: {
  destinationName: string; currentLines: any[]
  onBack: () => void; onConfirm: () => void
  isDark: boolean; colors: any
}) {
  const totalProducts = currentLines.length
  const totalUnits = currentLines.reduce((sum: number, l: any) => sum + l.quantity, 0)

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Verifica tu transferencia</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
            Revisa que todo esté correcto antes de confirmar
          </Text>
        </View>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={{
            flex: 1, backgroundColor: isDark ? 'rgba(235,91,12,0.1)' : '#fff4eb',
            borderRadius: 16, padding: 14, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#eb5b0c' }}>{totalProducts}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#a8a29e' : '#78716c', marginTop: 2 }}>Productos</Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: isDark ? '#2d2a28' : '#f5f5f4',
            borderRadius: 16, padding: 14, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{totalUnits}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#a8a29e' : '#78716c', marginTop: 2 }}>Unidades</Text>
          </View>
        </View>

        {/* Destination */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', marginBottom: 16,
          backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
          borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
          borderWidth: 1, borderColor: isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5',
        }}>
          <Text style={{ fontSize: 18, marginRight: 10 }}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>Destino</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 1 }}>{destinationName}</Text>
          </View>
        </View>

        {/* Product list header */}
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Productos a transferir
        </Text>

        {/* Read-only product list */}
        {currentLines.map((line: any, idx: number) => (
          <View key={`${line.productId}-${line.variantId}-${idx}`} style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: isDark ? '#2d2a28' : '#fff',
            borderRadius: 14, padding: 10, marginBottom: 6,
            borderWidth: 1, borderColor: isDark ? '#3f3b39' : '#f0efee',
          }}>
            {/* Image */}
            <View style={{
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10,
            }}>
              {line.imageUrl ? (
                <Image source={{ uri: line.imageUrl }} style={{ width: 40, height: 40, borderRadius: 10 }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 18 }}>📦</Text>
              )}
            </View>
            {/* Info */}
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{line.name}</Text>
              <Text style={{ fontSize: 10, color: isDark ? '#78716c' : '#a8a29e', fontWeight: '500', marginTop: 1 }}>{line.sku}</Text>
            </View>
            {/* Qty badge */}
            <View style={{
              backgroundColor: '#eb5b0c', borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 6, minWidth: 40, alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{line.quantity}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={{
        padding: 16, paddingBottom: 20, backgroundColor: isDark ? '#0c0a09' : '#fff',
        borderTopWidth: 1, borderTopColor: isDark ? '#2d2a28' : '#e7e5e4',
        flexDirection: 'row', gap: 10,
      }}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={{
          flex: 1, borderRadius: 18, paddingVertical: 16, alignItems: 'center',
          backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
        }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm} activeOpacity={0.8} style={{
          flex: 2, backgroundColor: '#10b981', borderRadius: 18, paddingVertical: 16,
          alignItems: 'center',
          shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
        }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Step 4: Success ─────────────────────────────────────────────────
function StepSuccess({
  destinationName, totalProducts, totalUnits, onDone, isDark, colors,
}: {
  destinationName: string; totalProducts: number; totalUnits: number
  onDone: () => void; isDark: boolean; colors: any
}) {
  const checkScale = useSharedValue(0)
  const ringScale = useSharedValue(0)
  const ringOpacity = useSharedValue(1)
  const contentOpacity = useSharedValue(0)

  useEffect(() => {
    ringScale.value = withSpring(1.8, { damping: 8, stiffness: 100 })
    ringOpacity.value = withDelay(400, withTiming(0, { duration: 600 }))
    checkScale.value = withDelay(100, withSpring(1, { damping: 8, stiffness: 120 }))
    contentOpacity.value = withDelay(500, withTiming(1, { duration: 400 }))
  }, [])

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }))
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }], opacity: ringOpacity.value }))
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }))

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
        <Animated.View style={[ringStyle, { position: 'absolute', width: 120, height: 120, borderRadius: 40, borderWidth: 3, borderColor: '#10b981' }]} />
        <Animated.View style={[checkStyle, {
          width: 100, height: 100, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
        }]}>
          <Text style={{ fontSize: 44, color: '#fff' }}>✓</Text>
        </Animated.View>
      </View>

      <Animated.View style={[contentStyle, { alignItems: 'center', width: '100%' }]}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center' }}>
          ¡Transferencia Creada!
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          Los productos están en camino al almacén de destino
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 28, marginBottom: 32 }}>
          <View style={{ flex: 1, backgroundColor: isDark ? '#2d2a28' : '#f5f5f4', borderRadius: 18, padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, marginBottom: 4 }}>📦</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#eb5b0c' }}>{totalProducts}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>Productos</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: isDark ? '#2d2a28' : '#f5f5f4', borderRadius: 18, padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, marginBottom: 4 }}>📊</Text>
            <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text }}>{totalUnits}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>Unidades</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: isDark ? '#2d2a28' : '#f5f5f4', borderRadius: 18, padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, marginBottom: 4 }}>🏭</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#10b981', textAlign: 'center' }} numberOfLines={2}>{destinationName}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, marginTop: 2 }}>Destino</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onDone} activeOpacity={0.8} style={{
          backgroundColor: '#10b981', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center',
          shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
        }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Volver al Menú</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────
export function TransferCreateScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useThemeStore()
  const currentWarehouseId = useAuthStore((s) => s.warehouseId)
  const { warehouses, fetchWarehouses } = useWarehouseStore()
  const {
    currentLines, destinationWarehouseId, isLoading, error,
    setDestinationWarehouse, addLine, updateLineQty, removeLine,
    confirmTransfer, reset,
  } = useOperationsStore()
  const { processBarcode, isProcessing } = useScannerStore()
  const [step, setStep] = useState(1)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pendingProduct, setPendingProduct] = useState<ScannedProduct | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [successData, setSuccessData] = useState<{ products: number; units: number; destination: string } | null>(null)
  const [lastScannedKey, setLastScannedKey] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchWarehouses()
    return () => reset()
  }, [])

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 1200)
  }, [])

  const handleBack = useCallback(() => {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
    else navigation.navigate('OperationsMenu')
  }, [step, navigation])

  const handleScan = useCallback(async (barcode: string) => {
    if (step !== 2) return
    const product = await processBarcode(barcode)
    if (product) {
      if (product.variants && product.variants.length > 1) {
        setPendingProduct(product)
      } else {
        // Use detected weight as quantity for weight products, otherwise 1
        const qty = product.detectedWeight || 1
        addLine(product, qty)
        setLastScannedKey(`${product.productId}-${product.variantId || 0}`)
        const weightInfo = product.detectedWeight ? ` (${product.detectedWeight} ${product.unit || 'kg'})` : ''
        showToast('success', product.name + weightInfo)
      }
    } else {
      showToast('error', 'Producto no encontrado')
    }
  }, [step, showToast])

  useDataWedge(handleScan)

  const handleVariantSelect = (variantId: number, variantName: string) => {
    if (pendingProduct) {
      const variant = pendingProduct.variants?.find((v) => v.id === variantId)
      addLine(
        { ...pendingProduct, variantId, name: `${pendingProduct.name} - ${variantName}`, sku: variant?.sku || pendingProduct.sku },
        1,
      )
      setLastScannedKey(`${pendingProduct.productId}-${variantId}`)
      setPendingProduct(null)
      showToast('success', variantName)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const totalProducts = currentLines.length
      const totalUnits = currentLines.reduce((sum, l) => sum + l.quantity, 0)
      const destName = availableWarehouses.find((w) => w.id === destinationWarehouseId)?.name || ''
      await confirmTransfer()
      setSuccessData({ products: totalProducts, units: totalUnits, destination: destName })
      setStep(4)
    } catch (err: any) {
      showToast('error', err.message || 'Error al confirmar')
    }
    setConfirming(false)
  }

  const availableWarehouses = warehouses.filter((w) => w.id !== currentWarehouseId)
  const destinationName = availableWarehouses.find((w) => w.id === destinationWarehouseId)?.name || ''

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {step !== 4 && <WizardHeader onBack={handleBack} isDark={isDark} colors={colors} />}

      <StepIndicator currentStep={step} isDark={isDark} />

      {/* Loading overlay */}
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
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 }}>Procesando...</Text>
          </View>
        </View>
      )}

      {/* Steps */}
      {step === 1 && (
        <StepDestination
          warehouses={availableWarehouses} selectedId={destinationWarehouseId}
          onSelect={setDestinationWarehouse} onNext={() => setStep(2)}
          isDark={isDark} colors={colors}
        />
      )}

      {step === 2 && (
        <StepProducts
          destinationName={destinationName} currentLines={currentLines}
          lastScannedKey={lastScannedKey} onUpdateQty={updateLineQty}
          onRemove={removeLine} onNext={() => setStep(3)}
          isProcessing={isProcessing} isDark={isDark} colors={colors}
        />
      )}

      {step === 3 && (
        <StepVerification
          destinationName={destinationName} currentLines={currentLines}
          onBack={() => setStep(2)} onConfirm={handleConfirm}
          isDark={isDark} colors={colors}
        />
      )}

      {step === 4 && successData && (
        <StepSuccess
          destinationName={successData.destination}
          totalProducts={successData.products} totalUnits={successData.units}
          onDone={() => navigation.navigate('OperationsMenu')} isDark={isDark} colors={colors}
        />
      )}

      {/* Inline toast instead of full-screen overlay */}
      {toast && <ScanToast message={toast.message} type={toast.type} isDark={isDark} />}

      {pendingProduct && (
        <VariantSelector
          visible={!!pendingProduct} product={pendingProduct}
          onSelect={handleVariantSelect} onClose={() => setPendingProduct(null)}
        />
      )}
    </View>
  )
}
