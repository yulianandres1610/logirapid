import React, { useState, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, ScrollView, Keyboard } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated'
import { useDataWedge } from '@/src/hooks/useDataWedge'
import { useScannerStore, type ScannedProduct } from '@/src/stores/scanner-store'
import { useAuthStore } from '@/src/stores/auth-store'
import { useThemeStore } from '@/src/stores/theme-store'
import { api } from '@/src/services/api'
import { playSuccessBeep, playErrorBeep, vibrateSuccess, vibrateError } from '@/src/services/feedback'

interface SearchResult {
  id: number
  name: string
  sku: string
  barcode: string
  sellingPrice: number
  currency: string
  categoryName?: string
}

// ─── Label Preview (simulates 2x1 inch Zebra label) ─────────────
function LabelPreview({ product, isDark }: { product: ScannedProduct; isDark: boolean }) {
  const name = product.name.length > 24 ? product.name.substring(0, 22) + '..' : product.name
  const hasPrice = product.sellingPrice > 0
  const priceText = `$${product.sellingPrice.toFixed(2)}`

  // Generate visual barcode bars
  const barcodeStr = product.barcode || product.sku || '0000000000'
  const bars: number[] = []
  for (let i = 0; i < barcodeStr.length * 2 + 10; i++) {
    bars.push(((i * 7 + 3) % 5) + 1)
  }

  return (
    <View style={{ alignItems: 'center', marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#a8a29e' : '#78716c', marginBottom: 6, letterSpacing: 0.5 }}>
        VISTA PREVIA DE ETIQUETA
      </Text>
      <View style={{
        width: 240, height: 120,
        backgroundColor: '#ffffff',
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#d6d3d1',
        borderStyle: 'dashed',
        padding: 10,
        justifyContent: 'space-between',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
      }}>
        {/* Top row: name + price */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: hasPrice ? 8 : 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#000' }} numberOfLines={1}>{name}</Text>
            {product.sku ? (
              <Text style={{ fontSize: 7, color: '#666', marginTop: 1 }}>SKU: {product.sku}</Text>
            ) : null}
          </View>
          {hasPrice && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#000' }}>{priceText}</Text>
            </View>
          )}
        </View>

        {/* Barcode visual */}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 28, gap: 0.5 }}>
            {bars.map((w, i) => (
              <View key={i} style={{
                width: Math.max(w * 0.8, 0.8),
                height: i % 3 === 0 ? 28 : 22,
                backgroundColor: '#000',
              }} />
            ))}
          </View>
          <Text style={{ fontSize: 7, color: '#333', marginTop: 2, fontFamily: 'monospace', letterSpacing: 1.5 }}>
            {barcodeStr}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 9, color: isDark ? '#78716c' : '#a8a29e', marginTop: 4 }}>
        51 × 25 mm (2" × 1")
      </Text>
    </View>
  )
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
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
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  )
}

