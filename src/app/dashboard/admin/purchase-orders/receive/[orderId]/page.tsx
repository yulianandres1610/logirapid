'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  Barcode,
  CheckSquare,
  QrCode,
  Plus,
  Minus,
  Save,
  Printer,
  Eye,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Box,
  Tag
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PurchaseOrder, receivePurchaseOrder } from '@/lib/package-types'
import { PackageLabelPrinter } from '@/components/package-label-printer'

interface ReceiveItem {
  size: string
  totalQuantity: number
  quantityWithoutBarcode: number
  quantityWithBarcode: number
  unitPrice: number
  barcodeCount: number
}

export default function ReceiveOrderPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const orderId = params.orderId as string
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatingBarcodes, setGeneratingBarcodes] = useState(false)
  const [selectedBoxForLabel, setSelectedBoxForLabel] = useState<any>(null)
  const [showLabelModal, setShowLabelModal] = useState(false)

  // Estado para gestionar la recepción
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
  const [generatedBoxes, setGeneratedBoxes] = useState<any[]>([])

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      const response = await fetch(`/api/packages?type=orders&id=${orderId}`)
      if (response.ok) {
        const data = await response.json()
        setOrder(data)

        // Inicializar los items para recepción
        const initialReceiveItems = data.items.map((item: any) => ({
          size: item.size,
          totalQuantity: item.quantity,
          quantityWithoutBarcode: item.quantity, // Inicialmente todo está sin código de barras
          quantityWithBarcode: 0,
          unitPrice: item.unit_price,
          barcodeCount: 0
        }))
        setReceiveItems(initialReceiveItems)
      }
    } catch (error) {
      console.error('Error loading order:', error)
      showNotification('Error al cargar la orden', 'error')
    }
  }

  const generateUniqueBarcode = () => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 8).toUpperCase()
    return `PKG${timestamp}${random}`
  }

  const calculateBoxDimensions = (size: string) => {
    const dimensions = {
      'pequeño': { length: 30, width: 20, height: 15, weight_capacity: 5 },
      'mediano': { length: 40, width: 30, height: 20, weight_capacity: 10 },
      'grande': { length: 50, width: 40, height: 30, weight_capacity: 20 },
      'extra grande': { length: 60, width: 50, height: 40, weight_capacity: 30 }
    }
    return dimensions[size as keyof typeof dimensions] || dimensions['mediano']
  }

  const calculateBoxPrice = (size: string) => {
    const prices = {
      'pequeño': 12.5,
      'mediano': 18.75,
      'grande': 25,
      'extra grande': 35
    }
    return prices[size as keyof typeof prices] || prices['mediano']
  }

  const generateBarcodesForItem = (itemIndex: number, barcodeCount: number) => {
    if (barcodeCount <= 0 || receiveItems[itemIndex].quantityWithoutBarcode < barcodeCount) {
      showNotification('Cantidad de códigos de barras inválida', 'error')
      return
    }

    setGeneratingBarcodes(true)

    const newBoxes = []
    const item = receiveItems[itemIndex]

    for (let i = 0; i < barcodeCount; i++) {
      const barcode = generateUniqueBarcode()
      const dimensions = calculateBoxDimensions(item.size)
      const price = calculateBoxPrice(item.size)

      const newBox = {
        id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        barcode: barcode,
        size: item.size,
        dimensions: dimensions,
        cost: price,
        supplier: order?.supplier || '',
        status: 'AVAILABLE',
        current_location: 'Almacén Principal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        purchase_order_id: orderId
      }

      newBoxes.push(newBox)
    }

    // Actualizar el estado del item
    setReceiveItems(prev => {
      const updated = [...prev]
      updated[itemIndex] = {
        ...updated[itemIndex],
        quantityWithoutBarcode: updated[itemIndex].quantityWithoutBarcode - barcodeCount,
        quantityWithBarcode: updated[itemIndex].quantityWithBarcode + barcodeCount,
        barcodeCount: 0
      }
      return updated
    })

    // Agregar las nuevas cajas generadas
    setGeneratedBoxes(prev => [...prev, ...newBoxes])

    setGeneratingBarcodes(false)
    showNotification(`Se generaron ${barcodeCount} códigos de barras exitosamente`, 'success')
  }

  const updateReceiveItem = (index: number, field: string, value: number) => {
    setReceiveItems(prev => {
      const updated = [...prev]
      const item = updated[index]

      if (field === 'barcodeCount') {
        // Validar que no exceda la cantidad sin código de barras
        if (value > item.quantityWithoutBarcode) {
          showNotification('La cantidad no puede exceder el stock sin código de barras', 'error')
          return prev
        }
        updated[index] = { ...item, [field]: value }
      } else {
        updated[index] = { ...item, [field]: value }
      }

      return updated
    })
  }

  const handleReceiveOrder = async () => {
    try {
      setLoading(true)

      // Validar que la suma de cantidades coincida
      const totalReceived = receiveItems.reduce((sum, item) =>
        sum + item.quantityWithoutBarcode + item.quantityWithBarcode, 0)

      const totalExpected = receiveItems.reduce((sum, item) => sum + item.totalQuantity, 0)

      if (totalReceived !== totalExpected) {
        showNotification('Las cantidades recibidas no coinciden con las esperadas', 'error')
        return
      }

      // Procesar la recepción de la orden
      const result = await receivePurchaseOrder(orderId, generatedBoxes)

      if (result) {
        showNotification('Orden recibida exitosamente', 'success')
        router.push('/dashboard/admin/purchase-orders')
      } else {
        showNotification('Error al recibir la orden', 'error')
      }

    } catch (error) {
      console.error('Error receiving order:', error)
      showNotification('Error al recibir la orden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintLabel = (box: any) => {
    setSelectedBoxForLabel(box)
    setShowLabelModal(true)
  }

  if (!user || !order) {
    return <div>Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/admin/purchase-orders')}
              className={cn(
                "p-2",
                theme === 'dark' ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className={cn(
              "p-3 rounded-xl",
              theme === 'dark' ? "bg-green-900/30" : "bg-green-50"
            )}>
              <Package className={cn(
                "w-8 h-8",
                theme === 'dark' ? "text-green-400" : "text-green-600"
              )} />
            </div>
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Recibir Orden de Compra
              </h1>
              <p className={cn(
                "text-base mt-1",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                {order.order_number} - {order.supplier}
              </p>
            </div>
          </div>

          <div className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            theme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
          )}>
            Total: ${order.total_amount.toFixed(2)}
          </div>
        </div>

        {/* Order Info */}
        <div className={cn(
          "rounded-2xl border p-6 mb-6",
          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                Fecha de Orden
              </p>
              <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                {new Date(order.order_date).toLocaleDateString()}
              </p>
            </div>
            {order.expected_delivery && (
              <div>
                <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                  Entrega Esperada
                </p>
                <p className={cn("font-medium", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                  {new Date(order.expected_delivery).toLocaleDateString()}
                </p>
              </div>
            )}
            <div>
              <p className={cn("text-sm mb-1", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                Estado Actual
              </p>
              <p className={cn("font-medium text-blue-600", theme === 'dark' ? "text-blue-400" : "text-blue-600")}>
                {order.status === 'COMPRADA' ? 'Comprada' : order.status}
              </p>
            </div>
          </div>
        </div>

        {/* Items Reception */}
        <div className="flex-1 overflow-y-auto space-y-6">
          <div className={cn(
            "rounded-2xl border p-6",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <h2 className={cn(
              "text-xl font-semibold mb-6 flex items-center gap-2",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              <Box className="w-6 h-6" />
              Items para Recepción
            </h2>

            <div className="space-y-6">
              {receiveItems.map((item, index) => (
                <div key={index} className={cn(
                  "rounded-xl border p-6",
                  theme === 'dark' ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={cn(
                      "text-lg font-semibold",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Caja {item.size}
                    </h3>
                    <div className={cn(
                      "text-lg font-bold text-blue-600",
                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                    )}>
                      {item.totalQuantity} unidades
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Stock Distribution */}
                    <div>
                      <h4 className={cn(
                        "text-md font-medium mb-3 flex items-center gap-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        <Package className="w-5 h-5" />
                        Distribución de Stock
                      </h4>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-500" />
                            <span className={cn("text-sm", theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
                              Sin Código de Barras
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateReceiveItem(index, 'quantityWithoutBarcode', Math.max(0, item.quantityWithoutBarcode - 1))}
                              disabled={item.quantityWithoutBarcode <= 0}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className={cn(
                              "font-bold text-lg min-w-[3rem] text-center",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {item.quantityWithoutBarcode}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateReceiveItem(index, 'quantityWithoutBarcode', item.quantityWithoutBarcode + 1)}
                              disabled={item.quantityWithoutBarcode + item.quantityWithBarcode >= item.totalQuantity}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2">
                            <Barcode className="w-4 h-4 text-blue-600" />
                            <span className={cn("text-sm font-medium", theme === 'dark' ? "text-blue-400" : "text-blue-700")}>
                              Con Código de Barras
                            </span>
                          </div>
                          <div className={cn(
                            "font-bold text-lg min-w-[3rem] text-center text-blue-600",
                            theme === 'dark' ? "text-blue-400" : "text-blue-600"
                          )}>
                            {item.quantityWithBarcode}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Generation */}
                    <div>
                      <h4 className={cn(
                        "text-md font-medium mb-3 flex items-center gap-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        <QrCode className="w-5 h-5" />
                        Generar Códigos de Barras
                      </h4>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantityWithoutBarcode}
                            value={item.barcodeCount}
                            onChange={(e) => updateReceiveItem(index, 'barcodeCount', parseInt(e.target.value) || 0)}
                            placeholder="Cantidad"
                            className={cn(
                              "flex-1",
                              theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                            )}
                          />
                          <Button
                            onClick={() => generateBarcodesForItem(index, item.barcodeCount)}
                            disabled={generatingBarcodes || item.barcodeCount <= 0 || item.barcodeCount > item.quantityWithoutBarcode}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {generatingBarcodes ? (
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                              <Barcode className="w-4 h-4" />
                            )}
                          </Button>
                        </div>

                        <div className={cn(
                          "text-xs p-2 rounded-lg",
                          theme === 'dark' ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"
                        )}>
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          Disponible para generar: {item.quantityWithoutBarcode} códigos
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Generated Boxes Preview */}
          {generatedBoxes.length > 0 && (
            <div className={cn(
              "rounded-2xl border p-6",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <h2 className={cn(
                "text-xl font-semibold mb-6 flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Tag className="w-6 h-6" />
                Cajas con Códigos Generados ({generatedBoxes.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedBoxes.map((box, index) => (
                  <div key={index} className={cn(
                    "rounded-lg border p-4",
                    theme === 'dark' ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Caja {box.size}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium",
                        theme === 'dark' ? "bg-green-900/30 text-green-400" : ""
                      )}>
                        {box.status}
                      </span>
                    </div>
                    <div className={cn(
                      "text-xs font-mono mb-2 p-2 rounded bg-gray-800 text-green-400",
                      theme === 'dark' ? "bg-gray-900" : "bg-gray-100 text-gray-700"
                    )}>
                      {box.barcode}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintLabel(box)}
                        className="flex-1"
                      >
                        <Printer className="w-3 h-3 mr-1" />
                        Etiqueta
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className={cn(
            "rounded-2xl border p-6",
            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
          )}>
            <h2 className={cn(
              "text-xl font-semibold mb-4 flex items-center gap-2",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              <TrendingUp className="w-6 h-6" />
              Resumen de Recepción
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={cn(
                "p-4 rounded-lg",
                theme === 'dark' ? "bg-gray-700/50" : "bg-gray-50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-gray-500" />
                  <span className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                    Total sin Código
                  </span>
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {receiveItems.reduce((sum, item) => sum + item.quantityWithoutBarcode, 0)}
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-lg",
                theme === 'dark' ? "bg-blue-900/20 border border-blue-800" : "bg-blue-50 border border-blue-200"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Barcode className="w-5 h-5 text-blue-600" />
                  <span className={cn("text-sm font-medium", theme === 'dark' ? "text-blue-400" : "text-blue-700")}>
                    Con Código Generado
                  </span>
                </div>
                <div className={cn(
                  "text-2xl font-bold text-blue-600",
                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                )}>
                  {receiveItems.reduce((sum, item) => sum + item.quantityWithBarcode, 0)}
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-lg",
                theme === 'dark' ? "bg-green-900/20 border border-green-800" : "bg-green-50 border border-green-200"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className={cn("text-sm font-medium", theme === 'dark' ? "text-green-400" : "text-green-700")}>
                    Total a Recibir
                  </span>
                </div>
                <div className={cn(
                  "text-2xl font-bold text-green-600",
                  theme === 'dark' ? "text-green-400" : "text-green-600"
                )}>
                  {receiveItems.reduce((sum, item) => sum + item.totalQuantity, 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/admin/purchase-orders')}
              className={cn(
                theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              Cancelar
            </Button>

            <Button
              onClick={handleReceiveOrder}
              disabled={loading || receiveItems.some(item => item.quantityWithoutBarcode + item.quantityWithBarcode !== item.totalQuantity)}
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {loading ? 'Procesando...' : 'Recibir Orden'}
            </Button>
          </div>
        </div>

        {/* Label Printer Modal */}
        {selectedBoxForLabel && (
          <PackageLabelPrinter
            box={selectedBoxForLabel}
            isVisible={showLabelModal}
            onClose={() => {
              setShowLabelModal(false)
              setSelectedBoxForLabel(null)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}