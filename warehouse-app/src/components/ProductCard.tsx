import React from 'react'
import { View, Text } from 'react-native'
import { Badge } from './ui/Badge'
import type { ScannedProduct } from '@/src/stores/scanner-store'

interface ProductCardProps {
  product: ScannedProduct
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-3 border border-dark-100"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
    >
      <Text className="text-base font-bold text-dark-800" numberOfLines={2}>
        {product.name}
      </Text>
      <View className="flex-row items-center mt-2 gap-2">
        <View className="bg-dark-50 rounded-lg px-2.5 py-1">
          <Text className="text-xs text-dark-500 font-medium">SKU: {product.sku}</Text>
        </View>
        {product.barcode && (
          <View className="bg-dark-50 rounded-lg px-2.5 py-1">
            <Text className="text-xs text-dark-500 font-medium">BC: {product.barcode}</Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center mt-3 gap-2">
        <Badge variant={product.currentStock > 0 ? 'success' : 'danger'}>
          {`Stock: ${product.currentStock} ${product.unit || 'uds'}`}
        </Badge>
        {product.variants && product.variants.length > 0 && (
          <Badge variant="info">{`${product.variants.length} variantes`}</Badge>
        )}
      </View>
    </View>
  )
}
