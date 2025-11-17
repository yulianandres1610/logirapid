'use client'

import { useEffect, useState, useRef } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { Plus, Printer, User } from 'lucide-react'

interface PackageSize {
  id: number
  name: string
  dimensions: string
  weight: number
  price: number
}

interface Supplier {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
}

interface LabelSetting {
  id: number
  name: string
  label_type: string
  size: string
  custom_width: number
  custom_height: number
  show_logo: boolean
  show_barcode: boolean
  show_qr: boolean
  font_size: string
}

interface CreateCajasModalProps {
  warehouse: any
  onClose: () => void
  onSuccess: () => void
}

export default function CreateCajasModal({ warehouse, onClose, onSuccess }: CreateCajasModalProps) {
  const { showNotification } = useNotifications()
  const [loading, setLoading] = useState(false)
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [labelSettings, setLabelSettings] = useState<LabelSetting[]>([])
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false)
  const [currentCajasCount, setCurrentCajasCount] = useState(0)
  const [loadingCapacity, setLoadingCapacity] = useState(true)

  const [formData, setFormData] = useState({
    quantity: 1,
    packageSizeId: '',
    supplierId: '',
    labelSettingId: '',
    newSupplierName: ''
  })

  const [createdCajas, setCreatedCajas] = useState<any[]>([])

  // Ref para el contenedor del formulario
  const formContainerRef = useRef<HTMLDivElement>(null)

  // Calcular si excede la capacidad
  const maxCapacity = warehouse.cajas_vacias_capacity || 0
  const availableSpace = maxCapacity - currentCajasCount
  const exceedsCapacity = formData.quantity > availableSpace

  // Scroll al inicio cuando se abre el modal
  useEffect(() => {
    if (formContainerRef.current) {
      formContainerRef.current.scrollTop = 0
    }
  }, [])

  useEffect(() => {
    fetchData()
    loadCurrentCapacity()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch package sizes
      const sizesRes = await fetch('/api/package-sizes')
      if (sizesRes.ok) {
        const sizesData = await sizesRes.json()
        setPackageSizes(sizesData.data || [])
      }

      // Fetch suppliers
      const suppliersRes = await fetch('/api/suppliers')
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json()
        setSuppliers(suppliersData.suppliers || [])
      }

      // Fetch label settings
      const labelsRes = await fetch('/api/label-settings')
      if (labelsRes.ok) {
        const labelsData = await labelsRes.json()
        const settings = labelsData.labelSettings || []
        setLabelSettings(settings)
        // Seleccionar el primero por defecto
        if (settings.length > 0) {
          setFormData(prev => ({ ...prev, labelSettingId: settings[0].id.toString() }))
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los datos')
    }
  }

  const loadCurrentCapacity = async () => {
    try {
      setLoadingCapacity(true)
      const count = await getCurrentCajasCount()
      setCurrentCajasCount(count)
    } catch (error) {
      console.error('Error loading current capacity:', error)
    } finally {
      setLoadingCapacity(false)
    }
  }

  const getCurrentCajasCount = async () => {
    try {
      const response = await fetch(`/api/empaques?warehouseId=${warehouse.id}&tipo=caja`)
      if (response.ok) {
        const data = await response.json()
        return data.empaques?.length || 0
      }
      return 0
    } catch (error) {
      console.error('Error fetching current cajas count:', error)
      return 0
    }
  }

  const handleCreateSupplier = async () => {
    if (!formData.newSupplierName.trim()) {
      showNotification('error', 'Error', 'Ingrese el nombre del proveedor')
      return
    }

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.newSupplierName.trim()
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuppliers([...suppliers, data.supplier])
        setFormData(prev => ({
          ...prev,
          supplierId: data.supplier.id.toString(),
          newSupplierName: ''
        }))
        setShowNewSupplierForm(false)
        showNotification('success', 'Proveedor Creado', `Proveedor ${data.supplier.name} creado exitosamente`)
      } else {
        showNotification('error', 'Error', data.error || 'No se pudo crear el proveedor')
      }
    } catch (error) {
      console.error('Error creating supplier:', error)
      showNotification('error', 'Error', 'Ocurrió un error al crear el proveedor')
    }
  }

  const handleCreate = async (printAfter: boolean = false) => {
    // Validaciones básicas
    if (!formData.quantity || formData.quantity < 1) {
      showNotification('error', 'Error', 'La cantidad debe ser mayor a 0')
      return
    }

    if (!formData.packageSizeId) {
      showNotification('error', 'Error', 'Seleccione un tamaño de empaque')
      return
    }

    if (!formData.supplierId) {
      showNotification('error', 'Error', 'Seleccione un proveedor')
      return
    }

    // Verificación de seguridad adicional (ya se valida en tiempo real pero por seguridad)
    if (exceedsCapacity) {
      showNotification(
        'error',
        'Capacidad Excedida',
        `No se puede crear esta cantidad. Excede el límite de capacidad del almacén.`
      )
      return
    }

    try {
      setLoading(true)

      const selectedSupplier = suppliers.find(s => s.id === parseInt(formData.supplierId))

      const response = await fetch('/api/empaques/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: formData.quantity,
          packageSizeId: parseInt(formData.packageSizeId),
          supplierId: parseInt(formData.supplierId),
          supplierName: selectedSupplier?.name,
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          warehouseCity: warehouse.city || warehouse.name,
          usuarioId: 1, // TODO: Get from auth
          usuarioNombre: 'Admin', // TODO: Get from auth
          labelSettingId: formData.labelSettingId ? parseInt(formData.labelSettingId) : null
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setCreatedCajas(data.empaques)
        showNotification(
          'success',
          'Cajas Creadas',
          `Se crearon ${data.count} caja${data.count !== 1 ? 's' : ''} exitosamente`
        )

        if (printAfter) {
          // Abrir ventana de impresión
          handlePrint(data.empaques)
        } else {
          // Cerrar y actualizar
          setTimeout(() => {
            onSuccess()
          }, 1000)
        }
      } else {
        showNotification('error', 'Error', data.error || 'No se pudieron crear las cajas')
      }
    } catch (error) {
      console.error('Error creating cajas:', error)
      showNotification('error', 'Error', 'Ocurrió un error al crear las cajas')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = (cajas: any[]) => {
    const selectedLabelSetting = labelSettings.find(l => l.id === parseInt(formData.labelSettingId))

    // Debug: Verificar configuración
    console.log('🏷️ Label Setting:', selectedLabelSetting)
    console.log('📊 Show Barcode:', selectedLabelSetting?.show_barcode)

    // Obtener fecha y hora actual
    const now = new Date()
    const fechaImpresion = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    const horaImpresion = now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    // Construir HTML para impresión
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas de Cajas - ${cajas.length} etiquetas</title>
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          @media print {
            @page {
              size: ${selectedLabelSetting?.size || '4x6'};
              margin: 0.25in;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .label {
              page-break-after: always;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
              border: 2px solid #000;
              padding: 15px;
            }
            .label:last-child {
              page-break-after: auto;
            }
            .logo-container {
              width: 100%;
              height: 60px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 10px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 10px;
            }
            .logo-text {
              font-size: 24px;
              font-weight: bold;
              color: #cc0a46;
            }
            .code {
              font-size: ${selectedLabelSetting?.font_size === 'large' ? '28px' : selectedLabelSetting?.font_size === 'medium' ? '22px' : '18px'};
              font-weight: bold;
              margin: 12px 0;
              text-align: center;
              word-break: break-all;
            }
            .barcode {
              font-family: 'Libre Barcode 128', monospace;
              font-size: 52px;
              margin: 8px 0;
              letter-spacing: 0;
            }
            .info-section {
              width: 100%;
              margin-top: 10px;
              border-top: 1px solid #ccc;
              padding-top: 10px;
            }
            .info-item {
              font-size: 11px;
              margin: 4px 0;
              text-align: center;
            }
            .info-label {
              font-weight: bold;
              display: inline-block;
              min-width: 80px;
            }
            .size-text {
              font-size: 14px;
              font-weight: bold;
              margin: 8px 0;
              text-align: center;
            }
            .no-print { display: none; }
          }

          @media screen {
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background: #f5f5f5;
            }
            .label {
              border: 2px solid #000;
              padding: 20px;
              margin: 20px auto;
              max-width: 400px;
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .logo-container {
              width: 100%;
              height: 60px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 15px;
              border-bottom: 2px solid #ccc;
              padding-bottom: 15px;
            }
            .logo-text {
              font-size: 24px;
              font-weight: bold;
              color: #cc0a46;
            }
            .code {
              font-size: ${selectedLabelSetting?.font_size === 'large' ? '28px' : selectedLabelSetting?.font_size === 'medium' ? '22px' : '18px'};
              font-weight: bold;
              margin: 15px 0;
              text-align: center;
              word-break: break-all;
              padding: 10px;
              background: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            .barcode {
              font-family: 'Libre Barcode 128', monospace;
              font-size: 52px;
              margin: 10px 0;
              text-align: center;
              letter-spacing: 0;
            }
            .info-section {
              width: 100%;
              margin-top: 15px;
              border-top: 2px solid #ccc;
              padding-top: 15px;
            }
            .info-item {
              font-size: 12px;
              margin: 6px 0;
              text-align: center;
            }
            .info-label {
              font-weight: bold;
              display: inline-block;
              min-width: 100px;
            }
            .size-text {
              font-size: 16px;
              font-weight: bold;
              margin: 10px 0;
              text-align: center;
              color: #333;
            }
            .button-container {
              text-align: center;
              margin: 20px 0;
              padding: 20px;
              border-top: 2px solid #ccc;
              background: white;
            }
            button {
              padding: 12px 24px;
              font-size: 16px;
              cursor: pointer;
              border: none;
              border-radius: 5px;
              margin: 0 10px;
            }
            .btn-print {
              background: #2563eb;
              color: white;
            }
            .btn-print:hover {
              background: #1d4ed8;
            }
            .btn-close {
              background: #6b7280;
              color: white;
            }
            .btn-close:hover {
              background: #4b5563;
            }
          }
        </style>
      </head>
      <body>
        <div class="button-container no-print">
          <h2>Etiquetas Generadas: ${cajas.length}</h2>
          <button class="btn-print" onclick="window.print()">Imprimir Etiquetas</button>
          <button class="btn-close" onclick="window.close()">Cerrar</button>
        </div>
        ${cajas.map(caja => `
          <div class="label">
            ${selectedLabelSetting?.show_logo ? `
              <div class="logo-container">
                <div class="logo-text">LOGIRAPID</div>
              </div>
            ` : ''}

            <div class="code">${caja.codigo}</div>

            ${selectedLabelSetting?.show_barcode ? `
              <div class="barcode">${caja.codigo}</div>
            ` : ''}

            <div class="size-text">${packageSizes.find(ps => ps.id === parseInt(formData.packageSizeId))?.name || 'N/A'}</div>

            <div class="info-section">
              <div class="info-item">
                <span class="info-label">Fecha:</span>
                <span>${fechaImpresion} ${horaImpresion}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Creado en:</span>
                <span>${warehouse.name}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Impreso en:</span>
                <span>${warehouse.name}</span>
              </div>
            </div>
          </div>
        `).join('')}
        <div class="button-container no-print">
          <button class="btn-print" onclick="window.print()">Imprimir Etiquetas</button>
          <button class="btn-close" onclick="window.close()">Cerrar</button>
        </div>

        <script>
          // Auto-print cuando la página carga
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()

      // Llamar a print automáticamente después de que se cargue el contenido
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }

      // Cerrar el modal después de abrir la ventana de impresión
      setTimeout(() => {
        onSuccess()
      }, 500)
    } else {
      showNotification('error', 'Error', 'No se pudo abrir la ventana de impresión. Verifica los bloqueadores de ventanas emergentes.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Crear Cajas Vacías
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {warehouse.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              disabled={loading}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div ref={formContainerRef} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cantidad de Cajas a Crear *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent transition-colors ${
                    exceedsCapacity
                      ? 'border-[#cc0a46] focus:ring-[#cc0a46] focus:border-[#cc0a46]'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  required
                  disabled={loading || loadingCapacity}
                />
                {!loadingCapacity && (
                  <div className="absolute right-16 top-1/2 -translate-y-1/2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {currentCajasCount}/{maxCapacity}
                    </span>
                  </div>
                )}
              </div>

              {/* Mensaje de error cuando excede capacidad */}
              {exceedsCapacity && !loadingCapacity && (
                <div className="mt-2 p-3 bg-[#cc0a46]/10 border border-[#cc0a46] rounded-lg">
                  <p className="text-sm font-semibold text-[#cc0a46] flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    No se puede crear esta cantidad. Excede el límite de capacidad.
                  </p>
                  <p className="text-xs text-[#cc0a46] mt-1 ml-7">
                    Capacidad disponible: <span className="font-bold">{availableSpace}</span> caja{availableSpace !== 1 ? 's' : ''} de {maxCapacity} totales
                  </p>
                </div>
              )}

              {/* Mensaje informativo normal */}
              {!exceedsCapacity && !loadingCapacity && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {formData.quantity > 0
                    ? `Se generarán ${formData.quantity} código${formData.quantity !== 1 ? 's' : ''} único${formData.quantity !== 1 ? 's' : ''}`
                    : 'Ingrese la cantidad de cajas'}
                  {availableSpace > 0 && (
                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                      • {availableSpace} disponible{availableSpace !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}

              {/* Loading de capacidad */}
              {loadingCapacity && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verificando capacidad...
                </p>
              )}
            </div>

            {/* Tamaño de Empaque */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tamaño de Empaque *
              </label>
              <select
                value={formData.packageSizeId}
                onChange={(e) => setFormData({ ...formData, packageSizeId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              >
                <option value="">Seleccionar tamaño</option>
                {packageSizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name} - {size.dimensions} - ${size.price}
                  </option>
                ))}
              </select>
            </div>

            {/* Proveedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proveedor *
              </label>
              {!showNewSupplierForm ? (
                <div className="flex gap-2">
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={loading}
                  >
                    <option value="">Seleccionar proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewSupplierForm(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    disabled={loading}
                  >
                    <User className="h-4 w-4" />
                    Nuevo
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <input
                    type="text"
                    value={formData.newSupplierName}
                    onChange={(e) => setFormData({ ...formData, newSupplierName: e.target.value })}
                    placeholder="Nombre del proveedor"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateSupplier}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      disabled={loading}
                    >
                      Crear Proveedor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewSupplierForm(false)
                        setFormData(prev => ({ ...prev, newSupplierName: '' }))
                      }}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Formato de Etiqueta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Formato de Impresión de Etiqueta *
              </label>
              <select
                value={formData.labelSettingId}
                onChange={(e) => setFormData({ ...formData, labelSettingId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              >
                <option value="">Seleccionar formato</option>
                {labelSettings.map((setting) => (
                  <option key={setting.id} value={setting.id}>
                    {setting.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              disabled={loading || exceedsCapacity}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleCreate(true)}
              disabled={loading || exceedsCapacity}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Crear e Imprimir
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
