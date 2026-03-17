import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, Alert } from 'react-native'
import { useKioskStore } from '../store/kiosk-store'

function useElapsedTime(entryTime: string | null) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!entryTime) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [entryTime])

  if (!entryTime) return null

  const diffMs = now - new Date(entryTime).getTime()
  if (diffMs < 0) return null

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds, totalSeconds }
}

export function ExitPendingScreen() {
  const visitor = useKioskStore(s => s.visitor)
  const entryTime = useKioskStore(s => s.entryTime)
  const pendingSales = useKioskStore(s => s.pendingSales)
  const scannedInvoices = useKioskStore(s => s.scannedInvoices)
  const confirmExit = useKioskStore(s => s.confirmExit)

  const elapsed = useElapsedTime(entryTime)

  const hasPending = pendingSales.length > 0
  const allValidated = hasPending && pendingSales.every(
    sale => sale.alreadyValidated || scannedInvoices.some(
      s => s.documentNumber === sale.documentNumber && s.validated
    )
  )

  const hasFailedScans = scannedInvoices.some(s => !s.validated)

  const extraScanned = scannedInvoices.filter(
    s => !pendingSales.some(p => p.documentNumber === s.documentNumber)
  )

  // Build audit notes with all scanned documents
  const buildExitNotes = () => {
    const parts: string[] = []
    const valid = scannedInvoices.filter(s => s.validated)
    const failed = scannedInvoices.filter(s => !s.validated)

    if (valid.length > 0) {
      parts.push(`Validados: ${valid.map(s => s.documentNumber).join(', ')}`)
    }
    if (failed.length > 0) {
      parts.push(`Rechazados: ${failed.map(s => `${s.documentNumber} (${s.reason || 'no valida'})`).join(', ')}`)
    }
    return parts.length > 0 ? parts.join(' | ') : undefined
  }

  const hasValidScans = scannedInvoices.some(s => s.validated)

  const handleConfirmExit = () => {
    const notes = buildExitNotes()

    // If there are failed scans but NO valid scans — warn
    if (hasFailedScans && !hasValidScans) {
      const failedDocs = scannedInvoices
        .filter(s => !s.validated)
        .map(s => s.documentNumber)
        .join(', ')

      Alert.alert(
        'Factura no valida',
        `La factura escaneada (${failedDocs}) no es valida para salir.\n\n¿Desea salir sin mercancia?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Si, salir',
            style: 'destructive',
            onPress: () => confirmExit(notes),
          },
        ]
      )
      return
    }

    if (hasPending && !allValidated) {
      Alert.alert(
        'Facturas sin validar',
        'Hay facturas pendientes que no han sido validadas.\n\n¿Desea salir sin validar?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Si, salir',
            style: 'destructive',
            onPress: () => confirmExit(notes || 'Salida sin validar facturas pendientes'),
          },
        ]
      )
      return
    }

    // Normal exit — still send notes with scan details for audit
    confirmExit(notes)
  }

  // Format time unit with leading zero
  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Visitor header + time card */}
        <View
          className="mx-4 mt-4 bg-white rounded-2xl p-4"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
        >
          <View className="flex-row items-center">
            <View
              className="w-12 h-12 bg-orange-500 rounded-xl items-center justify-center mr-3"
              style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}
            >
              <Text className="text-white text-lg font-black">S</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                {visitor?.fullName}
              </Text>
              <Text className="text-xs text-gray-400 mt-0.5">CI: {visitor?.idNumber}</Text>
            </View>
          </View>

          {/* Time inside */}
          <View className="mt-3 pt-3 border-t border-gray-100 items-center">
            <Text className="text-[10px] font-semibold text-gray-400 tracking-wider mb-1">TIEMPO DENTRO</Text>
            {elapsed ? (
              <View className="flex-row items-center gap-1">
                {elapsed.days > 0 && (
                  <View className="items-center px-2">
                    <Text className="text-2xl font-black text-orange-500">{elapsed.days}</Text>
                    <Text className="text-[9px] text-gray-400 font-semibold">DIA{elapsed.days > 1 ? 'S' : ''}</Text>
                  </View>
                )}
                {(elapsed.days > 0 || elapsed.hours > 0) && (
                  <View className="items-center px-2">
                    <Text className="text-2xl font-black text-orange-500">{pad(elapsed.hours)}</Text>
                    <Text className="text-[9px] text-gray-400 font-semibold">HRS</Text>
                  </View>
                )}
                <View className="items-center px-2">
                  <Text className="text-2xl font-black text-orange-500">{pad(elapsed.minutes)}</Text>
                  <Text className="text-[9px] text-gray-400 font-semibold">MIN</Text>
                </View>
                <View className="items-center px-2">
                  <Text className="text-2xl font-black text-orange-500">{pad(elapsed.seconds)}</Text>
                  <Text className="text-[9px] text-gray-400 font-semibold">SEG</Text>
                </View>
              </View>
            ) : (
              <Text className="text-sm text-gray-300">--:--:--</Text>
            )}
          </View>
        </View>

        {/* Scan prompt */}
        <View
          className="mx-4 mt-3 bg-orange-500 rounded-2xl p-4 flex-row items-center"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 }}
        >
          <View className="w-11 h-11 bg-white/20 rounded-xl items-center justify-center mr-3">
            <Text className="text-white text-base font-black">||</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-white">Escanee ticket o factura</Text>
            <Text className="text-xs text-white/60 mt-0.5">para validar la compra</Text>
          </View>
        </View>

        {/* Pending invoices from API */}
        {hasPending && (
          <View className="mx-4 mt-3">
            <Text className="text-xs font-bold text-gray-400 mb-2 tracking-wider px-1">
              FACTURAS PENDIENTES ({pendingSales.length})
            </Text>
            <View className="gap-2">
              {pendingSales.map(sale => {
                const isValidated = sale.alreadyValidated ||
                  scannedInvoices.some(s => s.documentNumber === sale.documentNumber && s.validated)
                return (
                  <View
                    key={`${sale.type}-${sale.id}`}
                    className={`flex-row items-center p-3 rounded-xl ${
                      isValidated ? 'bg-green-50' : 'bg-white'
                    }`}
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                  >
                    <View className={`w-9 h-9 rounded-lg items-center justify-center mr-3 ${
                      isValidated ? 'bg-green-500' : 'bg-gray-100'
                    }`}>
                      <Text className={`text-sm font-bold ${isValidated ? 'text-white' : 'text-gray-400'}`}>
                        {isValidated ? '✓' : '#'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                        {sale.documentNumber}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        ${sale.total.toFixed(2)} {sale.currency}
                      </Text>
                    </View>
                    <Text className={`text-xs font-bold ${isValidated ? 'text-green-600' : 'text-gray-300'}`}>
                      {isValidated ? 'Validada' : 'Pendiente'}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Extra scanned documents */}
        {extraScanned.length > 0 && (
          <View className="mx-4 mt-3">
            <Text className="text-xs font-bold text-gray-400 mb-2 tracking-wider px-1">
              DOCUMENTOS ESCANEADOS
            </Text>
            <View className="gap-2">
              {extraScanned.map(s => (
                <View
                  key={s.documentNumber}
                  className={`p-3 rounded-xl ${
                    s.validated ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className={`w-9 h-9 rounded-lg items-center justify-center mr-3 ${
                      s.validated ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      <Text className="text-white text-sm font-bold">{s.validated ? '✓' : '✕'}</Text>
                    </View>
                    <Text className="text-sm font-semibold text-gray-900 flex-1">{s.documentNumber}</Text>
                    <Text className={`text-xs font-bold ${s.validated ? 'text-green-600' : 'text-red-500'}`}>
                      {s.validated ? 'Validada' : 'No valida'}
                    </Text>
                  </View>
                  {!s.validated && s.reason && (
                    <Text className="text-xs text-red-400 mt-1 ml-12">{s.reason}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action button */}
      <View className="px-4 pb-5 pt-2">
        <Pressable
          onPress={handleConfirmExit}
          className="w-full py-4 rounded-2xl items-center bg-orange-500 active:bg-orange-600"
          style={{ shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
        >
          <Text className="text-white text-base font-bold">Confirmar Salida</Text>
        </Pressable>
      </View>
    </View>
  )
}
