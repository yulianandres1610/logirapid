import React from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native'
import type { ScannedProduct } from '@/src/stores/scanner-store'

interface VariantSelectorProps {
  visible: boolean
  product: ScannedProduct
  onSelect: (variantId: number, variantName: string) => void
  onClose: () => void
}

export function VariantSelector({ visible, product, onSelect, onClose }: VariantSelectorProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-5 max-h-[70%]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-black text-dark-800">Seleccionar Variante</Text>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 bg-dark-100 rounded-xl items-center justify-center">
              <Text className="text-dark-400 text-base font-bold">✕</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-sm text-dark-400 mb-3 font-medium">{product.name}</Text>
          <FlatList
            data={product.variants || []}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelect(item.id, item.name)}
                className="p-4 border border-dark-100 rounded-2xl mb-2"
                activeOpacity={0.7}
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
              >
                <Text className="text-base font-bold text-dark-800">{item.name}</Text>
                <View className="flex-row items-center mt-1 gap-3">
                  <Text className="text-xs text-dark-400 font-medium">SKU: {item.sku}</Text>
                  <Text className="text-xs text-dark-400 font-medium">Stock: {item.stock}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  )
}