export function PrintLabelScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useThemeStore()
  const processBarcode = useScannerStore(s => s.processBarcode)
  const isProcessing = useScannerStore(s => s.isProcessing)
  const warehouseId = useAuthStore(s => s.warehouseId)

  const [product, setProduct] = useState<ScannedProduct | null>(null)
  const [copies, setCopies] = useState(1)
  const [isPrinting, setIsPrinting] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'success' | 'error', message: string, duration = 2000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ type, message })
    toastTimerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const handleScan = useCallback(async (barcode: string) => {
    Keyboard.dismiss()
    const result = await processBarcode(barcode)
    if (result) {
      setProduct(result)
      setCopies(1)
      setSearchResults([])
      setSearchText('')
      showToast('success', result.name)
    } else {
      showToast('error', `No encontrado: ${barcode}`)
    }
  }, [processBarcode, showToast])

  useDataWedge(handleScan)

  const handleSearch = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (text.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.get<any>(
          `/api/warehouse/products-labels?search=${encodeURIComponent(text.trim())}&limit=20`
        )
        setSearchResults(data.products || [])
      } catch {
        setSearchResults([])
      }
      setIsSearching(false)
    }, 350)
  }, [])

  const selectProduct = useCallback((item: SearchResult) => {
    Keyboard.dismiss()
    setSearchText('')
    setSearchResults([])
    // Build a ScannedProduct from search result directly
    const p: ScannedProduct = {
      productId: item.id,
      name: item.name,
      sku: item.sku || '',
      barcode: item.barcode || '',
      currentStock: 0,
      quantityAvailable: 0,
      quantityReserved: 0,
      costPrice: 0,
      sellingPrice: item.sellingPrice || 0,
      category: item.categoryName,
    }
    setProduct(p)
    setCopies(1)
    showToast('success', item.name)
  }, [showToast])

  const handlePrint = useCallback(async () => {
    if (!product) return
    setIsPrinting(true)
    try {
      await api.post('/api/print/jobs', {
        documentType: 'product_label',
        sourceType: 'warehouse_app',
        sourceId: warehouseId?.toString(),
        warehouseId,
        copies,
        documentData: {
          productName: product.name,
          sku: product.sku || '',
          barcode: product.barcode || '',
          price: product.sellingPrice,
          currency: 'USD',
          includePrice: product.sellingPrice > 0,
          items: [{
            productName: product.name,
            sku: product.sku || '',
            barcode: product.barcode || '',
            price: product.sellingPrice,
            currency: 'USD',
            copies,
          }],
        },
      })
      playSuccessBeep()
      vibrateSuccess()
      setIsPrinting(false)
      showToast('success', `${copies} etiqueta${copies > 1 ? 's' : ''} enviada${copies > 1 ? 's' : ''}`)
      setTimeout(() => {
        setProduct(null)
        setCopies(1)
      }, 1500)
    } catch (err: any) {
      playErrorBeep()
      vibrateError()
      setIsPrinting(false)
      showToast('error', err.message || 'Error al imprimir')
    }
  }, [product, copies, warehouseId, showToast])

  const cardBg = isDark ? '#2d2a28' : '#fff'
  const cardBorder = isDark ? '#3f3b39' : '#f0efee'
  const chipBg = isDark ? '#3f3b39' : '#f5f5f4'

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
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ marginRight: 14 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#3f3b39' : '#f5f5f4',
          }}>
            <Text style={{ fontSize: 22, color: '#eb5b0c', fontWeight: '700' }}>‹</Text>
          </View>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, flex: 1 }}>Imprimir Etiqueta</Text>
        {(isProcessing || isPrinting) && <ActivityIndicator size="small" color="#eb5b0c" />}
      </View>

      {/* Loading overlay */}
      {isProcessing && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ backgroundColor: cardBg, borderRadius: 20, padding: 28, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#eb5b0c" />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 12 }}>Buscando producto...</Text>
          </View>
        </View>
      )}

      {product ? (
        /* ─── Product Selected ─── */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Product info card */}
          <Animated.View entering={FadeIn.duration(200)} style={{
            backgroundColor: cardBg, borderRadius: 18, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: cardBorder,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{product.name}</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {product.sku ? (
                <View style={{ backgroundColor: chipBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>SKU: {product.sku}</Text>
                </View>
              ) : null}
              {product.barcode ? (
                <View style={{ backgroundColor: chipBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>BC: {product.barcode}</Text>
                </View>
              ) : null}
              {product.category ? (
                <View style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '700' }}>{product.category}</Text>
                </View>
              ) : null}
            </View>

            {product.sellingPrice > 0 && (
              <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#eb5b0c' }}>${product.sellingPrice.toFixed(2)}</Text>
              </View>
            )}
          </Animated.View>

          {/* Label preview */}
          <LabelPreview product={product} isDark={isDark} />

          {/* Copies */}
          <View style={{
            backgroundColor: cardBg, borderRadius: 18, padding: 16, marginBottom: 16,
            borderWidth: 1, borderColor: cardBorder,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
              Copias
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <TouchableOpacity
                onPress={() => setCopies(Math.max(1, copies - 1))}
                activeOpacity={0.7}
                style={{
                  width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textSecondary, marginTop: -2 }}>−</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 44, fontWeight: '900', color: colors.text, width: 80, textAlign: 'center' }}>{copies}</Text>
              <TouchableOpacity
                onPress={() => setCopies(Math.min(99, copies + 1))}
                activeOpacity={0.7}
                style={{
                  width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDark ? '#1c1917' : '#f5f5f4',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textSecondary, marginTop: -2 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            onPress={handlePrint}
            disabled={isPrinting}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#eb5b0c', borderRadius: 16, paddingVertical: 16, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10,
              shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
              opacity: isPrinting ? 0.6 : 1,
            }}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 22 }}>🏷️</Text>
            )}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {isPrinting ? 'Enviando...' : `Imprimir ${copies} Etiqueta${copies > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setProduct(null); setCopies(1) }}
            activeOpacity={0.7}
            style={{
              borderRadius: 14, paddingVertical: 14, alignItems: 'center',
              backgroundColor: isDark ? '#2d2a28' : '#f5f5f4',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Escanear otro producto</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ─── Scan / Search Mode ─── */
        <View style={{ flex: 1 }}>
          {/* Search bar */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: cardBg, borderRadius: 14, paddingHorizontal: 14,
              borderWidth: 1, borderColor: searchText.length > 0 ? '#eb5b0c' : cardBorder,
            }}>
              <Text style={{ fontSize: 16, marginRight: 8, opacity: 0.5 }}>🔍</Text>
              <TextInput
                value={searchText}
                onChangeText={handleSearch}
                placeholder="Buscar por nombre, SKU o código..."
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1, paddingVertical: 14,
                  fontSize: 15, color: colors.text, fontWeight: '500',
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {isSearching && <ActivityIndicator size="small" color="#eb5b0c" />}
              {searchText.length > 0 && !isSearching && (
                <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]) }}>
                  <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {searchResults.length > 0 ? (
            /* Search results list */
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectProduct(item)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: cardBg, borderRadius: 14, padding: 14,
                    marginBottom: 8, flexDirection: 'row', alignItems: 'center',
                    borderWidth: 1, borderColor: cardBorder,
                  }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isDark ? '#1c1917' : '#fafaf9', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 22 }}>📦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                      {[item.sku && `SKU: ${item.sku}`, item.barcode && `BC: ${item.barcode}`].filter(Boolean).join('  ·  ')}
                    </Text>
                  </View>
                  {item.sellingPrice > 0 && (
                    <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#eb5b0c' }}>
                        ${item.sellingPrice.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : searchText.length >= 2 && !isSearching ? (
            /* No results */
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>Sin resultados</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>Intenta con otro término</Text>
            </View>
          ) : (
            /* Idle scan prompt */
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <View style={{
                width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(235,91,12,0.1)' : 'rgba(235,91,12,0.08)',
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 40 }}>🏷️</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Escanee un producto</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 }}>
                Use el escáner para leer el código de barras o busque el producto por nombre arriba
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                marginTop: 28, backgroundColor: chipBg, borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 10,
              }}>
                <Text style={{ fontSize: 16 }}>📷</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                  Presiona el botón lateral del escáner
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </View>
  )
}
