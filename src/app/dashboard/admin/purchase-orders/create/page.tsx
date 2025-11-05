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
  Building2,
  TrendingUp,
  Printer,
  X,
  CheckCircle,
  Clock,
 Building
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
  status: 'BORRADOR' | 'SOLICITUD_PRESUPUESTO' | 'COMPRADA' | 'RECIBIDA' | 'CANCELLED'
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
      showNotification('error', 'Por favor completa los campos requeridos', 'Por favor completa los campos requeridos')
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
      showNotification('success', 'Orden de compra creada exitosamente', 'Orden de compra creada exitosamente')

      // Show invoice for printing
      setShowInvoice(true)

    } catch (error) {
      console.error('Error creating order:', error)
      showNotification('error', 'Error al crear la orden', 'Error al crear la orden')
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
        status: 'BORRADOR' as const
      }

      await createPurchaseOrder(orderData)
      showNotification('success', 'Orden guardada como borrador', 'Orden guardada como borrador')
      router.push('/dashboard/admin/purchase-orders')

    } catch (error) {
      console.error('Error saving draft:', error)
      showNotification('error', 'Error al guardar borrador', 'Error al guardar borrador')
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
        status: 'SOLICITUD_PRESUPUESTO' as const
      }

      await createPurchaseOrder(orderData)
      showNotification('success', 'Solicitud de presupuesto enviada', 'Solicitud de presupuesto enviada')
      router.push('/dashboard/admin/purchase-orders')

    } catch (error) {
      console.error('Error requesting budget:', error)
      showNotification('error', 'Error al solicitar presupuesto', 'Error al solicitar presupuesto')
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

        {/* Invoice Container */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className={cn(
              "max-w-6xl mx-auto rounded-2xl border overflow-hidden",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              {/* Invoice Header */}
              <div className={cn(
                "border-b p-8",
                theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
              )}>
                <div className="flex items-center justify-between">
                  {/* Company Info */}
                  <div>
                    <div className={cn(
                      "text-3xl font-bold mb-2",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      CubaRapid Logistics
                    </div>
                    <div className={cn(
                      "text-sm space-y-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      <div>123 Calle Principal, La Habana, Cuba</div>
                      <div>Tel: +53 5 555 1234 | Email: compras@cubarapid.cu</div>
                      <div>www.cubarapid.cu</div>
                    </div>
                  </div>

                  {/* Order Info */}
                  <div className="text-right">
                    <div className={cn(
                      "text-2xl font-bold mb-3",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      ORDEN DE COMPRA
                    </div>
                    <div className={cn(
                      "inline-block px-4 py-2 rounded-lg text-sm font-medium mb-3 border",
                      theme === 'dark' ? "bg-blue-900/30 text-blue-400 border-blue-700" : "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      <Clock className="w-4 h-4 inline mr-1" />
                      BORRADOR
                    </div>
                    <div className={cn(
                      "text-sm space-y-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      <div>Número: <span className={cn("font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>Nueva</span></div>
                      <div>Fecha: <span className={cn("font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>{new Date().toLocaleDateString('es-ES')}</span></div>
                      <div>Creado por: <span className={cn("font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>{user?.name || user?.email}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplier & Order Info */}
              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className={cn(
                    "text-sm font-bold mb-4 uppercase tracking-wide flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Building2 className="w-4 h-4" />
                    Proveedor
                  </h3>
                  <div className="space-y-3">
                    <Input
                      placeholder="Nombre del proveedor *"
                      value={formData.supplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                      )}
                    />
                    <Input
                      placeholder="Contacto"
                      value={formData.supplier_contact}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier_contact: e.target.value }))}
                      className={cn(
                        theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Teléfono"
                        value={formData.supplier_phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplier_phone: e.target.value }))}
                        className={cn(
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                        )}
                      />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={formData.supplier_email}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplier_email: e.target.value }))}
                        className={cn(
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className={cn(
                    "text-sm font-bold mb-4 uppercase tracking-wide flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <CreditCard className="w-4 h-4" />
                    Información de Pago
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className={cn(
                        "block text-xs font-medium mb-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Fecha de Entrega
                      </label>
                      <Input
                        type="date"
                        value={formData.expected_delivery}
                        onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                        className={cn(
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                        )}
                      />
                    </div>
                    <div>
                      <label className={cn(
                        "block text-xs font-medium mb-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Método de Pago
                      </label>
                      <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-sm",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                        )}
                      >
                        {PAYMENT_METHODS.map(method => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={cn(
                        "block text-xs font-medium mb-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Términos de Pago
                      </label>
                      <select
                        value={formData.payment_terms}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-sm",
                          theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
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
              "max-w-6xl mx-auto rounded-2xl border overflow-hidden",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className={cn(
                "border-b p-6 flex items-center justify-between",
                theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
              )}>
                <h3 className={cn(
                  "text-lg font-bold flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <Package className="w-5 h-5" />
                  ITEMS DE LA ORDEN
                </h3>
                <Button
                  type="button"
                  onClick={addItem}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Item
                </Button>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
                  )}>
                    <tr>
                      <th className={cn(
                        "px-6 py-4 text-left text-xs font-bold uppercase tracking-wide",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Descripción
                      </th>
                      <th className={cn(
                        "px-6 py-4 text-center text-xs font-bold uppercase tracking-wide",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Cantidad
                      </th>
                      <th className={cn(
                        "px-6 py-4 text-right text-xs font-bold uppercase tracking-wide",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Precio Unitario
                      </th>
                      <th className={cn(
                        "px-6 py-4 text-right text-xs font-bold uppercase tracking-wide",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Total
                      </th>
                      <th className={cn(
                        "px-6 py-4 text-center text-xs font-bold uppercase tracking-wide",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className={cn(
                    theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                  )}>
                    {formData.items.map((item, index) => (
                      <tr key={index} className={cn(
                        "divide-x",
                        theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                      )}>
                        <td className="px-6 py-4">
                          <select
                            value={item.size}
                            onChange={(e) => updateItem(index, 'size', e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 rounded-lg border text-sm font-medium",
                              theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                            )}
                          >
                            <option value="">Seleccionar...</option>
                            {BOX_SIZES.map(size => (
                              <option key={size} value={size}>Caja {size.charAt(0).toUpperCase() + size.slice(1)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className={cn(
                              "text-center font-medium",
                              theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                            )}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <span className={cn(
                              "mr-2 text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              $
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className={cn(
                                "text-right font-medium",
                                theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                              )}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "font-bold text-lg",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {formData.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className={cn(
                                "text-red-500 hover:text-red-700 hover:bg-red-50",
                                theme === 'dark' ? "hover:bg-red-900/20" : ""
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes Section */}
            <div className={cn(
              "max-w-6xl mx-auto rounded-2xl border overflow-hidden",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className={cn(
                "border-b p-6",
                theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
              )}>
                <h3 className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Notas Adicionales
                </h3>
              </div>
              <div className="p-6">
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  placeholder="Notas o comentarios adicionales sobre esta orden de compra..."
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border resize-none",
                    theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                  )}
                />
              </div>
            </div>

            {/* Summary Section */}
            <div className={cn(
              "max-w-6xl mx-auto rounded-2xl border overflow-hidden",
              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="grid grid-cols-1 lg:grid-cols-3">
                <div className={cn(
                  "lg:col-span-2 p-6 border-b lg:border-b-0 lg:border-r",
                  theme === 'dark' ? "border-gray-700 bg-gray-800/30" : "border-gray-200 bg-gray-50"
                )}>
                  <h3 className={cn(
                    "text-lg font-bold mb-4",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Términos y Condiciones
                  </h3>
                  <div className={cn(
                    "text-sm space-y-2",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    <p>• Los precios están sujetos a cambios sin previo aviso.</p>
                    <p>• El pago se realizará según los términos acordados.</p>
                    <p>• La entrega se realizará en la fecha especificada o antes.</p>
                    <p>• Cualquier reclamación deberá realizarse dentro de los 30 días posteriores a la recepción.</p>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className={cn(
                    "text-lg font-bold mb-6 flex items-center gap-2",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <DollarSign className="w-5 h-5" />
                    Resumen
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Subtotal:
                      </span>
                      <span className={cn(
                        "font-medium text-base",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        ${calculateSubtotal().toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        IVA (16%):
                      </span>
                      <span className={cn(
                        "font-medium text-base",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        ${calculateTax().toFixed(2)}
                      </span>
                    </div>

                    <div className={cn(
                      "border-t pt-4 mt-4",
                      theme === 'dark' ? "border-gray-700" : "border-gray-200"
                    )}>
                      <div className="flex justify-between items-center">
                        <span className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Total:
                        </span>
                        <span className={cn(
                          "text-2xl font-bold text-blue-600",
                          theme === 'dark' ? "text-blue-400" : "text-blue-600"
                        )}>
                          ${calculateGrandTotal().toFixed(2)}
                        </span>
                      </div>
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