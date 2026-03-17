import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

export function PrintLabelScreen() {
  const scannedProduct = useKioskStore(s => s.scannedProduct)
  const printCopies = useKioskStore(s => s.printCopies)
  const isPrinting = useKioskStore(s => s.isPrinting)
  const printResult = useKioskStore(s => s.printResult)
  const productSearchResults = useKioskStore(s => s.productSearchResults)
  const errorMessage = useKioskStore(s => s.errorMessage)
  const exitPrintMode = useKioskStore(s => s.exitPrintMode)
  const searchProducts = useKioskStore(s => s.searchProducts)
  const selectProduct = useKioskStore(s => s.selectProduct)
  const setPrintCopies = useKioskStore(s => s.setPrintCopies)
  const printLabel = useKioskStore(s => s.printLabel)
  const clearScannedProduct = useKioskStore(s => s.clearScannedProduct)

  const [searchText, setSearchText] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      searchProducts(text)
    }, 400)
    setSearchTimeout(timeout)
  }, [searchProducts, searchTimeout])

  // Success state
  if (printResult) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View
          className="w-24 h-24 bg-green-500 rounded-3xl items-center justify-center mb-4"
          style={{ shadowColor: '#16a34a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }}
        >
          <Text className="text-white text-4xl font-black">&#10003;</Text>
        </View>
        <Text className="text-xl font-bold text-gray-900">Etiqueta enviada</Text>
        <Text className="text-sm text-gray-400 mt-1">{printResult.jobNumber}</Text>
      </View>
    )
  }

  // Printing state
  if (isPrinting) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#ea580c" />
        <Text className="text-base font-semibold text-gray-600 mt-4">Enviando a imprimir...</Text>
      </View>
    )
  }

  // Product found - show details
  if (scannedProduct) {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
          <Pressable
            onPress={clearScannedProduct}
            className="px-4 py-2 bg-white rounded-full active:bg-gray-100"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }}
          >
            <Text className="text-sm font-semibold text-gray-500">&#8592; Otro</Text>
          </Pressable>
          <Pressable
            onPress={exitPrintMode}
            className="px-4 py-2 bg-white rounded-full active:bg-gray-100"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }}
          >
            <Text className="text-sm font-semibold text-gray-400">Salir</Text>
          </Pressable>
        </View>

        {/* Product card */}
        <View className="px-5 pt-4">
          <View
            className="bg-white rounded-2xl p-5"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 }}
          >
            <Text className="text-lg font-bold text-gray-900" numberOfLines={2}>
              {scannedProduct.name}
            </Text>
            {scannedProduct.categoryName && (
              <Text className="text-xs text-gray-400 mt-1">{scannedProduct.categoryName}</Text>
            )}

            <View className="flex-row mt-4 gap-4">
              {scannedProduct.sku ? (
                <View className="flex-1">
                  <Text className="text-xs text-gray-400 font-medium">SKU</Text>
                  <Text className="text-sm font-semibold text-gray-700 mt-0.5">{scannedProduct.sku}</Text>
                </View>
              ) : null}
              {scannedProduct.barcode ? (
                <View className="flex-1">
                  <Text className="text-xs text-gray-400 font-medium">Barcode</Text>
                  <Text className="text-sm font-semibold text-gray-700 mt-0.5">{scannedProduct.barcode}</Text>
                </View>
              ) : null}
            </View>

            {scannedProduct.sellingPrice > 0 && (
              <View className="mt-4">
                <Text className="text-xs text-gray-400 font-medium">Precio</Text>
                <Text className="text-2xl font-black text-orange-500 mt-0.5">
                  {scannedProduct.currency === 'CUP'
                    ? `${Math.round(scannedProduct.sellingPrice).toLocaleString()} CUP`
                    : `$${scannedProduct.sellingPrice.toFixed(2)}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Copies selector */}
        <View className="px-5 pt-5">
          <Text className="text-xs text-gray-400 font-semibold tracking-wider mb-3">CANTIDAD DE COPIAS</Text>
          <View className="flex-row items-center justify-center gap-4">
            <Pressable
              onPress={() => setPrintCopies(printCopies - 1)}
              className="w-14 h-14 bg-white rounded-2xl items-center justify-center active:bg-gray-100"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
            >
              <Text className="text-2xl font-bold text-gray-500">-</Text>
            </Pressable>
            <View className="w-20 items-center">
              <Text
                className="font-black text-gray-900"
                style={{ fontSize: 40, lineHeight: 44 }}
              >
                {printCopies}
              </Text>
            </View>
            <Pressable
              onPress={() => setPrintCopies(printCopies + 1)}
              className="w-14 h-14 bg-white rounded-2xl items-center justify-center active:bg-gray-100"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
            >
              <Text className="text-2xl font-bold text-gray-500">+</Text>
            </Pressable>
          </View>
        </View>

        {/* Print button */}
        <View className="px-5 pt-6">
          <Pressable
            onPress={printLabel}
            className="bg-orange-500 rounded-2xl py-4 items-center active:bg-orange-600"
            style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
          >
            <Text className="text-white text-lg font-black tracking-wide">IMPRIMIR</Text>
          </Pressable>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View className="px-5 pt-3">
            <View className="bg-red-50 rounded-xl p-3">
              <Text className="text-red-600 text-sm font-medium">{errorMessage}</Text>
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  // Default: waiting for scan or search
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <Text className="text-base font-bold text-gray-900">Imprimir Etiqueta</Text>
        <Pressable
          onPress={exitPrintMode}
          className="px-4 py-2 bg-white rounded-full active:bg-gray-100"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }}
        >
          <Text className="text-sm font-semibold text-gray-400">Volver</Text>
        </Pressable>
      </View>

      {/* Scan prompt */}
      <View className="items-center pt-8 pb-6">
        <View
          className="w-20 h-20 bg-orange-500 rounded-3xl items-center justify-center mb-3"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 }}
        >
          <Text className="text-white text-lg font-black">SCAN</Text>
        </View>
        <Text className="text-lg font-bold text-gray-900">Escanee el producto</Text>
        <Text className="text-xs text-gray-400 mt-1 font-medium">o busque por nombre</Text>
      </View>

      {/* Search input */}
      <View className="px-5 pb-3">
        <TextInput
          value={searchText}
          onChangeText={handleSearchChange}
          placeholder="Buscar producto por nombre o SKU..."
          placeholderTextColor="#9ca3af"
          className="bg-white rounded-2xl px-4 py-3.5 text-sm text-gray-900 font-medium"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Search results */}
      {productSearchResults.length > 0 && (
        <FlatList
          data={productSearchResults}
          keyExtractor={(item) => item.id.toString()}
          className="flex-1 px-5"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                selectProduct(item)
                setSearchText('')
              }}
              className="bg-white rounded-xl px-4 py-3 mb-2 flex-row items-center active:bg-orange-50"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                  {[item.sku, item.barcode].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {item.sellingPrice > 0 && (
                <Text className="text-sm font-bold text-orange-500 ml-2">
                  {item.currency === 'CUP'
                    ? `${Math.round(item.sellingPrice)}`
                    : `$${item.sellingPrice.toFixed(2)}`}
                </Text>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Error overlay */}
      {errorMessage ? (
        <View
          className="absolute bottom-4 left-4 right-4 bg-red-500 rounded-2xl p-4"
          style={{ shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 }}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center">
              <Text className="text-white text-lg font-bold">!</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-bold">{errorMessage}</Text>
              <Text className="text-white/70 text-xs mt-0.5">Intente de nuevo</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
