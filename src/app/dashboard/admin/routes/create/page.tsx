'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Truck,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Package,
  Warehouse,
  Calendar,
  Zap,
  QrCode,
  UserX,
  Save,
  Printer,
  FileText,
  PartyPopper,
  MessageSquare,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import RouteMap from '@/components/maps/RouteMap'
import { QRCodeSVG } from 'qrcode.react'
import { useReactToPrint } from 'react-to-print'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface TimeWindow {
  id: string
  label: string
  value: string
  startTime: string
  endTime: string
}

const TIME_WINDOWS: TimeWindow[] = [
  { id: 'morning', label: 'Mañana', value: '8-12', startTime: '08:00', endTime: '12:00' },
  { id: 'afternoon', label: 'Tarde', value: '12-16', startTime: '12:00', endTime: '16:00' },
  { id: 'evening', label: 'Noche', value: '16-20', startTime: '16:00', endTime: '20:00' }
]

const STEPS = [
  { id: 1, title: 'Órdenes y Horarios', icon: Package },
  { id: 2, title: 'Configuración', icon: Truck },
  { id: 3, title: 'Confirmación', icon: CheckCircle },
  { id: 4, title: 'Éxito', icon: PartyPopper }
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateRoutePage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  // ============================================================================
  // STATE
  // ============================================================================
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

  // Data from API
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [packageOrders, setPackageOrders] = useState<any[]>([])

  // Form data
  const [selectedOrders, setSelectedOrders] = useState<number[]>([])
  const [selectedTimeWindows, setSelectedTimeWindows] = useState<string[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('') // Opcional
  const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // Optimization result
  const [optimizationResult, setOptimizationResult] = useState<any>(null)

  // Created route data (for step 4)
  const [createdRoute, setCreatedRoute] = useState<any>(null)

  // Ref para evitar múltiples ejecuciones de optimización
  const hasOptimizedRef = useRef(false)

  // Refs para impresión
  const qrPrintRef = useRef<HTMLDivElement>(null)
  const routePrintRef = useRef<HTMLDivElement>(null)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    loadInitialData()
  }, [])

  // Auto-optimizar cuando se llega al paso 3
  useEffect(() => {
    if (currentStep === 3 && !optimizationResult && !optimizing && !hasOptimizedRef.current) {
      console.log('📍 Llegando a paso 3, iniciando optimización automática...')
      hasOptimizedRef.current = true
      handleOptimizeRoute()
    }

    // Resetear el flag cuando se sale del paso 3
    if (currentStep !== 3) {
      hasOptimizedRef.current = false
    }
  }, [currentStep, optimizationResult, optimizing])

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadInitialData = async () => {
    try {
      setLoading(true)

      const [warehousesRes, vehiclesRes, driversRes, ordersRes1, ordersRes2] = await Promise.all([
        fetch('/api/warehouses?limit=1000'),
        fetch('/api/vehicles?limit=1000'),
        fetch('/api/users?role=driver&limit=1000'),
        fetch('/api/package-orders?status=pending&limit=1000'),
        fetch('/api/package-orders?status=reprogrammed&limit=1000')
      ])

      const [warehousesData, vehiclesData, driversData, orders1, orders2] = await Promise.all([
        warehousesRes.json(),
        vehiclesRes.json(),
        driversRes.json(),
        ordersRes1.json(),
        ordersRes2.json()
      ])

      // Manejar formato de respuesta {data: array} o array directo
      const warehousesList = warehousesData.data || warehousesData || []
      const vehiclesList = vehiclesData.data || vehiclesData || []
      const driversList = driversData.data || driversData || []

      setWarehouses(Array.isArray(warehousesList) ? warehousesList : [])
      setVehicles(Array.isArray(vehiclesList) ? vehiclesList : [])
      setDrivers(Array.isArray(driversList) ? driversList : [])

      // Combinar pending + reprogrammed - Manejar formato {data: array}
      const pendingOrders = orders1.data || orders1 || []
      const reprogrammedOrders = orders2.data || orders2 || []
      const allOrders = [...pendingOrders, ...reprogrammedOrders]

      console.log('🔍 [Debug] Órdenes cargadas:', {
        pending: pendingOrders.length,
        reprogrammed: reprogrammedOrders.length,
        total: allOrders.length,
        primeraOrden: allOrders[0] ? {
          id: allOrders[0].id,
          orderNumber: allOrders[0].orderNumber,
          status: allOrders[0].status,
          hasCoords: !!(allOrders[0].latitude && allOrders[0].longitude)
        } : null
      })

      // Filtrar solo órdenes con coordenadas válidas
      const validOrders = allOrders.filter(order =>
        order.latitude &&
        order.longitude &&
        order.latitude !== 0 &&
        order.longitude !== 0
      )

      console.log('✅ [Debug] Órdenes válidas (con coordenadas):', validOrders.length)
      console.log('📋 [Debug] Ejemplo de orden válida:', validOrders[0] ? {
        id: validOrders[0].id,
        orderNumber: validOrders[0].orderNumber,
        customer: validOrders[0].customerName,
        status: validOrders[0].status,
        timeSlot: validOrders[0].timeSlot
      } : 'No hay órdenes válidas')

      setPackageOrders(validOrders)

      // Auto-select first warehouse if available
      if (warehousesList.length > 0) {
        setWarehouseId(warehousesList[0].id.toString())
      }

    } catch (error) {
      console.error('Error loading data:', error)
      showNotification('error', 'Error', 'No se pudo cargar los datos iniciales')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // ORDER SELECTION BY TIME WINDOW
  // ============================================================================

  const getOrdersByTimeWindow = (timeWindowValue: string) => {
    const window = TIME_WINDOWS.find(w => w.value === timeWindowValue)
    if (!window) return []

    console.log(`🔍 Filtrando órdenes para horario ${timeWindowValue}:`, {
      totalOrdenes: packageOrders.length,
      timeWindowValue
    })

    // Mapeo de diferentes formatos de timeSlot
    const timeSlotMatches = (orderTimeSlot: string, targetWindow: string) => {
      if (!orderTimeSlot) return true // Sin timeSlot = incluir en todos

      const slot = orderTimeSlot.toLowerCase()

      // Mapeo directo
      if (slot === targetWindow) return true

      // Mapeo de nombres a rangos
      const mappings: Record<string, string[]> = {
        '8-12': ['morning', 'mañana', '8:00 am - 12:00 pm'],
        '12-16': ['afternoon', 'tarde', '12:00 pm - 4:00 pm'],
        '16-20': ['evening', 'noche', '4:00 pm - 8:00 pm']
      }

      return mappings[targetWindow]?.some(variant => slot.includes(variant)) || false
    }

    // Ya filtramos por status en loadInitialData, solo filtramos por timeSlot aquí
    const filtered = packageOrders.filter(order => {
      const matches = timeSlotMatches(order.timeSlot, timeWindowValue)
      console.log(`  - Orden ${order.id} timeSlot="${order.timeSlot}" → match con ${timeWindowValue}:`, matches)
      return matches
    })

    console.log(`✅ Resultado filtro ${timeWindowValue}:`, filtered.length, 'órdenes')

    return filtered
  }

  /**
   * Calcula cuántas PARADAS habrá en un horario (agrupando por dirección)
   */
  const getStopsByTimeWindow = (timeWindowValue: string) => {
    const orders = getOrdersByTimeWindow(timeWindowValue)

    // Agrupar por dirección de texto normalizada
    const addressMap = new Map<string, number>()

    orders.forEach(order => {
      // Obtener dirección como string (manejar tanto string como objeto)
      let addressText = ''
      if (typeof order.customerAddress === 'string') {
        addressText = order.customerAddress
      } else if (order.customerAddress?.street) {
        addressText = order.customerAddress.street
      }

      // Normalizar dirección: minúsculas, sin espacios extras, sin puntuación
      const normalizedAddress = addressText
        .toLowerCase()
        .trim()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .replace(/\s+/g, ' ')

      if (!normalizedAddress) return

      if (!addressMap.has(normalizedAddress)) {
        addressMap.set(normalizedAddress, 1)
      }
    })

    return addressMap.size
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const toggleTimeWindow = (value: string) => {
    setSelectedTimeWindows(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value].sort()
    )
  }

  const toggleOrder = (orderId: number) => {
    setSelectedOrders(prev => {
      const isRemoving = prev.includes(orderId)
      const newSelected = isRemoving
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]

      // Actualizar automáticamente los períodos seleccionados
      const newTimeWindows: string[] = []
      TIME_WINDOWS.forEach(window => {
        const ordersInWindow = getOrdersByTimeWindow(window.value)
        const hasSelectedOrders = ordersInWindow.some(o => newSelected.includes(o.id))
        if (hasSelectedOrders) {
          newTimeWindows.push(window.value)
        }
      })
      setSelectedTimeWindows(newTimeWindows.sort())

      return newSelected
    })
  }

  const toggleAllOrdersInTimeWindow = (timeWindow: string) => {
    const ordersInWindow = getOrdersByTimeWindow(timeWindow).map(o => o.id)
    const allSelected = ordersInWindow.every(id => selectedOrders.includes(id))

    if (allSelected) {
      // Deseleccionar todas del periodo
      setSelectedOrders(prev => {
        const newSelected = prev.filter(id => !ordersInWindow.includes(id))

        // Actualizar automáticamente los períodos seleccionados
        const newTimeWindows: string[] = []
        TIME_WINDOWS.forEach(window => {
          const ordersInWindow = getOrdersByTimeWindow(window.value)
          const hasSelectedOrders = ordersInWindow.some(o => newSelected.includes(o.id))
          if (hasSelectedOrders) {
            newTimeWindows.push(window.value)
          }
        })
        setSelectedTimeWindows(newTimeWindows.sort())

        return newSelected
      })
    } else {
      // Seleccionar todas del periodo
      setSelectedOrders(prev => {
        const newSelected = [...new Set([...prev, ...ordersInWindow])]

        // Asegurar que el período esté seleccionado
        setSelectedTimeWindows(prevWindows => {
          if (!prevWindows.includes(timeWindow)) {
            return [...prevWindows, timeWindow].sort()
          }
          return prevWindows
        })

        return newSelected
      })
    }
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (selectedOrders.length === 0) {
        showNotification('warning', 'Advertencia', 'Selecciona al menos una orden')
        return
      }

      // Los periodos se seleccionan automáticamente, validar que haya al menos uno
      if (selectedTimeWindows.length === 0) {
        showNotification('error', 'Error', 'Las órdenes seleccionadas no tienen horarios válidos')
        return
      }

      // Validar que los horarios seleccionados tengan órdenes
      const invalidTimeWindows = selectedTimeWindows.filter(tw => {
        const ordersInWindow = getOrdersByTimeWindow(tw)
        return ordersInWindow.length === 0
      })

      if (invalidTimeWindows.length > 0) {
        showNotification('error', 'Error', 'Hay horarios seleccionados sin órdenes disponibles')
        // Remover horarios sin órdenes
        setSelectedTimeWindows(prev => prev.filter(tw => !invalidTimeWindows.includes(tw)))
        return
      }
    }

    if (currentStep === 2) {
      if (!warehouseId) {
        showNotification('warning', 'Advertencia', 'Selecciona un almacén')
        return
      }
      if (!vehicleId) {
        showNotification('warning', 'Advertencia', 'Selecciona un vehículo')
        return
      }
      // Driver es opcional
    }

    setCurrentStep(prev => Math.min(prev + 1, 3))
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // ============================================================================
  // OPTIMIZATION (MULTI-PERIOD LOGIC)
  // ============================================================================

  const handleOptimizeRoute = async () => {
    try {
      setOptimizing(true)

      console.log('🚀 Iniciando optimización multi-periodo')
      console.log('⏰ Horarios seleccionados:', selectedTimeWindows)

      // CASO 1: Solo un horario → optimización simple
      if (selectedTimeWindows.length === 1) {
        console.log('📍 Caso: Un solo horario')
        await optimizeSinglePeriod(selectedTimeWindows[0])
      }
      // CASO 2: Múltiples horarios → optimizar por separado y unir
      else {
        console.log('📍 Caso: Múltiples horarios → Optimización por periodos')
        await optimizeMultiplePeriods()
      }

    } catch (error) {
      console.error('Error en optimización:', error)
      showNotification('error', 'Error', 'No se pudo optimizar la ruta')
    } finally {
      setOptimizing(false)
    }
  }

  /**
   * Optimización de un solo periodo
   */
  const optimizeSinglePeriod = async (timeWindow: string) => {
    const response = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mechanism: 'automatic',
        selectedOrders,
        warehouseId,
        vehicleId,
        driverId: driverId || undefined,
        date: routeDate,
        timeWindows: [timeWindow],
        notes: notes || `Ruta optimizada - ${selectedOrders.length} órdenes`,
        saveRoute: false // Solo preview
      })
    })

    const data = await response.json()

    console.log('📥 [Frontend] Respuesta de optimización recibida:', data)

    if (data.success && data.data) {
      console.log('✅ [Frontend] Datos de optimización:', {
        hasGeometry: !!data.data.geometry,
        hasCoordinates: !!data.data.coordinates,
        coordinatesCount: data.data.coordinates?.length || 0,
        hasRoute: !!data.data.route,
        stopsCount: data.data.route?.stops?.length || 0,
        distance: data.data.distance,
        duration: data.data.duration
      })

      setOptimizationResult(data.data)
      showNotification('success', 'Optimización Completa',
        `Ruta con ${data.data.totalStops} paradas optimizada correctamente`)
    } else {
      throw new Error(data.error || 'Error en optimización')
    }
  }

  /**
   * Optimización de múltiples periodos y unión
   */
  const optimizeMultiplePeriods = async () => {
    const periodResults: any[] = []

    // PASO 1: Optimizar cada periodo por separado
    for (const timeWindow of selectedTimeWindows) {
      console.log(`🔧 Optimizando periodo: ${timeWindow}`)

      // Filtrar órdenes del periodo
      const ordersInPeriod = getOrdersByTimeWindow(timeWindow)
        .filter(order => selectedOrders.includes(order.id))
        .map(o => o.id)

      if (ordersInPeriod.length === 0) {
        console.log(`⚠️ No hay órdenes en periodo ${timeWindow}, omitiendo...`)
        continue
      }

      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanism: 'automatic',
          selectedOrders: ordersInPeriod,
          warehouseId,
          vehicleId,
          driverId: driverId || undefined,
          date: routeDate,
          timeWindows: [timeWindow],
          notes: `Periodo ${timeWindow}`,
          saveRoute: false
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        periodResults.push({
          timeWindow,
          ...data.data
        })
        console.log(`✅ Periodo ${timeWindow} optimizado: ${data.data.totalStops} paradas`)
      } else {
        console.error(`❌ Error en periodo ${timeWindow}:`, data.error)
      }
    }

    if (periodResults.length === 0) {
      throw new Error('No se pudo optimizar ningún periodo')
    }

    // PASO 2: UNIR rutas de todos los periodos
    console.log('🔗 Uniendo rutas de múltiples periodos...')
    const unifiedRoute = unifyMultiplePeriods(periodResults)

    setOptimizationResult(unifiedRoute)
    showNotification('success', 'Rutas Unificadas',
      `${periodResults.length} periodos optimizados y unidos en 1 ruta continua con ${unifiedRoute.totalStops} paradas`)
  }

  /**
   * Unir múltiples rutas optimizadas en una sola secuencia
   */
  const unifyMultiplePeriods = (periodResults: any[]) => {
    let unifiedStops: any[] = []
    let unifiedCoordinates: [number, number][] = []
    let totalDistance = 0
    let totalDuration = 0
    let totalOrders = 0

    // Extraer coordenadas del almacén
    const warehouseCoords = periodResults[0].warehouseCoordinates

    periodResults.forEach((period, index) => {
      console.log(`🔗 Uniendo periodo ${index + 1}/${periodResults.length}`)

      // Agregar paradas del periodo
      const periodStops = period.stops.map((stop: any, stopIndex: number) => ({
        ...stop,
        sequence: unifiedStops.length + stopIndex + 1,
        period: period.timeWindow,
        periodLabel: TIME_WINDOWS.find(tw => tw.value === period.timeWindow)?.label,
        waypointIndex: unifiedStops.length + stopIndex
      }))

      unifiedStops = [...unifiedStops, ...periodStops]

      // Unir coordenadas de geometría (omitir primer y último punto que son el almacén)
      if (period.coordinates && Array.isArray(period.coordinates)) {
        const coords = period.coordinates

        if (index === 0) {
          // Primer periodo: agregar todas las coordenadas
          unifiedCoordinates = [...coords]
          console.log(`  ✅ Primer periodo: ${coords.length} coordenadas`)
        } else {
          // Periodos siguientes: omitir primer punto (almacén) y agregar el resto
          // Pero mantener el último punto del periodo anterior (almacén) conectado
          const coordsWithoutFirst = coords.slice(1)
          unifiedCoordinates = [...unifiedCoordinates.slice(0, -1), ...coordsWithoutFirst]
          console.log(`  ✅ Periodo ${index + 1}: +${coordsWithoutFirst.length} coordenadas`)
        }
      }

      // Sumar métricas
      totalDistance += parseFloat(period.distance) || 0
      totalDuration += parseInt(period.duration) || 0
      totalOrders += period.totalOrders || 0
    })

    // Construir geometría unificada tipo LineString
    const unifiedGeometry = {
      type: 'LineString' as const,
      coordinates: unifiedCoordinates
    }

    console.log('✅ Ruta multi-periodo unificada:', {
      stops: unifiedStops.length,
      coordinates: unifiedCoordinates.length,
      distance: totalDistance.toFixed(1),
      duration: totalDuration
    })

    return {
      stops: unifiedStops,
      totalStops: unifiedStops.length,
      totalOrders,
      distance: totalDistance.toFixed(1),
      duration: totalDuration.toString(),
      warehouseCoordinates: warehouseCoords,
      geometry: unifiedGeometry,
      coordinates: unifiedCoordinates,
      multiPeriod: true,
      periods: periodResults.length
    }
  }

  // ============================================================================
  // SAVE ROUTE
  // ============================================================================

  const handleSaveRoute = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanism: 'automatic',
          selectedOrders,
          warehouseId,
          vehicleId,
          driverId: driverId || undefined,
          date: routeDate,
          timeWindows: selectedTimeWindows,
          notes: notes || `Ruta optimizada - ${selectedOrders.length} órdenes`,
          saveRoute: true // GUARDAR!
        })
      })

      const data = await response.json()

      if (data.success) {
        // Guardar datos de la ruta creada
        setCreatedRoute({
          routeId: data.routeId,
          routeNumber: data.routeNumber,
          qrCode: data.qrCode,
          mapboxJobId: data.mapboxJobId,
          totalStops: data.totalStops,
          totalOrders: data.totalOrders,
          distance: data.distance,
          duration: data.duration
        })

        showNotification('success', 'Ruta Creada',
          `Ruta ${data.routeNumber} creada exitosamente`)

        // Ir al paso 4 (éxito)
        setCurrentStep(4)
      } else {
        throw new Error(data.error || 'Error al crear ruta')
      }

    } catch (error) {
      console.error('Error saving route:', error)
      showNotification('error', 'Error', 'No se pudo guardar la ruta')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Hook para efecto de conteo animado
  const useCountUp = (end: number, duration: number = 1000) => {
    const [count, setCount] = useState(0)

    useEffect(() => {
      let startTime: number
      let animationFrame: number

      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime
        const progress = Math.min((currentTime - startTime) / duration, 1)

        setCount(Math.floor(progress * end))

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate)
        }
      }

      animationFrame = requestAnimationFrame(animate)

      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame)
        }
      }
    }, [end, duration])

    return count
  }

  const formatDuration = (minutes: number | string): string => {
    const mins = typeof minutes === 'string' ? parseInt(minutes) : minutes
    if (isNaN(mins)) return 'N/A'

    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60

    if (hours === 0) return `${remainingMins} min`
    if (remainingMins === 0) return `${hours} h`
    return `${hours} h ${remainingMins} min`
  }

  // Componente de tarjeta estadística con animación
  interface StatCardProps {
    label: string
    value: number | string
    color: 'blue' | 'green' | 'purple' | 'orange' | 'red'
    suffix?: string
    formatter?: (value: number | string) => string
    useCountUp: (end: number, duration?: number) => number
  }

  const StatCard = ({ label, value, color, suffix = '', formatter, useCountUp }: StatCardProps) => {
    // Convertir valor a número si es string
    const numValue = typeof value === 'string' ? parseInt(value) : value

    // Usar animación de conteo
    const displayValue = useCountUp(numValue, 1000)

    // Aplicar formateador si está definido, sino mostrar el número
    const finalValue = formatter ? formatter(displayValue) : `${displayValue}${suffix}`

    // Mapeo de colores
    const colorClasses = {
      blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
      orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
      red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }

    const textColorClasses = {
      blue: 'text-blue-600 dark:text-blue-400',
      green: 'text-green-600 dark:text-green-400',
      purple: 'text-purple-600 dark:text-purple-400',
      orange: 'text-orange-600 dark:text-orange-400',
      red: 'text-red-600 dark:text-red-400'
    }

    return (
      <div className={`p-4 rounded-lg border ${colorClasses[color]} transition-all duration-300 hover:shadow-md`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${textColorClasses[color]}`}>{finalValue}</p>
      </div>
    )
  }

  // Print handlers
  const handlePrintQR = useReactToPrint({
    contentRef: qrPrintRef,
    documentTitle: `QR-${createdRoute?.routeNumber || 'Ruta'}`
  })

  const handlePrintRoute = useReactToPrint({
    contentRef: routePrintRef,
    documentTitle: `Ruta-${createdRoute?.routeNumber || 'Completa'}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 15mm;
      }
      @media print {
        .page-break {
          page-break-before: always;
        }
        .no-print {
          display: none;
        }
      }
    `
  })

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderStepIndicator = () => (
    <div className="relative px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute left-0 right-0 top-6 h-0.5 bg-gray-200 dark:bg-gray-700" style={{ zIndex: 0 }} />

          {/* Progress line */}
          <div
            className="absolute left-0 top-6 h-0.5 bg-[#2a5caa] transition-all duration-500 ease-out"
            style={{
              width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
              zIndex: 1
            }}
          />

          {STEPS.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center relative" style={{ zIndex: 2 }}>
              {/* Circle */}
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center font-bold text-base transition-all duration-300 relative',
                currentStep === step.id
                  ? 'bg-[#2a5caa] text-white shadow-lg scale-110 animate-pulse-slow'
                  : currentStep > step.id
                  ? 'bg-[#10b981] text-white'
                  : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-400'
              )}>
                {currentStep > step.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.id
                )}

                {/* Ripple effect for active step */}
                {currentStep === step.id && (
                  <span className="absolute inset-0 rounded-full bg-[#2a5caa] animate-ping opacity-25" />
                )}
              </div>

              {/* Label */}
              <span className={cn(
                'mt-3 text-xs font-medium transition-colors text-center',
                currentStep >= step.id
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400'
              )}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse-slow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
          .animate-pulse-slow {
            animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `
      }} />
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">

      {/* Time Windows with Orders Inside */}
      <div className="space-y-4">
        {TIME_WINDOWS.map(window => {
          const ordersInWindow = getOrdersByTimeWindow(window.value)
          const stopsCount = getStopsByTimeWindow(window.value)
          const selectedInWindow = ordersInWindow.filter(o => selectedOrders.includes(o.id)).length
          const allSelectedInWindow = ordersInWindow.length > 0 && ordersInWindow.every(o => selectedOrders.includes(o.id))
          const hasOrders = ordersInWindow.length > 0

          return (
            <div
              key={window.id}
              className={cn(
                'bg-white dark:bg-gray-800 rounded-lg border-2 transition-all overflow-hidden',
                !hasOrders && 'opacity-50',
                selectedInWindow > 0 && hasOrders
                  ? 'border-blue-500 shadow-md'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* Time Window Header */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {window.label}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {window.startTime} - {window.endTime}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Paradas */}
                    <div className={cn(
                      'relative overflow-hidden rounded-lg border shadow px-3 py-2',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    )}>
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'p-1.5 rounded-lg',
                          theme === 'dark'
                            ? 'bg-blue-900/30 border border-blue-800/50'
                            : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                        )}>
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-[10px] font-medium uppercase tracking-wide',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>Paradas</p>
                          <p className={cn(
                            'text-lg font-bold leading-tight',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stopsCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Órdenes */}
                    <div className={cn(
                      'relative overflow-hidden rounded-lg border shadow px-3 py-2',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    )}>
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-green-400 to-emerald-600"></div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'p-1.5 rounded-lg',
                          theme === 'dark'
                            ? 'bg-green-900/30 border border-green-800/50'
                            : 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200'
                        )}>
                          <Package className="w-3.5 h-3.5 text-green-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-[10px] font-medium uppercase tracking-wide',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>Órdenes</p>
                          <p className={cn(
                            'text-lg font-bold leading-tight',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>
                            {selectedInWindow}/{ordersInWindow.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Select All in Period Button */}
                {hasOrders && (
                  <Button
                    onClick={() => toggleAllOrdersInTimeWindow(window.value)}
                    size="sm"
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white border-0 focus:ring-0 focus:outline-none"
                  >
                    {allSelectedInWindow ? 'Deseleccionar' : 'Seleccionar'} todas en este periodo
                  </Button>
                )}
              </div>

              {/* Orders in this Time Window */}
              {ordersInWindow.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-6">
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-3">
                    {ordersInWindow.map(order => (
                      <label
                        key={order.id}
                        className={cn(
                          'flex items-center gap-4 p-5 rounded-lg border-2 cursor-pointer transition-all duration-200',
                          selectedOrders.includes(order.id)
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-[#2a5caa] shadow-lg'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-[#2a5caa] hover:shadow-md'
                        )}
                      >
                        {/* Checkbox */}
                        <div className="flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleOrder(order.id)}
                            className="w-5 h-5 rounded border-gray-300 text-[#2a5caa] focus:ring-[#2a5caa] cursor-pointer"
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white mb-1">
                            {order.orderNumber || `ORD-${order.id}`} - {order.customerName}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <MapPin className="w-4 h-4 flex-shrink-0 text-[#cc0a46]" />
                            <span className="truncate">
                              {typeof order.customerAddress === 'string'
                                ? order.customerAddress
                                : order.customerAddress?.street || 'Dirección no disponible'}
                            </span>
                          </p>
                        </div>

                        {/* Coordinates */}
                        <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400 flex-shrink-0">
                          {order.latitude?.toFixed(4)}, {order.longitude?.toFixed(4)}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* No Orders Message */}
              {!hasOrders && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    No hay órdenes pendientes o reprogramadas para este horario
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Multi-period Info */}
      {selectedTimeWindows.length > 1 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Multi-periodo:</strong> Se crearán {selectedTimeWindows.length} rutas optimizadas individualmente
            y se unirán en secuencia para formar una ruta continua.
          </p>
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total seleccionado:
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {selectedOrders.length} órdenes en {selectedTimeWindows.length} periodo(s)
          </p>
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5">
      {/* Warehouse */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border shadow-lg p-5',
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
          : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
      )}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
        <label className={cn(
          'block text-sm font-semibold mb-3 flex items-center gap-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 dark:bg-purple-900/30 dark:border-purple-800/50">
            <Warehouse className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          Almacén de Salida *
        </label>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className={cn(
            'w-full px-4 py-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="">Seleccionar almacén...</option>
          {warehouses.map(wh => (
            <option key={wh.id} value={wh.id}>
              {wh.name} - {wh.address}
            </option>
          ))}
        </select>
      </div>

      {/* Vehicle */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border shadow-lg p-5',
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
          : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
      )}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
        <label className={cn(
          'block text-sm font-semibold mb-3 flex items-center gap-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          Vehículo *
        </label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className={cn(
            'w-full px-4 py-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="">Seleccionar vehículo...</option>
          {vehicles.map(v => {
            const capacityText = typeof v.capacity === 'object' && v.capacity?.weight_kg
              ? `${v.capacity.weight_kg} kg`
              : typeof v.capacity === 'number'
              ? `${v.capacity} kg`
              : 'Capacidad no especificada'

            return (
              <option key={v.id} value={v.id}>
                {v.licensePlate} - {v.model} ({capacityText})
              </option>
            )
          })}
        </select>
      </div>

      {/* Driver (Optional) */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border shadow-lg p-5',
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
          : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
      )}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
        <label className={cn(
          'block text-sm font-semibold mb-3 flex items-center gap-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          <div className={cn(
            'p-2 rounded-lg border',
            driverId
              ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200 dark:bg-green-900/30 dark:border-green-800/50'
              : 'bg-gray-100 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
          )}>
            {driverId ? <Users className="w-5 h-5 text-green-600 dark:text-green-400" /> : <UserX className="w-5 h-5 text-gray-400" />}
          </div>
          Conductor <span className="text-xs font-normal text-gray-500">(Opcional - Asignable después con QR)</span>
        </label>
        <select
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className={cn(
            'w-full px-4 py-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="">Sin asignar (usar QR después)</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>
              {d.name} {d.lastName}
            </option>
          ))}
        </select>

        {!driverId && (
          <div className={cn(
            'mt-3 p-3 rounded-lg flex items-start gap-2',
            theme === 'dark' ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-blue-50 border border-blue-200'
          )}>
            <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Se generará un código QR para que el conductor se auto-asigne escaneándolo desde su dispositivo móvil
            </p>
          </div>
        )}
      </div>

      {/* Date */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border shadow-lg p-5',
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
          : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
      )}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600"></div>
        <label className={cn(
          'block text-sm font-semibold mb-3 flex items-center gap-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 dark:bg-orange-900/30 dark:border-orange-800/50">
            <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          Fecha de Ruta
        </label>
        <input
          type="date"
          value={routeDate}
          onChange={(e) => setRouteDate(e.target.value)}
          className={cn(
            'w-full px-4 py-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-orange-500',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        />
      </div>

      {/* Notes */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border shadow-lg p-5',
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
          : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
      )}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-400 to-gray-600"></div>
        <label className={cn(
          'block text-sm font-semibold mb-3 flex items-center gap-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          <div className="p-2 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
            <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          Notas Adicionales
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Instrucciones especiales, restricciones, etc..."
          className={cn(
            'w-full px-4 py-3 border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-gray-500',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          )}
        />
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Progress Bar de Optimización */}
      {!optimizationResult && optimizing && (
        <div className="bg-[#2a5caa] rounded-lg p-8 text-white shadow-lg">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Zap className="w-10 h-10 animate-pulse" />
              <h3 className="text-2xl font-bold">Optimizando Ruta con Mapbox</h3>
            </div>
            <p className="text-blue-100 text-base">
              {selectedTimeWindows.length === 1
                ? 'Calculando la mejor ruta para el periodo seleccionado...'
                : `Optimizando ${selectedTimeWindows.length} periodos y uniéndolos en secuencia...`
              }
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-3 bg-blue-900/50 rounded-full overflow-hidden mb-4">
            <div
              className="absolute inset-0 bg-white rounded-full"
              style={{
                animation: 'progressMove 2s ease-in-out infinite',
              }}
            />
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes progressMove {
                0% { width: 30%; }
                50% { width: 70%; }
                100% { width: 30%; }
              }
            `
          }} />

          <p className="text-center text-blue-100 text-sm flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            Procesando con algoritmos de optimización...
          </p>
        </div>
      )}

      {/* Optimization Result */}
      {optimizationResult && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Resultado de Optimización
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <StatCard
                label="Paradas"
                value={optimizationResult.totalStops}
                color="blue"
                useCountUp={useCountUp}
              />
              <StatCard
                label="Órdenes"
                value={optimizationResult.totalOrders}
                color="green"
                useCountUp={useCountUp}
              />
              <StatCard
                label="Distancia"
                value={optimizationResult.distance}
                suffix=" mi"
                color="purple"
                useCountUp={useCountUp}
              />
              <StatCard
                label="Conducción"
                value={optimizationResult.duration}
                formatter={formatDuration}
                color="orange"
                useCountUp={useCountUp}
              />
              <StatCard
                label="Duración en Ruta"
                value={parseInt(optimizationResult.duration) + (optimizationResult.totalOrders * 20)}
                formatter={formatDuration}
                color="red"
                useCountUp={useCountUp}
              />
            </div>

            {optimizationResult.multiPeriod && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Ruta Multi-Periodo:</strong> {optimizationResult.periods} periodos unidos en secuencia
                </p>
              </div>
            )}

            {/* Map */}
            <div className="h-96 rounded-lg overflow-hidden">
              <RouteMap
                optimizationResult={optimizationResult}
                warehouseCoordinates={optimizationResult.warehouseCoordinates}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button
              onClick={() => {
                setOptimizationResult(null)
                hasOptimizedRef.current = false // Resetear flag para permitir re-optimización
              }}
              variant="outline"
              className="flex-1"
            >
              Recalcular
            </Button>
            <Button
              onClick={handleSaveRoute}
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Guardando...' : 'Guardar Ruta'}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  const renderStep4 = () => {
    if (!createdRoute) return null

    // Obtener órdenes asociadas a la ruta
    const routeOrders = packageOrders.filter(order =>
      selectedOrders.includes(order.id)
    )

    return (
      <div className="space-y-6">
        {/* Success Message */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-8 text-white text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white rounded-full p-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-2">¡Ruta Creada Exitosamente!</h2>
          <p className="text-green-100 text-lg">
            Ruta <strong>{createdRoute.routeNumber}</strong> lista para ser ejecutada
          </p>
        </div>

        {/* Route Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Resumen de la Ruta
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Paradas</p>
              <p className="text-2xl font-bold text-blue-600">{createdRoute.totalStops}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Órdenes</p>
              <p className="text-2xl font-bold text-green-600">{createdRoute.totalOrders}</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Distancia</p>
              <p className="text-2xl font-bold text-purple-600">{createdRoute.distance} mi</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">Duración</p>
              <p className="text-2xl font-bold text-orange-600">{formatDuration(createdRoute.duration)}</p>
            </div>
          </div>
        </div>

        {/* QR Code Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Código QR de la Ruta
          </h3>

          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-inner">
              <QRCodeSVG
                value={createdRoute.qrCode || createdRoute.routeNumber}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="flex-1">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Este código QR identifica de forma única la ruta. Úsalo para:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <li>Escanear en el dispositivo del conductor</li>
                <li>Imprimir y adjuntar a la documentación</li>
                <li>Control de acceso y seguimiento</li>
              </ul>

              <div className="flex gap-3">
                <Button
                  onClick={handlePrintQR}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir QR
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documentación
          </h3>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Imprime la hoja de ruta completa con mapa, información de paradas y órdenes
          </p>

          <Button
            onClick={handlePrintRoute}
            className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir Hoja de Ruta Completa
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/dashboard/admin/routes')}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            Ver Todas las Rutas
          </Button>
          <Button
            onClick={() => router.push(`/dashboard/admin/routes/${createdRoute.routeId}`)}
            variant="outline"
            className="flex-1"
          >
            Ver Detalles de Esta Ruta
          </Button>
        </div>

        {/* Hidden Print Components */}
        <div style={{ display: 'none' }}>
          {/* QR Print Component */}
          <div ref={qrPrintRef} style={{
            padding: '0',
            margin: '0',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            width: '100%'
          }}>
            <h1 style={{ marginBottom: '20mm', fontSize: '32pt', fontWeight: 'bold', color: '#000' }}>
              {createdRoute.routeNumber}
            </h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid #000',
              padding: '15mm',
              borderRadius: '8mm',
              backgroundColor: '#fff',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
            }}>
              <QRCodeSVG
                value={createdRoute.qrCode || createdRoute.routeNumber}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <p style={{ marginTop: '20mm', fontSize: '20pt', fontWeight: 'bold', color: '#000' }}>
              Escanee para acceder a la ruta
            </p>
            <div style={{ marginTop: '10mm', fontSize: '16pt', color: '#444' }}>
              <p style={{ margin: '5mm 0' }}>
                <strong>{createdRoute.totalStops}</strong> paradas • <strong>{createdRoute.totalOrders}</strong> órdenes
              </p>
              <p style={{ margin: '5mm 0' }}>
                Distancia: <strong>{createdRoute.distance} mi</strong> • Duración: <strong>{formatDuration(createdRoute.duration)}</strong>
              </p>
            </div>
          </div>

          {/* Route Print Component */}
          <div ref={routePrintRef}>
            {/* Page 1: Route Overview with Map */}
            <div style={{ padding: '15mm' }}>
              <h1 style={{ fontSize: '20pt', marginBottom: '5mm', borderBottom: '2px solid #000', paddingBottom: '3mm' }}>
                {createdRoute.routeNumber}
              </h1>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4mm', marginBottom: '8mm' }}>
                <div style={{ border: '1px solid #ddd', padding: '4mm', borderRadius: '3mm', backgroundColor: '#f0f9ff' }}>
                  <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1mm' }}>Paradas</p>
                  <p style={{ fontSize: '16pt', fontWeight: 'bold', color: '#3b82f6' }}>{createdRoute.totalStops}</p>
                </div>
                <div style={{ border: '1px solid #ddd', padding: '4mm', borderRadius: '3mm', backgroundColor: '#f0fdf4' }}>
                  <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1mm' }}>Órdenes</p>
                  <p style={{ fontSize: '16pt', fontWeight: 'bold', color: '#10b981' }}>{createdRoute.totalOrders}</p>
                </div>
                <div style={{ border: '1px solid #ddd', padding: '4mm', borderRadius: '3mm', backgroundColor: '#faf5ff' }}>
                  <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1mm' }}>Distancia</p>
                  <p style={{ fontSize: '16pt', fontWeight: 'bold', color: '#8b5cf6' }}>{createdRoute.distance} mi</p>
                </div>
                <div style={{ border: '1px solid #ddd', padding: '4mm', borderRadius: '3mm', backgroundColor: '#fff7ed' }}>
                  <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1mm' }}>Conducción</p>
                  <p style={{ fontSize: '16pt', fontWeight: 'bold', color: '#f97316' }}>{formatDuration(optimizationResult?.duration || createdRoute.duration)}</p>
                </div>
                <div style={{ border: '1px solid #ddd', padding: '4mm', borderRadius: '3mm', backgroundColor: '#fef2f2' }}>
                  <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1mm' }}>Duración en Ruta</p>
                  <p style={{ fontSize: '16pt', fontWeight: 'bold', color: '#ef4444' }}>{formatDuration(parseInt(optimizationResult?.duration || createdRoute.duration) + ((optimizationResult?.totalOrders || createdRoute.totalOrders) * 20))}</p>
                </div>
                <div style={{ border: '1px solid #ddd', padding: '4mm', borderRadius: '3mm', backgroundColor: '#f0fdf4' }}>
                  <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1mm' }}>Tiempo Estimado</p>
                  <p style={{ fontSize: '16pt', fontWeight: 'bold', color: '#059669' }}>{formatDuration(parseInt(optimizationResult?.duration || createdRoute.duration) + ((optimizationResult?.totalOrders || createdRoute.totalOrders) * 20))}</p>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '8mm' }}>
                <div style={{ display: 'inline-block', border: '2px solid #000', padding: '3mm' }}>
                  <QRCodeSVG
                    value={createdRoute.qrCode || createdRoute.routeNumber}
                    size={100}
                    level="H"
                    includeMargin
                  />
                </div>
                <p style={{ marginTop: '3mm', fontSize: '10pt' }}>{createdRoute.routeNumber}</p>
              </div>
            </div>

            {/* Pages 2+: One order per page - Modern Minimal Design */}
            {routeOrders.map((order, index) => (
              <div key={order.id} className="page-break" style={{
                padding: '12mm 15mm',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                position: 'relative',
                minHeight: '277mm'
              }}>
                {/* Header con QR */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm', borderBottom: '1px solid #e5e7eb', paddingBottom: '5mm' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '9pt', color: '#9ca3af', margin: '0 0 1mm 0', letterSpacing: '0.5px' }}>
                      PARADA {index + 1} DE {routeOrders.length}
                    </p>
                    <h1 style={{ fontSize: '24pt', fontWeight: '700', margin: '0', color: '#111827', letterSpacing: '-0.5px' }}>
                      {order.orderNumber || `#${order.id}`}
                    </h1>
                  </div>
                  <div style={{ textAlign: 'center', marginLeft: '10mm' }}>
                    <QRCodeSVG
                      value={order.orderNumber || `ORD-${order.id}`}
                      size={80}
                      level="M"
                    />
                    <p style={{ fontSize: '7pt', color: '#6b7280', margin: '2mm 0 0 0' }}>Escanear orden</p>
                  </div>
                </div>

                {/* Cliente */}
                <div style={{ marginBottom: '6mm', padding: '4mm', backgroundColor: '#f9fafb', borderRadius: '2mm', border: '1px solid #e5e7eb' }}>
                  <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0 0 2mm 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>Cliente</p>
                  <p style={{ fontSize: '14pt', fontWeight: '600', color: '#111827', margin: '0 0 2mm 0' }}>
                    {order.firstName} {order.lastName}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginTop: '3mm' }}>
                    <div>
                      <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0' }}>📞 Teléfono</p>
                      <p style={{ fontSize: '11pt', color: '#111827', margin: '1mm 0 0 0', fontWeight: '500' }}>{order.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0' }}>✉️ Email</p>
                      <p style={{ fontSize: '11pt', color: '#111827', margin: '1mm 0 0 0', fontWeight: '500' }}>{order.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Dirección */}
                <div style={{ marginBottom: '6mm', padding: '4mm', backgroundColor: '#ecfdf5', borderRadius: '2mm', border: '1px solid #a7f3d0' }}>
                  <p style={{ fontSize: '8pt', color: '#065f46', margin: '0 0 2mm 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>📍 Dirección de Entrega</p>
                  <p style={{ fontSize: '13pt', fontWeight: '700', color: '#064e3b', margin: '0', lineHeight: 1.4 }}>
                    {order.address || order.customerAddress?.street || 'N/A'}
                  </p>
                  {order.customerAddress && typeof order.customerAddress === 'object' && order.customerAddress.city && (
                    <p style={{ fontSize: '10pt', color: '#047857', margin: '2mm 0 0 0' }}>
                      {order.customerAddress.city}, {order.customerAddress.state} {order.customerAddress.zipCode}
                    </p>
                  )}
                  {order.customerNotes && (
                    <div style={{ marginTop: '3mm', padding: '3mm', backgroundColor: '#fef3c7', borderLeft: '3px solid #f59e0b', borderRadius: '1mm' }}>
                      <p style={{ fontSize: '9pt', color: '#92400e', margin: '0' }}>
                        <strong>💬 Nota:</strong> {order.customerNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Servicios */}
                <div style={{ marginBottom: '6mm' }}>
                  <p style={{ fontSize: '8pt', color: '#6b7280', margin: '0 0 2mm 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>📦 Servicios</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm' }}>
                    {Array.isArray(order.services) ? (
                      order.services.map((service: string, idx: number) => (
                        <span key={idx} style={{
                          display: 'inline-block',
                          padding: '2mm 3mm',
                          backgroundColor: '#ede9fe',
                          color: '#5b21b6',
                          fontSize: '9pt',
                          fontWeight: '500',
                          borderRadius: '1mm',
                          border: '1px solid #c4b5fd'
                        }}>
                          {service}
                        </span>
                      ))
                    ) : (
                      <span style={{
                        display: 'inline-block',
                        padding: '2mm 3mm',
                        backgroundColor: '#ede9fe',
                        color: '#5b21b6',
                        fontSize: '9pt',
                        fontWeight: '500',
                        borderRadius: '1mm',
                        border: '1px solid #c4b5fd'
                      }}>
                        {order.services}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalles en Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '6mm' }}>
                  <div style={{ padding: '3mm', backgroundColor: '#fff7ed', borderRadius: '2mm', border: '1px solid #fed7aa' }}>
                    <p style={{ fontSize: '8pt', color: '#9a3412', margin: '0' }}>⏱️ Tiempo Servicio</p>
                    <p style={{ fontSize: '12pt', fontWeight: '700', color: '#7c2d12', margin: '1mm 0 0 0' }}>5 min</p>
                  </div>
                  <div style={{ padding: '3mm', backgroundColor: '#dbeafe', borderRadius: '2mm', border: '1px solid #93c5fd' }}>
                    <p style={{ fontSize: '8pt', color: '#1e3a8a', margin: '0' }}>📊 Estado</p>
                    <p style={{ fontSize: '12pt', fontWeight: '700', color: '#1e40af', margin: '1mm 0 0 0' }}>{order.status}</p>
                  </div>
                  <div style={{ padding: '3mm', backgroundColor: '#f5f3ff', borderRadius: '2mm', border: '1px solid #ddd6fe' }}>
                    <p style={{ fontSize: '8pt', color: '#5b21b6', margin: '0' }}>📅 Fecha</p>
                    <p style={{ fontSize: '12pt', fontWeight: '700', color: '#6b21a8', margin: '1mm 0 0 0' }}>{order.scheduledDate || order.date}</p>
                  </div>
                  <div style={{ padding: '3mm', backgroundColor: '#f0fdf4', borderRadius: '2mm', border: '1px solid #bbf7d0' }}>
                    <p style={{ fontSize: '8pt', color: '#14532d', margin: '0' }}>💳 Pago</p>
                    <p style={{ fontSize: '12pt', fontWeight: '700', color: '#15803d', margin: '1mm 0 0 0' }}>{order.paymentMethod || 'N/A'}</p>
                  </div>
                </div>

                {/* Notas del conductor */}
                {order.notes && (
                  <div style={{ padding: '4mm', backgroundColor: '#fef2f2', borderLeft: '3px solid #dc2626', borderRadius: '2mm', marginBottom: '6mm' }}>
                    <p style={{ fontSize: '8pt', color: '#7f1d1d', margin: '0 0 2mm 0', fontWeight: '600', textTransform: 'uppercase' }}>⚠️ Notas Importantes</p>
                    <p style={{ fontSize: '10pt', color: '#991b1b', margin: '0', lineHeight: 1.4 }}>
                      {order.notes}
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div style={{ position: 'absolute', bottom: '12mm', left: '15mm', right: '15mm', paddingTop: '3mm', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '8pt', color: '#9ca3af', margin: '0', fontWeight: '500' }}>
                      {createdRoute.routeNumber}
                    </p>
                    <p style={{ fontSize: '8pt', color: '#9ca3af', margin: '0', fontWeight: '500' }}>
                      Página {index + 3} de {routeOrders.length + 2}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading && currentStep === 1) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando datos...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="max-w-6xl mx-auto">
        {/* Close Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push('/dashboard/admin/routes')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step Indicator - Centered */}
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-2xl">
            {renderStepIndicator()}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        {currentStep < 3 && (
          <div className="flex gap-4">
            {currentStep > 1 && (
              <Button
                onClick={handlePrevious}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
