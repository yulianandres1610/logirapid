'use client'

import { useEffect, useState, useRef } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { Plus, Printer, User, Warehouse, Package } from 'lucide-react'
import { generateEmpaqueLabel } from '@/components/EmpaqueLabel'
import { useAuth } from '@/hooks/useAuth'

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

interface WarehouseOption {
  id: number
  name: string
  city: string
  cajas_vacias_capacity: number
  cajas_vacias_count: number
}

interface CreateCajasModalGlobalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateCajasModalGlobal({ onClose, onSuccess }: CreateCajasModalGlobalProps) {
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [labelSettings, setLabelSettings] = useState<LabelSetting[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false)
  const [loadingWarehouses, setLoadingWarehouses] = useState(true)
  const [loadingCapacity, setLoadingCapacity] = useState(false)
  const [currentCajasCount, setCurrentCajasCount] = useState(0)

  const [formData, setFormData] = useState({
    warehouseId: '',
    quantity: 1,
    packageSizeId: '',
    supplierId: '',
    labelSettingId: '',
    newSupplierName: ''
  })

  const [createdCajas, setCreatedCajas] = useState<any[]>([])

  // Ref para el contenedor del formulario
  const formContainerRef = useRef<HTMLDivElement>(null)

  // Obtener warehouse seleccionado
  const selectedWarehouse = warehouses.find(w => w.id === parseInt(formData.warehouseId))

  // Calcular si excede la capacidad
  const maxCapacity = selectedWarehouse?.cajas_vacias_capacity || 0
  const availableSpace = maxCapacity - currentCajasCount
  const exceedsCapacity = formData.quantity > availableSpace && formData.warehouseId !== ''

  // Scroll al inicio cuando se abre el modal
  useEffect(() => {
    if (formContainerRef.current) {
      formContainerRef.current.scrollTop = 0
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  // Cargar capacidad cuando cambia el warehouse
  useEffect(() => {
    if (formData.warehouseId) {
      loadCurrentCapacity()
    } else {
      setCurrentCajasCount(0)
    }
  }, [formData.warehouseId])

  const fetchData = async () => {
    try {
      // Fetch warehouses
      setLoadingWarehouses(true)
      const warehousesRes = await fetch('/api/warehouses?limit=1000')
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json()
        setWarehouses(warehousesData.data || [])
      }

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
    } finally {
      setLoadingWarehouses(false)
      setInitialLoading(false)
    }
  }

  const loadCurrentCapacity = async () => {
    if (!formData.warehouseId) return

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
      const response = await fetch(`/api/empaques?warehouseId=${formData.warehouseId}&tipo=caja`)
      if (response.ok) {
        const data = await response.json()
        return data.pagination?.total || data.empaques?.length || 0
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
    if (!formData.warehouseId) {
      showNotification('error', 'Error', 'Seleccione un almacén')
      return
    }

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
          warehouseId: parseInt(formData.warehouseId),
          warehouseName: selectedWarehouse?.name,
          warehouseCity: selectedWarehouse?.city || selectedWarehouse?.name,
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
          `Se crearon ${data.count} caja${data.count !== 1 ? 's' : ''} exitosamente en ${selectedWarehouse?.name}`
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

  const handlePrint = async (cajas: any[]) => {
    try {
      // Obtener company ID del usuario autenticado con conversión
      let companyId = user?.companyId || '1'
      if (companyId.startsWith('company-')) {
        companyId = companyId.replace('company-', '')
      }

      // Fetch company data
      const companyResponse = await fetch(`/api/companies/${companyId}`)
      if (!companyResponse.ok) {
        throw new Error('No se pudo obtener la información de la empresa')
      }
      const companyData = await companyResponse.json()
      const company = {
        legalName: companyData.data.legalName,
        logo: companyData.data.logo || companyData.data.logoUrl,
        primaryColor: companyData.data.primaryColor,
        phone: companyData.data.phone || '',
        customerServicePhone: companyData.data.customerServicePhone || ''
      }

      // Fetch warehouse data (mismo almacén para creación e impresión)
      const warehouseResponse = await fetch(`/api/warehouses/${formData.warehouseId}`)
      if (!warehouseResponse.ok) {
        throw new Error('No se pudo obtener la información del almacén')
      }
      const warehouseData = await warehouseResponse.json()
      const warehouse = {
        id: warehouseData.id,
        name: warehouseData.name,
        code: warehouseData.code,
        city: warehouseData.city,
        address: warehouseData.address
      }

      // Fecha de impresión
      const fechaImpresion = new Date()

      // Generar etiquetas usando el template profesional
      const labelsHTML = cajas.map(caja => {
        return generateEmpaqueLabel({
          empaque: {
            id: caja.id,
            codigo: caja.codigo,
            warehouse_id: parseInt(formData.warehouseId),
            warehouse_name: selectedWarehouse?.name || warehouse.name,
            created_at: caja.created_at || new Date().toISOString(),
            package_size_name: packageSizes.find(ps => ps.id === parseInt(formData.packageSizeId))?.name,
            estado: 'disponible'
          },
          warehouseCreacion: warehouse,
          warehouseImpresion: warehouse,
          company: company,
          fechaImpresion: fechaImpresion
        })
      }).join('\n')

      // Abrir ventana de impresión con todas las etiquetas
      const printWindow = window.open('', '_blank', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(labelsHTML)
        printWindow.document.close()

        // Cerrar el modal después de abrir la ventana de impresión
        setTimeout(() => {
          onSuccess()
        }, 500)
      } else {
        showNotification('error', 'Error', 'No se pudo abrir la ventana de impresión. Verifica los bloqueadores de ventanas emergentes.')
      }
    } catch (error) {
      console.error('Error al generar etiquetas:', error)
      showNotification('error', 'Error', 'No se pudieron generar las etiquetas de impresión')
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
                  Gestión global de empaques
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
          {initialLoading ? (
            /* Loading State */
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="h-8 w-8 text-blue-600 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  Cargando datos...
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Preparando el formulario de creación
                </p>
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            {/* Selector de Almacén */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Almacén de Destino *
              </label>
              <select
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading || loadingWarehouses}
              >
                <option value="">Seleccionar almacén</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} - {warehouse.city}
                    {warehouse.cajas_vacias_capacity > 0 && ` (${warehouse.cajas_vacias_count || 0}/${warehouse.cajas_vacias_capacity})`}
                  </option>
                ))}
              </select>
              {formData.warehouseId && selectedWarehouse && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Capacidad: {currentCajasCount}/{maxCapacity} cajas
                  {availableSpace > 0 && (
                    <span className="ml-2 text-green-600 dark:text-green-400 font-medium">
                      • {availableSpace} disponible{availableSpace !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}
            </div>

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
                  disabled={loading || loadingCapacity || !formData.warehouseId}
                />
                {!loadingCapacity && formData.warehouseId && (
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
              {!exceedsCapacity && !loadingCapacity && formData.warehouseId && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {formData.quantity > 0
                    ? `Se generarán ${formData.quantity} código${formData.quantity !== 1 ? 's' : ''} único${formData.quantity !== 1 ? 's' : ''}`
                    : 'Ingrese la cantidad de cajas'}
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
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading || initialLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              disabled={loading || initialLoading || exceedsCapacity || !formData.warehouseId}
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
              disabled={loading || initialLoading || exceedsCapacity || !formData.warehouseId}
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
