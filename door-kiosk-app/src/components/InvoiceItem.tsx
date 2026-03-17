import React from 'react'
import { View, Text } from 'react-native'
import type { PendingSale, ScannedInvoice } from '../store/types'

interface InvoiceItemProps {
  sale: PendingSale
  scanned?: ScannedInvoice
}

export function InvoiceItem({ sale, scanned }: InvoiceItemProps) {
  const isValidated = scanned?.validated || sale.alreadyValidated

  return (
    <View
      className={`flex-row items-center px-3 py-2.5 rounded-xl border ${
        isValidated
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200'
      }`}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">
          {sale.documentNumber}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          ${sale.total.toFixed(2)} {sale.currency}
        </Text>
      </View>
      <View
        className={`px-2 py-1 rounded-lg ${
          isValidated ? 'bg-green-100' : 'bg-yellow-100'
        }`}
      >
        <Text
          className={`text-xs font-medium ${
            isValidated ? 'text-green-700' : 'text-yellow-700'
          }`}
        >
          {isValidated ? 'Validado' : 'Pendiente'}
        </Text>
      </View>
    </View>
  )
}
