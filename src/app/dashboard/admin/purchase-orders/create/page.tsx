'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  FileText,
  CreditCard,
  CheckSquare,
  Package,
  Calendar,
  DollarSign,
  User,
  Phone,
  Mail,
  Building,
  TrendingUp,
  Printer,
  X
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPurchaseOrder } from '@/lib/package-types'
import { PurchaseOrderInvoice } from '@/components/purchase-order-invoice'

interface OrderFormData {
  supplier: string
  supplier_contact: string
  supplier_phone: string
  supplier_email: string
  items: {
    size: string
    quantity: number
    unit_price: number
    total_price: number
  }[]
  expected_delivery?: string
  notes?: string
  payment_method?: string
  payment_terms?: string
  status: string
}

const BOX_SIZES = ['pequeño', 'mediano', 'grande', 'extra grande']
const PAYMENT_METHODS = ['Transferencia', 'Efectivo', 'Tarjeta de Crédito', 'Cheque']
const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Pago Anticipado']

export default function CreatePurchaseOrderPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<any>(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const [formData, setFormData] = useState<OrderFormData>({
    supplier: '',
    supplier_contact: '',
    supplier_phone: '',
    supplier_email: '',
    items: [{ size: 'mediano', quantity: 1, unit_price: 0, total_price: 0 }],
    expected_delivery: '',
    notes: '',
    payment_method: 'Transferencia',
    payment_terms: 'Net 30',
    status: 'BORRADOR'
  })

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const calculateSubtotal = () => {
    return calculateTotal()
  }

  const calculateTax = () => {
    return calculateSubtotal() * 0.16 // 16% IVA
  }

  const calculateGrandTotal = () => {
    return calculateSubtotal() + calculateTax()
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { size: 'mediano', quantity: 1, unit_price: 0, total_price: 0 }]
    }))
  }

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items]
      newItems[index] = { ...newItems[index], [field]: value }

      // Recalculate total price when quantity or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price
      }

      return { ...prev, items: newItems }
    })
  }

  const generateOrderNumber = () => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 5).toUpperCase()
    return `PO${timestamp}${random}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.supplier || formData.items.length === 0) {
      showNotification('Por favor completa los campos requeridos', 'error')
      return
    }

    try {
      setLoading(true)

      const orderData = {
        ...formData,
        order_number: generateOrderNumber(),
        total_amount: calculateGrandTotal(),
        order_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const result = await createPurchaseOrder(orderData)
      setCreatedOrder(result)
      showNotification('Orden de compra creada exitosamente', 'success')

      // Show invoice for printing
      setShowInvoice(true)

    } catch (error) {
      console.error('Error creating order:', error)
      showNotification('Error al crear la orden', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsDraft = async () => {
    try {
      setLoading(true)

      const orderData = {
        ...formData,
        order_number: generateOrderNumber(),
        total_amount: calculateGrandTotal(),
        order_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'BORRADOR'
      }

      await createPurchaseOrder(orderData)
      showNotification('Orden guardada como borrador', 'success')
      router.push('/dashboard/admin/purchase-orders')

    } catch (error) {
      console.error('Error saving draft:', error)
      showNotification('Error al guardar borrador', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestBudget = async () => {
    try {
      setLoading(true)

      const orderData = {
        ...formData,
        order_number: generateOrderNumber(),
        total_amount: calculateGrandTotal(),
        order_date: new Date().toISOString(),
        budget_request_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'SOLICITUD_PRESUPUESTO'
      }

      await createPurchaseOrder(orderData)
      showNotification('Solicitud de presupuesto enviada', 'success')
      router.push('/dashboard/admin/purchase-orders')

    } catch (error) {
      console.error('Error requesting budget:', error)
      showNotification('Error al solicitar presupuesto', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
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
              theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50"
            )}>
              <FileText className={cn(
                "w-8 h-8",
                theme === 'dark' ? "text-blue-400" : "text-blue-600"
              )} />
            </div>
            <div>
              <h1 className={cn(
                "text-3xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Nueva Orden de Compra
              </h1>
              <p className={cn(
                "text-base mt-1",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Crea una nueva orden de compra con formato de factura
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSaveAsDraft}
              disabled={loading}
              variant="outline"
              className={cn(
                theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Borrador
            </Button>

            <Button
              onClick={handleRequestBudget}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Solicitar Presupuesto
            </Button>
          </div>
        </div>

        {/* Invoice Form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Invoice Header */}
            <div className={cn(
              "rounded-2xl border p-8",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-8">
                {/* Company Info */}
                <div>
                  <h2 className={cn(
                    "text-2xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    LogiRapid Logistics
                  </h2>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Sistema de Gestión de Compras
                  </p>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    {user?.email}
                  </p>
                </div>

                {/* Invoice Status & Date */}
                <div className="text-right">
                  <div className={cn(
                    "inline-block px-4 py-2 rounded-lg text-sm font-medium mb-3",
                    theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                  )}>
                    Estado: <span className="text-blue-600">BORRADOR</span>
                  </div>
                  <div className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    <p>Fecha: {new Date().toLocaleDateString('es-ES')}</p>
                    <p>Orden #: Nueva</p>
                  </div>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className={cn(
                    "text-lg font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Building className="w-5 h-5" />
                    Información del Proveedor
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Proveedor *
                      </label>
                      <Input
                        required
                        value={formData.supplier}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                        placeholder="Nombre del proveedor"
                        className={cn(
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          <User className="w-4 h-4 inline mr-1" />
                          Contacto
                        </label>
                        <Input
                          value={formData.supplier_contact}
                          onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))}
                          placeholder="Nombre de contacto"
                          className={cn(
                            theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          <Phone className="w-4 h-4 inline mr-1" />
                          Teléfono
                        </label>
                        <Input
                          value={formData.supplier_phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, supplier_phone: e.target.value }))}
                          placeholder="Teléfono del proveedor"
                          className={cn(
                            theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        <Mail className="w-4 h-4 inline mr-1" />
                        Email
                      </label>
                      <Input
                        type="email"
                        value={formData.supplier_email}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplier_email: e.target.value }))}
                        placeholder="Email del proveedor"
                        className={cn(
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div>
                  <h3 className={cn(
                    "text-lg font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Calendar className="w-5 h-5" />
                    Detalles de la Orden
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Fecha de Entrega Esperada
                      </label>
                      <Input
                        type="date"
                        value={formData.expected_delivery}
                        onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                        className={cn(
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Método de Pago
                      </label>
                      <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      >
                        {PAYMENT_METHODS.map(method => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Términos de Pago
                      </label>
                      <select
                        value={formData.payment_terms}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      >
                        {PAYMENT_TERMS.map(term => (
                          <option key={term} value={term}>{term}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className={cn(
              "rounded-2xl border p-8",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-semibold flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <Package className="w-6 h-6" />
                  Items de la Orden
                </h3>
                <Button
                  type="button"
                  onClick={addItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Item
                </Button>
              </div>

              {/* Items Table Header */}
              <div className={cn(
                "grid grid-cols-12 gap-4 p-4 rounded-t-lg font-medium text-sm",
                theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
              )}>
                <div className="col-span-3">Tamaño</div>
                <div className="col-span-2">Cantidad</div>
                <div className="col-span-2">Precio Unitario</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-1">Estado</div>
                <div className="col-span-2">Acciones</div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className={cn(
                    "grid grid-cols-12 gap-4 p-4 rounded-lg border",
                    theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="col-span-3">
                      <select
                        value={item.size}
                        onChange={(e) => updateItem(index, 'size', e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-sm",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      >
                        {BOX_SIZES.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className={cn(
                          "text-sm",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className={cn(
                          "text-sm",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <div className={cn(
                        "px-3 py-2 rounded-lg border text-sm font-medium",
                        theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}>
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>

                    <div className="col-span-1">
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-medium text-center",
                        item.quantity > 0
                          ? theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"
                          : theme === 'dark' ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-700"
                      )}>
                        {item.quantity > 0 ? "Activo" : "Sin stock"}
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className={cn(
                            "text-red-500 hover:bg-red-50 hover:text-red-700",
                            theme === 'dark' ? "hover:bg-red-900/20" : ""
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes Section */}
            <div className={cn(
              "rounded-2xl border p-8",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <h3 className={cn(
                "text-lg font-semibold mb-4",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Notas Adicionales
              </h3>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
                placeholder="Notas o comentarios adicionales sobre esta orden de compra..."
                className={cn(
                  "w-full px-4 py-3 rounded-lg border resize-none",
                  theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>

            {/* Summary Section */}
            <div className={cn(
              "rounded-2xl border p-8",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="max-w-md ml-auto">
                <h3 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <DollarSign className="w-5 h-5" />
                  Resumen de Totales
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Subtotal:
                    </span>
                    <span className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      ${calculateSubtotal().toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      IVA (16%):
                    </span>
                    <span className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      ${calculateTax().toFixed(2)}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className={cn(
                        "text-lg font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        Total:
                      </span>
                      <span className={cn(
                        "text-xl font-bold text-blue-600",
                        theme === 'dark' ? "text-blue-400" : "text-blue-600"
                      )}>
                        ${calculateGrandTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/admin/purchase-orders')}
                className={cn(
                  theme === 'dark' ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-8"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {loading ? 'Creando...' : 'Crear y Completar Orden'}
              </Button>
            </div>
          </form>
        </div>

        {/* Invoice Component */}
        {createdOrder && (
          <PurchaseOrderInvoice
            order={createdOrder}
            isVisible={showInvoice}
          />
        )}
      </div>
    </DashboardLayout>
  )
}