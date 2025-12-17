'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  MapPin,
  DollarSign,
  User,
  Users,
  CreditCard,
  FileCheck,
  Banknote,
  Loader2,
  Phone,
  Home,
  AlertCircle,
  Clock,
  Send,
  Printer,
  MessageCircle,
  Search,
  UserCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface Province {
  name: string
  municipalities: {
    name: string
    brokerCount: number
    currencies: string[]
  }[]
}

interface WizardStep {
  id: number
  title: string
  description: string
  icon: any
}

interface RemittanceProduct {
  productId: number
  code: string
  name: string
  description: string
  pricingModel: 'percentage' | 'fixed'
  currency: string | null
  precioClientes: number | null  // Company's sale price (percentage or fixed)
  catalogPrecioPublico: number   // Default price if no company pricing
  catalogMiCostoFijo: number     // Fixed fee component
  catalogPrecioMayoristaFijo: number
}

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Efectivo', icon: '$' },
  { id: 'zelle', name: 'Zelle', icon: 'Z' },
  { id: 'card', name: 'Tarjeta', icon: 'T' }
]

export default function CreateRemittancePage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [canProceed, setCanProceed] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [availability, setAvailability] = useState<any>(null)
  const [remittanceProducts, setRemittanceProducts] = useState<RemittanceProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1, CUP: 1 })

  // Customer search state - Recipient
  const [searchPhone, setSearchPhone] = useState('')
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [foundCustomers, setFoundCustomers] = useState<any[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null)
  const [recipientAddresses, setRecipientAddresses] = useState<any[]>([])

  // Customer search state - Sender
  const [senderSearchPhone, setSenderSearchPhone] = useState('')
  const [searchingSender, setSearchingSender] = useState(false)
  const [foundSenders, setFoundSenders] = useState<any[]>([])
  const [selectedSender, setSelectedSender] = useState<any>(null)

  // Map state for recipient address
  const [showMap, setShowMap] = useState(false)
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<any>(null)
  const markerRef = React.useRef<any>(null)

  // Ref to always have latest exchange rates available in callbacks
  const exchangeRatesRef = React.useRef(exchangeRates)
  React.useEffect(() => {
    exchangeRatesRef.current = exchangeRates
  }, [exchangeRates])

  // Wizard data state
  const [wizardData, setWizardData] = useState({
    // Step 1: Location
    province: '',
    municipality: '',
    // Step 2: Service
    productId: null as number | null,
    serviceType: '',
    deliveryFee: 5,
    // Step 3: Amount
    sendAmount: 0,
    sendCurrency: 'USD',
    receiveCurrency: 'USD',
    receiveAmount: 0,
    exchangeRate: 1,
    serviceFee: 0,
    totalCharged: 0,
    estimatedDelivery: '',
    // Step 4: Recipient
    recipientName: '',
    recipientPhone: '',
    recipientIdNumber: '',
    recipientAddress: '',
    recipientNeighborhood: '',
    recipientAddressReferences: '',
    recipientLatitude: null as number | null,
    recipientLongitude: null as number | null,
    recipientCustomerId: null as number | null,
    recipientAddressId: null as number | null,
    hasAlternateContact: false,
    alternateContactName: '',
    alternateContactPhone: '',
    // Step 5: Sender
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    // Step 6: Payment
    paymentMethod: '',
    paymentReference: '',
    cashReceived: 0,
    // Step 7: Confirmation
    orderNumber: '',
    orderId: null as number | null
  })

  const steps: WizardStep[] = [
    { id: 1, title: 'Ubicacion', description: 'Zona de entrega', icon: MapPin },
    { id: 2, title: 'Servicio', description: 'Tipo de envio', icon: Banknote },
    { id: 3, title: 'Monto', description: 'Cantidad a enviar', icon: DollarSign },
    { id: 4, title: 'Destinatario', description: 'Datos del beneficiario', icon: User },
    { id: 5, title: 'Remitente', description: 'Quien envia', icon: Users },
    { id: 6, title: 'Pago', description: 'Metodo de pago', icon: CreditCard },
    { id: 7, title: 'Confirmacion', description: 'Completar orden', icon: FileCheck }
  ]

  // Load provinces and exchange rates on mount
  useEffect(() => {
    loadProvinces()
    loadExchangeRates()
  }, [])

  // Load remittance products on mount
  useEffect(() => {
    if (user?.companyId) {
      loadRemittanceProducts()
    }
  }, [user?.companyId])

  const loadProvinces = async () => {
    try {
      const res = await fetch('/api/brokers/locations')
      const data = await res.json()
      if (data.success) {
        setProvinces(data.data.provinces)
      }
    } catch (error) {
      console.error('Error loading provinces:', error)
    }
  }

  const loadExchangeRates = async () => {
    try {
      const res = await fetch('/api/published-rates')
      const data = await res.json()
      if (data.success && data.rates) {
        // Build rates object
        // The API returns rates relative to CUP (e.g., USD: 424.6 means 1 USD = 424.6 CUP)
        const rates: Record<string, number> = {}

        data.rates.forEach((r: { currency: string; rate: number }) => {
          rates[r.currency] = r.rate
        })

        // For CUP delivery: use the USD rate (which is CUP per USD)
        // If the product currency is CUP, we multiply sendAmount by USD rate
        if (rates['USD']) {
          rates['CUP'] = rates['USD'] // CUP rate = how many CUP per 1 USD
        }

        // For USD delivery: rate is 1 (1 USD = 1 USD, no conversion)
        rates['USD_DELIVERY'] = 1

        setExchangeRates(rates)
        console.log('[Remittance Wizard] Loaded exchange rates:', rates)
      }
    } catch (error) {
      console.error('Error loading exchange rates:', error)
    }
  }

  const loadRemittanceProducts = async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/companies/${user?.companyId}/products/pricing`)
      const data = await res.json()
      if (data.success && data.data) {
        // Filter only remittance products (service_category = 'remesa')
        const allProducts = data.data.products || []
        const remesaProducts = allProducts.filter((p: any) => p.serviceCategory === 'remesa')

        const products: RemittanceProduct[] = remesaProducts.map((p: any) => ({
          productId: p.productId,
          code: p.code,
          name: p.name,
          description: p.description || '',
          pricingModel: p.pricingModel,
          currency: p.currency,
          precioClientes: p.precioClientes,
          catalogPrecioPublico: p.catalogPrecioPublico || 0,
          catalogMiCostoFijo: p.catalogMiCostoFijo || 0,
          catalogPrecioMayoristaFijo: p.catalogPrecioMayoristaFijo || 0
        }))
        setRemittanceProducts(products)

        // Auto-select first product if available
        if (products.length > 0 && !wizardData.productId) {
          const firstProduct = products[0]
          setWizardData(prev => ({
            ...prev,
            productId: firstProduct.productId,
            serviceType: firstProduct.code,
            receiveCurrency: firstProduct.currency || 'USD'
          }))
        }
      }
    } catch (error) {
      console.error('Error loading remittance products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Search for customer by phone
  const searchCustomerByPhone = async () => {
    if (!searchPhone.trim()) return

    setSearchingCustomer(true)
    setFoundCustomers([])
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(searchPhone)}`)
      const data = await res.json()
      if (data.success) {
        const results = data.data || []
        setFoundCustomers(results)
      }
    } catch (error) {
      console.error('Error searching customer:', error)
    } finally {
      setSearchingCustomer(false)
    }
  }

  // Select a found customer and fill in the form
  const selectRecipientFromSearch = (customer: any) => {
    setSelectedRecipient(customer)
    setFoundCustomers([])
    setSearchPhone('')

    // Fill in the wizard data with customer info
    // Parse name (assuming firstName lastName format)
    const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()

    updateWizardData({
      recipientName: fullName || customer.name || '',
      recipientPhone: customer.phone || '',
      recipientIdNumber: customer.idNumber || '',
      recipientAddress: '',
      recipientNeighborhood: '',
      recipientAddressReferences: '',
      recipientLatitude: null,
      recipientLongitude: null,
      recipientCustomerId: customer.id,
      recipientAddressId: null,
      hasAlternateContact: customer.hasAlternateContact || false,
      alternateContactName: customer.alternateContactName || '',
      alternateContactPhone: customer.alternateContactPhone || ''
    })

    // Load Cuba addresses for this customer
    if (customer.id) {
      loadRecipientAddresses(customer.id)
    }
  }

  // Clear selected recipient and allow new search
  const clearSelectedRecipient = () => {
    setSelectedRecipient(null)
    setRecipientAddresses([])
    setSearchPhone('')
    updateWizardData({
      recipientName: '',
      recipientPhone: '',
      recipientIdNumber: '',
      recipientAddress: '',
      recipientNeighborhood: '',
      recipientAddressReferences: '',
      recipientLatitude: null,
      recipientLongitude: null,
      recipientCustomerId: null,
      recipientAddressId: null,
      hasAlternateContact: false,
      alternateContactName: '',
      alternateContactPhone: ''
    })
  }

  // Load customer addresses for Cuba when a recipient is selected
  const loadRecipientAddresses = async (customerId: number) => {
    try {
      const res = await fetch(`/api/customer-addresses?customerId=${customerId}`)
      const data = await res.json()
      if (data.success && data.data) {
        // Filter only Cuba addresses (country = 'Cuba' or province matches Cuban provinces)
        const cubaAddresses = data.data.filter((addr: any) =>
          addr.country === 'Cuba' ||
          addr.country === 'CU' ||
          ['La Habana', 'Pinar del Río', 'Artemisa', 'Mayabeque', 'Matanzas', 'Cienfuegos', 'Villa Clara', 'Sancti Spíritus', 'Ciego de Ávila', 'Camagüey', 'Las Tunas', 'Holguín', 'Granma', 'Santiago de Cuba', 'Guantánamo', 'Isla de la Juventud'].some(p =>
            addr.state?.toLowerCase().includes(p.toLowerCase())
          )
        )
        setRecipientAddresses(cubaAddresses)
      }
    } catch (error) {
      console.error('Error loading recipient addresses:', error)
    }
  }

  // Select an address from the list
  const selectRecipientAddress = (address: any) => {
    updateWizardData({
      recipientAddress: address.street || '',
      recipientNeighborhood: address.city || '',
      recipientAddressReferences: address.notes || '',
      recipientLatitude: address.latitude || null,
      recipientLongitude: address.longitude || null,
      recipientAddressId: address.id
    })

    // Update map marker if map is visible
    if (address.latitude && address.longitude && mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([address.longitude, address.latitude])
      mapRef.current.flyTo({ center: [address.longitude, address.latitude], zoom: 15 })
    }
  }

  // Search for sender by phone
  const searchSenderByPhone = async () => {
    if (!senderSearchPhone.trim()) return

    setSearchingSender(true)
    setFoundSenders([])
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(senderSearchPhone)}`)
      const data = await res.json()
      if (data.success) {
        const results = data.data || []
        setFoundSenders(results)
      }
    } catch (error) {
      console.error('Error searching sender:', error)
    } finally {
      setSearchingSender(false)
    }
  }

  // Select a found sender and fill in the form
  const selectSenderFromSearch = (customer: any) => {
    setSelectedSender(customer)
    setFoundSenders([])
    setSenderSearchPhone('')

    // Fill in the wizard data with customer info
    const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()

    updateWizardData({
      senderName: fullName || customer.name || '',
      senderPhone: customer.phone || '',
      senderEmail: customer.email || ''
    })
  }

  // Clear selected sender and allow new search
  const clearSelectedSender = () => {
    setSelectedSender(null)
    setSenderSearchPhone('')
    updateWizardData({
      senderName: '',
      senderPhone: '',
      senderEmail: ''
    })
  }

  // Cuba municipality coordinates (same as broker form)
  const CUBA_LOCATIONS: Record<string, { coords: [number, number], municipalities: Record<string, [number, number]> }> = {
    'Pinar del Río': { coords: [-83.6978, 22.4175], municipalities: {
      'Pinar del Río': [-83.6978, 22.4175], 'Consolación del Sur': [-83.5178, 22.5056], 'Sandino': [-84.0217, 22.0794],
      'San Juan y Martínez': [-83.8353, 22.2667], 'Guane': [-84.0833, 22.2000], 'Los Palacios': [-83.2500, 22.5833],
      'Viñales': [-83.7139, 22.6169], 'La Palma': [-83.5553, 22.7569], 'Minas de Matahambre': [-83.9500, 22.5833],
      'San Luis': [-83.7667, 22.2833], 'Mantua': [-84.2833, 22.2833]
    }},
    'Artemisa': { coords: [-82.7617, 22.8136], municipalities: {
      'Artemisa': [-82.7617, 22.8136], 'Bahía Honda': [-83.1639, 22.9033], 'Candelaria': [-82.9583, 22.7500],
      'Guanajay': [-82.6875, 22.9292], 'Mariel': [-82.7528, 22.9944], 'San Antonio de los Baños': [-82.4992, 22.8911],
      'San Cristóbal': [-83.0500, 22.7167], 'Bauta': [-82.5489, 22.9883], 'Caimito': [-82.5917, 22.9583],
      'Güira de Melena': [-82.5083, 22.8000], 'Alquízar': [-82.5833, 22.8000]
    }},
    'La Habana': { coords: [-82.3666, 23.1136], municipalities: {
      'Playa': [-82.4208, 23.1147], 'Plaza de la Revolución': [-82.3917, 23.1200], 'Centro Habana': [-82.3667, 23.1367],
      'La Habana Vieja': [-82.3500, 23.1350], 'Regla': [-82.3333, 23.1250], 'Habana del Este': [-82.2833, 23.1583],
      'Guanabacoa': [-82.3000, 23.1167], 'San Miguel del Padrón': [-82.3333, 23.0833], 'Diez de Octubre': [-82.3667, 23.0917],
      'Cerro': [-82.3833, 23.1000], 'Marianao': [-82.4333, 23.0833], 'La Lisa': [-82.4667, 23.0333],
      'Boyeros': [-82.4000, 22.9833], 'Arroyo Naranjo': [-82.3500, 23.0333], 'Cotorro': [-82.2667, 23.0333]
    }},
    'Mayabeque': { coords: [-81.9300, 22.9200], municipalities: {
      'Bejucal': [-82.3833, 22.9333], 'San José de las Lajas': [-82.1500, 22.9667], 'Jaruco': [-82.0167, 23.0500],
      'Santa Cruz del Norte': [-81.9167, 23.1500], 'Madruga': [-81.8500, 22.9167], 'Nueva Paz': [-81.7500, 22.7667],
      'San Nicolás de Bari': [-81.9000, 22.7833], 'Güines': [-82.0333, 22.8333], 'Melena del Sur': [-82.1500, 22.7833],
      'Batabanó': [-82.2833, 22.7167], 'Quivicán': [-82.3500, 22.8167]
    }},
    'Matanzas': { coords: [-81.5775, 22.4117], municipalities: {
      'Matanzas': [-81.5775, 22.4117], 'Cárdenas': [-81.2000, 23.0333], 'Varadero': [-81.2500, 23.1500],
      'Colón': [-80.9000, 22.7167], 'Jovellanos': [-81.1833, 22.8000], 'Pedro Betancourt': [-81.2833, 22.7000],
      'Limonar': [-81.4167, 22.9500], 'Unión de Reyes': [-81.5333, 22.7833], 'Los Arabos': [-80.7167, 22.7333],
      'Perico': [-81.0167, 22.7667], 'Martí': [-80.9333, 22.9500], 'Jagüey Grande': [-81.1333, 22.5333],
      'Ciénaga de Zapata': [-81.0667, 22.3667]
    }},
    'Cienfuegos': { coords: [-80.4536, 22.1456], municipalities: {
      'Cienfuegos': [-80.4536, 22.1456], 'Palmira': [-80.3833, 22.2333], 'Rodas': [-80.5500, 22.3333],
      'Lajas': [-80.2833, 22.4167], 'Cruces': [-80.2667, 22.3500], 'Cumanayagua': [-80.2000, 22.1500],
      'Aguada de Pasajeros': [-80.8500, 22.3833], 'Abreus': [-80.5667, 22.2833]
    }},
    'Villa Clara': { coords: [-79.965287, 22.402030], municipalities: {
      'Santa Clara': [-79.965287, 22.402030], 'Remedios': [-79.5458, 22.4917], 'Caibarién': [-79.4667, 22.5167],
      'Camajuaní': [-79.7333, 22.4667], 'Placetas': [-79.6500, 22.3167], 'Sagua la Grande': [-80.0833, 22.8000],
      'Cifuentes': [-80.0500, 22.6167], 'Santo Domingo': [-80.2333, 22.5833], 'Ranchuelo': [-80.1500, 22.3833],
      'Manicaragua': [-79.9667, 22.1500], 'Encrucijada': [-79.8667, 22.6167], 'Quemado de Güines': [-80.2500, 22.8000]
    }},
    'Sancti Spíritus': { coords: [-79.4428, 21.9303], municipalities: {
      'Sancti Spíritus': [-79.4428, 21.9303], 'Trinidad': [-79.9844, 21.8022], 'Fomento': [-79.7167, 22.1000],
      'Cabaiguán': [-79.5000, 22.0833], 'Jatibonico': [-79.1667, 21.9500], 'Taguasco': [-79.2667, 22.0333],
      'Yaguajay': [-79.2333, 22.3333], 'La Sierpe': [-79.2500, 21.7500]
    }},
    'Ciego de Ávila': { coords: [-78.7619, 21.8403], municipalities: {
      'Ciego de Ávila': [-78.7619, 21.8403], 'Morón': [-78.6275, 22.1078], 'Chambas': [-78.9167, 22.2000],
      'Ciro Redondo': [-78.7000, 22.0167], 'Majagua': [-78.9833, 21.9167], 'Florencia': [-78.9667, 22.1500],
      'Venezuela': [-78.7833, 21.7500], 'Baraguá': [-78.6333, 21.6833], 'Primero de Enero': [-78.4333, 21.9500],
      'Bolivia': [-78.4500, 21.8500]
    }},
    'Camagüey': { coords: [-77.9169, 21.3808], municipalities: {
      'Camagüey': [-77.9169, 21.3808], 'Florida': [-78.2167, 21.5333], 'Vertientes': [-78.1500, 21.2500],
      'Guáimaro': [-77.3500, 21.4667], 'Sibanicú': [-77.5333, 21.2333], 'Nuevitas': [-77.2642, 21.5456],
      'Esmeralda': [-78.1167, 21.8500], 'Minas': [-77.6167, 21.5000], 'Jimaguayú': [-77.8333, 21.2500],
      'Santa Cruz del Sur': [-77.9833, 20.7167], 'Najasa': [-77.7500, 21.0833], 'Sierra de Cubitas': [-77.7833, 21.6333],
      'Céspedes': [-78.0167, 21.1500]
    }},
    'Las Tunas': { coords: [-76.9514, 20.9597], municipalities: {
      'Las Tunas': [-76.9514, 20.9597], 'Puerto Padre': [-76.6036, 21.1958], 'Jesús Menéndez': [-76.4833, 21.1667],
      'Manatí': [-76.9333, 21.3167], 'Majibacoa': [-76.7500, 20.9167], 'Jobabo': [-77.2833, 20.9167],
      'Colombia': [-77.4167, 20.9833], 'Amancio': [-77.5833, 20.8167]
    }},
    'Holguín': { coords: [-76.2633, 20.7869], municipalities: {
      'Holguín': [-76.2633, 20.7869], 'Gibara': [-76.1333, 21.1167], 'Banes': [-75.7167, 20.9667],
      'Moa': [-74.9333, 20.6500], 'Mayarí': [-75.6833, 20.6500], 'Sagua de Tánamo': [-75.2500, 20.5833],
      'Antilla': [-75.7500, 20.8333], 'Báguano': [-76.0167, 20.7667], 'Calixto García': [-76.5833, 20.8667],
      'Cacocum': [-76.3333, 20.7333], 'Cueto': [-75.9333, 20.6500], 'Frank País': [-75.5833, 20.5167],
      'Rafael Freyre': [-75.9833, 21.0167], 'Urbano Noris': [-76.0500, 20.6167]
    }},
    'Granma': { coords: [-76.6431, 20.3847], municipalities: {
      'Bayamo': [-76.6431, 20.3847], 'Manzanillo': [-77.1167, 20.3500], 'Jiguaní': [-76.4167, 20.3667],
      'Río Cauto': [-76.9167, 20.5500], 'Yara': [-76.9500, 20.2833], 'Campechuela': [-77.2833, 20.2333],
      'Media Luna': [-77.4333, 20.1500], 'Niquero': [-77.5833, 20.0500], 'Pilón': [-77.3167, 19.9000],
      'Bartolomé Masó': [-76.9500, 20.1667], 'Buey Arriba': [-76.7500, 20.1833], 'Guisa': [-76.5333, 20.2500],
      'Cauto Cristo': [-76.4333, 20.5500]
    }},
    'Santiago de Cuba': { coords: [-75.8219, 20.0247], municipalities: {
      'Santiago de Cuba': [-75.8219, 20.0247], 'Palma Soriano': [-75.9833, 20.2167], 'Contramaestre': [-76.2500, 20.3000],
      'San Luis': [-75.8500, 20.1833], 'Segundo Frente': [-75.5167, 20.3333], 'Songo-La Maya': [-75.6667, 20.1833],
      'Tercer Frente': [-76.3333, 20.1833], 'Guamá': [-76.5833, 19.9667], 'Mella': [-76.3000, 20.3667]
    }},
    'Guantánamo': { coords: [-75.2092, 20.1447], municipalities: {
      'Guantánamo': [-75.2092, 20.1447], 'Baracoa': [-74.4964, 20.3467], 'El Salvador': [-75.2333, 20.3167],
      'San Antonio del Sur': [-74.8167, 20.0500], 'Imías': [-74.6333, 20.0833], 'Maisí': [-74.1500, 20.2500],
      'Yateras': [-75.0333, 20.2833], 'Caimanera': [-75.1500, 19.9667], 'Manuel Tames': [-75.1333, 20.3000],
      'Niceto Pérez': [-75.0833, 20.1000]
    }},
    'Isla de la Juventud': { coords: [-82.8500, 21.7000], municipalities: {
      'Nueva Gerona': [-82.8000, 21.8833]
    }}
  }

  // Get target coordinates (municipality priority, then province)
  const getTargetCoords = React.useCallback((province: string, municipality: string): [number, number] => {
    const provinceData = CUBA_LOCATIONS[province]
    if (provinceData) {
      // Try municipality first
      const municipalityCoords = provinceData.municipalities[municipality]
      if (municipalityCoords) {
        return municipalityCoords
      }
      // Fallback to province center
      return provinceData.coords
    }
    // Default Cuba center
    return [-79.5, 22.0]
  }, [])

  // Initialize map for Cuba pin placement
  const initializeMap = React.useCallback(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Get coordinates based on current province/municipality
    const initialCenter = getTargetCoords(wizardData.province, wizardData.municipality)
    const initialZoom = wizardData.municipality ? 13 : wizardData.province ? 11 : 6

    // Use existing coordinates if available, otherwise use municipality/province center
    const center = (wizardData.recipientLatitude && wizardData.recipientLongitude)
      ? [wizardData.recipientLongitude, wizardData.recipientLatitude] as [number, number]
      : initialCenter
    const zoom = (wizardData.recipientLatitude && wizardData.recipientLongitude) ? 15 : initialZoom

    console.log('[Map Init] Province:', wizardData.province, 'Municipality:', wizardData.municipality)
    console.log('[Map Init] Center:', center, 'Zoom:', zoom)

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom
    })

    // Add navigation controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Create draggable marker (same style as broker form)
    markerRef.current = new mapboxgl.Marker({ color: '#CC0A46', draggable: true })
      .setLngLat(center)
      .addTo(mapRef.current)

    // Set initial coordinates if municipality was selected
    if (!wizardData.recipientLatitude && !wizardData.recipientLongitude && wizardData.municipality) {
      updateWizardData({
        recipientLatitude: center[1],
        recipientLongitude: center[0]
      })
    }

    // Update coordinates when marker is dragged
    markerRef.current.on('dragend', () => {
      const lngLat = markerRef.current.getLngLat()
      updateWizardData({
        recipientLatitude: lngLat.lat,
        recipientLongitude: lngLat.lng
      })
    })

    // Allow clicking on map to move marker
    mapRef.current.on('click', (e: any) => {
      markerRef.current.setLngLat(e.lngLat)
      updateWizardData({
        recipientLatitude: e.lngLat.lat,
        recipientLongitude: e.lngLat.lng
      })
    })
  }, [wizardData.province, wizardData.municipality, wizardData.recipientLatitude, wizardData.recipientLongitude, getTargetCoords])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  // Initialize/destroy map when showMap changes
  useEffect(() => {
    if (showMap && mapContainerRef.current) {
      // Destroy existing map first if any
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
      // Small delay to ensure container is rendered
      setTimeout(initializeMap, 100)
    } else if (!showMap && mapRef.current) {
      // Destroy map when hiding
      mapRef.current.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [showMap, initializeMap])

  // FlyTo when municipality changes (like broker form)
  useEffect(() => {
    if (mapRef.current && showMap && wizardData.municipality) {
      const targetCoords = getTargetCoords(wizardData.province, wizardData.municipality)
      console.log('[Map FlyTo] Municipality:', wizardData.municipality, 'Coords:', targetCoords)
      mapRef.current.flyTo({
        center: targetCoords,
        zoom: 13,
        duration: 1000
      })
      // Move marker to new location
      if (markerRef.current) {
        markerRef.current.setLngLat(targetCoords)
        updateWizardData({
          recipientLatitude: targetCoords[1],
          recipientLongitude: targetCoords[0]
        })
      }
    }
  }, [wizardData.municipality, wizardData.province, showMap, getTargetCoords])

  // Check availability when on step 3
  useEffect(() => {
    if (currentStep === 3 && wizardData.sendAmount > 0 && wizardData.province && wizardData.municipality) {
      checkAvailability()
    }
  }, [currentStep, wizardData.sendAmount, wizardData.receiveCurrency])

  // Recalculate receive amount when exchange rates change
  useEffect(() => {
    if (wizardData.productId && wizardData.receiveCurrency) {
      // Determine the rate based on receive currency
      let rate = 1
      if (wizardData.receiveCurrency === 'USD') {
        rate = 1 // No conversion for USD
      } else if (wizardData.receiveCurrency === 'CUP') {
        rate = exchangeRates['CUP'] || exchangeRates['USD'] || 1 // CUP per USD
      } else {
        rate = exchangeRates[wizardData.receiveCurrency] || 1
      }

      if (rate !== wizardData.exchangeRate) {
        console.log('[Remittance Wizard] Recalculating with new rate:', rate, 'for', wizardData.receiveCurrency)
        setWizardData(prev => ({
          ...prev,
          exchangeRate: rate,
          receiveAmount: prev.sendAmount * rate
        }))
      }
    }
  }, [exchangeRates, wizardData.productId, wizardData.receiveCurrency])

  const checkAvailability = async () => {
    setLoading(true)
    try {
      // Use receiveAmount (the amount in destination currency) for availability check
      // e.g., if sending 100 USD to receive 42,460 CUP, check for 42,460 CUP availability
      const res = await fetch(
        `/api/brokers/availability?province=${encodeURIComponent(wizardData.province)}&municipality=${encodeURIComponent(wizardData.municipality)}&currency=${wizardData.receiveCurrency}&amount=${wizardData.receiveAmount}`
      )
      const data = await res.json()
      if (data.success) {
        setAvailability(data.data)
        setWizardData(prev => ({
          ...prev,
          estimatedDelivery: data.data.estimatedDelivery
        }))
      }
    } catch (error) {
      console.error('Error checking availability:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update wizard data and recalculate totals
  const updateWizardData = (updates: Partial<typeof wizardData>) => {
    setWizardData(prev => {
      const newData = { ...prev, ...updates }

      // Calculate totals when relevant fields change
      if ('sendAmount' in updates || 'productId' in updates || 'serviceType' in updates || 'deliveryFee' in updates) {
        // Find product by productId or serviceType
        const productId = updates.productId ?? prev.productId
        const product = remittanceProducts.find(p => p.productId === productId)

        if (product) {
          const amount = updates.sendAmount ?? prev.sendAmount
          // Use company's configured price (precioClientes) or fallback to catalog default
          const feePercentage = product.precioClientes ?? product.catalogPrecioPublico ?? 0
          const fixedFee = product.catalogMiCostoFijo || 0

          let fee = 0
          if (product.pricingModel === 'percentage') {
            fee = (amount * feePercentage / 100) + fixedFee
          } else {
            // Fixed pricing model
            fee = feePercentage + fixedFee
          }

          // Get receive currency and calculate exchange rate
          const receiveCurrency = product.currency || 'USD'
          // Use ref to get latest exchange rates (avoid stale closure)
          const currentRates = exchangeRatesRef.current

          // Determine the rate based on receive currency
          // USD: 1:1 (family receives USD, no conversion needed)
          // CUP: use the CUP rate (which is CUP per USD from published-rates)
          // MLC/EUR: use their respective rates
          let rate = 1
          if (receiveCurrency === 'USD') {
            rate = 1 // No conversion for USD
          } else if (receiveCurrency === 'CUP') {
            rate = currentRates['CUP'] || currentRates['USD'] || 1 // CUP per USD
          } else {
            rate = currentRates[receiveCurrency] || 1
          }

          // Calculate receive amount based on currency
          const receiveAmount = amount * rate
          console.log(`[Remittance Wizard] Calculating: ${amount} USD × ${rate} = ${receiveAmount} ${receiveCurrency}`)

          newData.serviceFee = fee
          newData.totalCharged = amount + fee + (updates.deliveryFee ?? prev.deliveryFee)
          newData.receiveCurrency = receiveCurrency
          newData.exchangeRate = rate
          newData.receiveAmount = receiveAmount
          newData.productId = product.productId
          newData.serviceType = product.code
        }
      }

      return newData
    })
  }

  // Validate current step
  useEffect(() => {
    let valid = false
    switch (currentStep) {
      case 1:
        valid = !!wizardData.province && !!wizardData.municipality
        break
      case 2:
        valid = !!wizardData.productId
        break
      case 3:
        valid = wizardData.sendAmount > 0
        break
      case 4:
        valid = !!wizardData.recipientName && !!wizardData.recipientPhone
        break
      case 5:
        valid = !!wizardData.senderName
        break
      case 6:
        valid = !!wizardData.paymentMethod
        break
      case 7:
        valid = true
        break
    }
    setCanProceed(valid)
  }, [currentStep, wizardData])

  const handleNext = async () => {
    if (currentStep === 6 && canProceed) {
      // Create order on step 6
      await createOrder()
    } else if (currentStep < 7 && canProceed) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const createOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/remittance-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          province: wizardData.province,
          municipality: wizardData.municipality,
          productId: wizardData.productId,
          serviceType: wizardData.serviceType,
          sendAmount: wizardData.sendAmount,
          sendCurrency: wizardData.sendCurrency,
          receiveCurrency: wizardData.receiveCurrency,
          exchangeRate: wizardData.exchangeRate,
          deliveryFee: wizardData.deliveryFee,
          recipient: {
            name: wizardData.recipientName,
            phone: wizardData.recipientPhone,
            idNumber: wizardData.recipientIdNumber,
            address: wizardData.recipientAddress,
            neighborhood: wizardData.recipientNeighborhood,
            addressReferences: wizardData.recipientAddressReferences,
            hasAlternateContact: wizardData.hasAlternateContact,
            alternateContactName: wizardData.alternateContactName,
            alternateContactPhone: wizardData.alternateContactPhone
          },
          sender: {
            name: wizardData.senderName,
            phone: wizardData.senderPhone,
            email: wizardData.senderEmail
          },
          paymentMethod: wizardData.paymentMethod,
          paymentReference: wizardData.paymentReference,
          cashReceived: wizardData.cashReceived
        })
      })

      const data = await res.json()
      if (data.success) {
        setWizardData(prev => ({
          ...prev,
          orderNumber: data.data.orderNumber,
          orderId: data.data.id,
          estimatedDelivery: data.data.estimatedDelivery
        }))
        setCurrentStep(7)
        showNotification('success', 'Remesa Creada', `Orden ${data.data.orderNumber} creada exitosamente`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear orden')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      showNotification('error', 'Error', 'Error al crear orden')
    } finally {
      setLoading(false)
    }
  }

  const selectedMunicipalities = provinces.find(p => p.name === wizardData.province)?.municipalities || []

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Ubicacion de Entrega
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Selecciona donde se entregara el dinero en Cuba
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Provincia
                </label>
                <select
                  value={wizardData.province}
                  onChange={(e) => updateWizardData({ province: e.target.value, municipality: '' })}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border text-base transition-all focus:ring-2 focus:ring-blue-500",
                    theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  )}
                >
                  <option value="">Seleccionar provincia...</option>
                  {provinces.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              {wizardData.province && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Municipio
                  </label>
                  <select
                    value={wizardData.municipality}
                    onChange={(e) => updateWizardData({ municipality: e.target.value })}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-base transition-all focus:ring-2 focus:ring-blue-500",
                      theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    )}
                  >
                    <option value="">Seleccionar municipio...</option>
                    {selectedMunicipalities.map(m => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}

              {wizardData.municipality && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl flex items-center gap-3",
                    theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                  )}
                >
                  <Check className="w-5 h-5 text-green-600" />
                  <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                    Hay brokers disponibles en esta zona
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        )

      case 2:
        // Get icon for currency
        const getCurrencyIcon = (currency: string | null) => {
          switch (currency) {
            case 'USD': return '$'
            case 'EUR': return '€'
            case 'CUP': return '₱'
            case 'MLC': return 'M'
            default: return '$'
          }
        }

        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Tipo de Servicio
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Selecciona como quieres que reciba el dinero
              </p>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className={cn("ml-3", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Cargando productos...
                </span>
              </div>
            ) : remittanceProducts.length === 0 ? (
              <div className={cn(
                "p-6 rounded-xl border-2 border-dashed text-center",
                theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
              )}>
                <AlertCircle className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                <p className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  No hay productos de remesa configurados
                </p>
                <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  Contacta al administrador para configurar los productos
                </p>
              </div>
            ) : (
              <div className={cn(
                "grid gap-4",
                remittanceProducts.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
                remittanceProducts.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              )}>
                {remittanceProducts.map(product => {
                  const price = product.precioClientes ?? product.catalogPrecioPublico ?? 0
                  const fixedFee = product.catalogMiCostoFijo || 0
                  const isSelected = wizardData.productId === product.productId

                  return (
                    <motion.button
                      key={product.productId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateWizardData({ productId: product.productId })}
                      className={cn(
                        "p-6 rounded-xl border-2 text-center transition-all",
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <span className={cn("text-3xl font-bold block mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {getCurrencyIcon(product.currency)}
                      </span>
                      <h3 className={cn("font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {product.name}
                      </h3>
                      <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {product.pricingModel === 'percentage' ? (
                          <>
                            {price}%{fixedFee > 0 ? ` + $${fixedFee.toFixed(2)}` : ''}
                          </>
                        ) : (
                          <>
                            ${price.toFixed(2)}{fixedFee > 0 ? ` + $${fixedFee.toFixed(2)}` : ''}
                          </>
                        )}
                      </p>
                      {product.description && (
                        <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          {product.description}
                        </p>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )}

            <div className="pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wizardData.deliveryFee > 0}
                  onChange={(e) => updateWizardData({ deliveryFee: e.target.checked ? 5 : 0 })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Entrega a domicilio
                </span>
                <span className={cn("text-sm px-2 py-0.5 rounded-full", theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700')}>
                  +$5.00
                </span>
              </label>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Monto a Enviar
              </h2>
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Monto en USD
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">$</span>
                <Input
                  type="number"
                  value={wizardData.sendAmount || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value === '' ? 0 : parseFloat(value)
                    updateWizardData({ sendAmount: isNaN(numValue) ? 0 : numValue })
                  }}
                  min="0"
                  step="0.01"
                  className={cn(
                    "pl-10 text-2xl font-bold h-14 rounded-xl border-2",
                    theme === 'dark'
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-white text-gray-900 border-gray-300'
                  )}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm">Verificando disponibilidad...</span>
              </div>
            ) : availability && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-xl",
                  availability.hasAvailability
                    ? theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                    : theme === 'dark' ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <Clock className={cn("w-5 h-5", availability.hasAvailability ? 'text-green-600' : 'text-yellow-600')} />
                  <div>
                    <p className={cn(
                      "font-medium",
                      availability.hasAvailability
                        ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                    )}>
                      Entrega estimada: {availability.estimatedDelivery}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Show receive amount prominently when CUP */}
            {wizardData.receiveCurrency === 'CUP' && wizardData.exchangeRate > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-5 rounded-xl text-center",
                  theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                )}
              >
                <p className={cn("text-sm mb-1", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                  Tu familiar recibira en Cuba:
                </p>
                <p className={cn("text-3xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {wizardData.receiveAmount.toLocaleString('es-CU')} <span className="text-xl">CUP</span>
                </p>
                <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Tasa: 1 USD = {wizardData.exchangeRate.toLocaleString('es-CU')} CUP
                </p>
              </motion.div>
            )}

            <div className={cn(
              "p-5 rounded-xl space-y-3",
              theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'
            )}>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monto a enviar:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.sendAmount.toFixed(2)} USD</span>
              </div>
              {wizardData.receiveCurrency !== 'USD' && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Recibe en Cuba:</span>
                  <span className={cn("font-medium", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                    {wizardData.receiveAmount.toLocaleString('es-CU')} {wizardData.receiveCurrency}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Comision:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.serviceFee.toFixed(2)}</span>
              </div>
              {wizardData.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Entrega:</span>
                  <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className={cn("flex justify-between pt-3 border-t font-bold text-lg", theme === 'dark' ? 'border-gray-600' : 'border-gray-300')}>
                <span>TOTAL:</span>
                <span className="text-blue-600">${wizardData.totalCharged.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Datos del Destinatario
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Busca un cliente existente o ingresa los datos manualmente
              </p>
            </div>

            {/* Customer Search Section */}
            <div className={cn("p-4 rounded-xl border", theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-blue-50 border-blue-200')}>
              <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", theme === 'dark' ? 'text-gray-300' : 'text-blue-700')}>
                <Search className="w-4 h-4" />
                Buscar Cliente Existente
              </h4>

              {selectedRecipient ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "p-4 rounded-xl flex items-center justify-between",
                    theme === 'dark' ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                    )}>
                      <UserCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedRecipient.firstName} {selectedRecipient.lastName}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedRecipient.phone}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={clearSelectedRecipient}
                    variant="outline"
                    size="sm"
                    className={cn("rounded-lg", theme === 'dark' ? 'border-gray-600' : '')}
                  >
                    Cambiar
                  </Button>
                </motion.div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por telefono..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchCustomerByPhone()}
                      className={cn(
                        "pl-10 rounded-xl h-11",
                        theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                      )}
                    />
                  </div>
                  <Button
                    onClick={searchCustomerByPhone}
                    disabled={searchingCustomer || !searchPhone.trim()}
                    className={cn(
                      "rounded-xl h-11 px-4",
                      theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600',
                      'text-white'
                    )}
                  >
                    {searchingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {/* Search Results */}
              <AnimatePresence>
                {foundCustomers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 space-y-2"
                  >
                    {foundCustomers.map((customer) => (
                      <motion.button
                        key={customer.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectRecipientFromSearch(customer)}
                        className={cn(
                          "w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3",
                          theme === 'dark'
                            ? 'bg-gray-600 border-gray-500 hover:bg-gray-500'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                        )}>
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {customer.phone}
                          </p>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {foundCustomers.length === 0 && searchPhone && !searchingCustomer && (
                <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No se encontraron clientes. Ingresa los datos manualmente abajo.
                </p>
              )}
            </div>

            {/* Manual Entry Form */}
            <div className="space-y-4">
              <Input
                placeholder="Nombre completo *"
                value={wizardData.recipientName}
                onChange={(e) => updateWizardData({ recipientName: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Telefono *"
                  value={wizardData.recipientPhone}
                  onChange={(e) => updateWizardData({ recipientPhone: e.target.value })}
                  className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                />
                <Input
                  placeholder="Carnet de Identidad"
                  value={wizardData.recipientIdNumber}
                  onChange={(e) => updateWizardData({ recipientIdNumber: e.target.value })}
                  className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                />
              </div>

              <div className={cn("p-4 rounded-xl border", theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  <Home className="w-4 h-4" />
                  Direccion de Entrega en {wizardData.municipality}, {wizardData.province}
                </h4>

                {/* Show saved Cuba addresses if customer selected */}
                {selectedRecipient && recipientAddresses.length > 0 && (
                  <div className="mb-4">
                    <p className={cn("text-xs font-medium mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Direcciones guardadas en Cuba:
                    </p>
                    <div className="space-y-2">
                      {recipientAddresses.map((addr) => (
                        <motion.button
                          key={addr.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => selectRecipientAddress(addr)}
                          className={cn(
                            "w-full p-3 rounded-lg border text-left text-sm transition-all",
                            wizardData.recipientAddressId === addr.id
                              ? theme === 'dark' ? 'bg-blue-900/30 border-blue-600' : 'bg-blue-50 border-blue-400'
                              : theme === 'dark' ? 'bg-gray-600 border-gray-500 hover:bg-gray-500' : 'bg-white border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {addr.street}
                          </p>
                          <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {addr.city}, {addr.state} {addr.latitude ? '📍' : ''}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                    <div className="mt-2 text-center">
                      <button
                        onClick={() => {
                          updateWizardData({
                            recipientAddress: '',
                            recipientNeighborhood: '',
                            recipientAddressReferences: '',
                            recipientAddressId: null
                          })
                        }}
                        className={cn("text-xs", theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500')}
                      >
                        + Agregar nueva direccion
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Input
                    placeholder="Calle/Avenida con numero"
                    value={wizardData.recipientAddress}
                    onChange={(e) => updateWizardData({ recipientAddress: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                  <Input
                    placeholder="Reparto/Zona"
                    value={wizardData.recipientNeighborhood}
                    onChange={(e) => updateWizardData({ recipientNeighborhood: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={wizardData.municipality} disabled className={cn("rounded-xl h-11 opacity-70", theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 border-gray-300')} />
                    <Input value={wizardData.province} disabled className={cn("rounded-xl h-11 opacity-70", theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 border-gray-300')} />
                  </div>
                  <Input
                    placeholder="Referencias"
                    value={wizardData.recipientAddressReferences}
                    onChange={(e) => updateWizardData({ recipientAddressReferences: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />

                  {/* Map Pin Placement */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all",
                        showMap
                          ? theme === 'dark' ? 'bg-blue-900/30 border-blue-600 text-blue-400' : 'bg-blue-50 border-blue-400 text-blue-600'
                          : theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <MapPin className="w-4 h-4" />
                      {showMap ? 'Ocultar mapa' : 'Colocar pin en el mapa'}
                      {wizardData.recipientLatitude && wizardData.recipientLongitude && (
                        <span className="text-green-500 ml-1">✓</span>
                      )}
                    </button>

                    <AnimatePresence>
                      {showMap && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3">
                            <p className={cn("text-xs mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Arrastra el pin rojo o haz clic en el mapa para marcar la ubicacion exacta de entrega
                            </p>
                            <div
                              ref={mapContainerRef}
                              className="w-full h-64 rounded-xl overflow-hidden border"
                              style={{ minHeight: '256px' }}
                            />
                            {wizardData.recipientLatitude && wizardData.recipientLongitude && (
                              <p className={cn("text-xs mt-2 text-center", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                                📍 Ubicacion: {wizardData.recipientLatitude.toFixed(6)}, {wizardData.recipientLongitude.toFixed(6)}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wizardData.hasAlternateContact}
                  onChange={(e) => updateWizardData({ hasAlternateContact: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600"
                />
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Agregar contacto alternativo
                </span>
              </label>

              {wizardData.hasAlternateContact && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pl-8">
                  <Input
                    placeholder="Nombre del contacto"
                    value={wizardData.alternateContactName}
                    onChange={(e) => updateWizardData({ alternateContactName: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                  <Input
                    placeholder="Telefono del contacto"
                    value={wizardData.alternateContactPhone}
                    onChange={(e) => updateWizardData({ alternateContactPhone: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Datos del Remitente
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Busca un cliente existente o ingresa los datos manualmente
              </p>
            </div>

            {/* Sender Search Section */}
            <div className={cn("p-4 rounded-xl border", theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-blue-50 border-blue-200')}>
              <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", theme === 'dark' ? 'text-gray-300' : 'text-blue-700')}>
                <Search className="w-4 h-4" />
                Buscar Cliente Existente
              </h4>

              {selectedSender ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "p-4 rounded-xl flex items-center justify-between",
                    theme === 'dark' ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                    )}>
                      <UserCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedSender.firstName} {selectedSender.lastName}
                      </p>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedSender.phone}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={clearSelectedSender}
                    variant="outline"
                    size="sm"
                    className={cn("rounded-lg", theme === 'dark' ? 'border-gray-600' : '')}
                  >
                    Cambiar
                  </Button>
                </motion.div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por telefono..."
                      value={senderSearchPhone}
                      onChange={(e) => setSenderSearchPhone(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchSenderByPhone()}
                      className={cn(
                        "pl-10 rounded-xl h-11",
                        theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300'
                      )}
                    />
                  </div>
                  <Button
                    onClick={searchSenderByPhone}
                    disabled={searchingSender || !senderSearchPhone.trim()}
                    className={cn(
                      "rounded-xl h-11 px-4",
                      theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600',
                      'text-white'
                    )}
                  >
                    {searchingSender ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {/* Search Results */}
              <AnimatePresence>
                {foundSenders.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 space-y-2"
                  >
                    {foundSenders.map((customer) => (
                      <motion.button
                        key={customer.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectSenderFromSearch(customer)}
                        className={cn(
                          "w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3",
                          theme === 'dark'
                            ? 'bg-gray-600 border-gray-500 hover:bg-gray-500'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                        )}>
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {customer.phone}
                          </p>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {foundSenders.length === 0 && senderSearchPhone && !searchingSender && (
                <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  No se encontraron clientes. Ingresa los datos manualmente abajo.
                </p>
              )}
            </div>

            {/* Manual Entry Form */}
            <div className="space-y-4">
              <Input
                placeholder="Nombre completo *"
                value={wizardData.senderName}
                onChange={(e) => updateWizardData({ senderName: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />
              <Input
                placeholder="Telefono"
                value={wizardData.senderPhone}
                onChange={(e) => updateWizardData({ senderPhone: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />
              <Input
                placeholder="Email (opcional)"
                type="email"
                value={wizardData.senderEmail}
                onChange={(e) => updateWizardData({ senderEmail: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Metodo de Pago
              </h2>
              <p className="text-2xl font-bold mt-2 text-blue-600">
                Total: ${wizardData.totalCharged.toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {PAYMENT_METHODS.map(method => (
                <motion.button
                  key={method.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateWizardData({ paymentMethod: method.id })}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    wizardData.paymentMethod === method.id
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                      : theme === 'dark'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className={cn("text-2xl font-bold block mb-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {method.icon}
                  </span>
                  <span className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {method.name}
                  </span>
                </motion.button>
              ))}
            </div>

            {wizardData.paymentMethod === 'cash' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Efectivo recibido
                  </label>
                  <Input
                    type="number"
                    value={wizardData.cashReceived || ''}
                    onChange={(e) => updateWizardData({ cashReceived: parseFloat(e.target.value) || 0 })}
                    className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                  />
                </div>
                {wizardData.cashReceived >= wizardData.totalCharged && (
                  <div className={cn("p-4 rounded-xl text-center", theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200')}>
                    <span className={cn("text-lg font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                      Cambio: ${(wizardData.cashReceived - wizardData.totalCharged).toFixed(2)}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {(wizardData.paymentMethod === 'zelle' || wizardData.paymentMethod === 'card') && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Referencia de pago
                </label>
                <Input
                  value={wizardData.paymentReference}
                  onChange={(e) => updateWizardData({ paymentReference: e.target.value })}
                  className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                  placeholder={wizardData.paymentMethod === 'zelle' ? 'ZELLE-XXXXX' : 'Ref. Terminal'}
                />
              </motion.div>
            )}
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500"
              >
                <Check className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Orden Creada Exitosamente
              </h2>
              <p className="text-2xl font-bold mt-2 text-blue-600">
                {wizardData.orderNumber}
              </p>
            </div>

            <div className={cn("p-5 rounded-xl space-y-3", theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200')}>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Destinatario:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wizardData.recipientName}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monto enviado:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.sendAmount.toFixed(2)} USD</span>
              </div>
              {wizardData.receiveCurrency !== 'USD' && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Recibe en Cuba:</span>
                  <span className={cn("font-bold text-lg", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                    {wizardData.receiveAmount.toLocaleString('es-CU')} {wizardData.receiveCurrency}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Ubicacion:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wizardData.municipality}, {wizardData.province}</span>
              </div>
              <div className={cn("flex justify-between items-center pt-3 border-t", theme === 'dark' ? 'border-gray-600' : 'border-gray-200')}>
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Entrega estimada:</span>
                <span className="font-bold px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-500 border border-green-500/30">
                  {wizardData.estimatedDelivery}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className={cn("flex flex-col items-center gap-1 h-auto py-3 rounded-xl", theme === 'dark' ? 'border-gray-600' : '')}>
                <Phone className="w-5 h-5" />
                <span className="text-xs">SMS</span>
              </Button>
              <Button variant="outline" className={cn("flex flex-col items-center gap-1 h-auto py-3 rounded-xl", theme === 'dark' ? 'border-gray-600' : '')}>
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button variant="outline" className={cn("flex flex-col items-center gap-1 h-auto py-3 rounded-xl", theme === 'dark' ? 'border-gray-600' : '')}>
                <Printer className="w-5 h-5" />
                <span className="text-xs">Imprimir</span>
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Main Container */}
        <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

          {/* Close Button */}
          <motion.button
            onClick={() => setShowCancelModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "absolute -top-14 -right-2 sm:-top-12 sm:right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
              "transition-colors duration-200",
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            )}
          >
            <X className="w-4 h-4" />
          </motion.button>

          {/* Progress Indicator */}
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14">
                      {/* Pulsing ring for active step */}
                      {currentStep === step.id && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0, 0.5]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          style={{
                            background: theme === 'dark'
                              ? 'rgba(59, 130, 246, 0.5)'
                              : 'rgba(37, 99, 235, 0.5)'
                          }}
                        />
                      )}

                      <motion.div
                        initial={false}
                        animate={{
                          scale: currentStep === step.id ? 1.1 : 1,
                          backgroundColor: currentStep === step.id
                            ? theme === 'dark' ? '#3B82F6' : '#2563EB'
                            : currentStep > step.id
                            ? theme === 'dark' ? '#10B981' : '#059669'
                            : theme === 'dark' ? '#374151' : '#E5E7EB'
                        }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ scale: currentStep >= step.id ? 1.15 : 1.05 }}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                          "transition-shadow duration-300",
                          currentStep === step.id && (
                            theme === 'dark'
                              ? 'shadow-lg shadow-blue-500/50'
                              : 'shadow-lg shadow-blue-400/50'
                          ),
                          currentStep > step.id && (
                            theme === 'dark'
                              ? 'shadow-md shadow-green-500/30'
                              : 'shadow-md shadow-green-400/30'
                          )
                        )}
                      >
                        {currentStep > step.id ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <Check className="w-7 h-7 text-white" />
                          </motion.div>
                        ) : (
                          <step.icon className={cn(
                            "w-7 h-7",
                            currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                        )}
                      </motion.div>
                    </div>

                    <div className="mt-3 text-center">
                      <p className={cn(
                        "text-xs sm:text-sm font-semibold",
                        currentStep === step.id
                          ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          : currentStep > step.id
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {step.title}
                      </p>
                      <p className={cn(
                        "text-xs hidden sm:block mt-0.5",
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                      )}>
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                      <div className={cn(
                        "absolute inset-0 rounded-full",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                      <motion.div
                        initial={false}
                        animate={{
                          scaleX: currentStep > step.id ? 1 : 0
                        }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className={cn(
                          "h-full origin-left rounded-full",
                          theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <motion.div
            className={cn(
              "rounded-2xl border p-6 sm:p-8 shadow-lg",
              theme === 'dark'
                ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
                : 'bg-white border-gray-200 backdrop-blur-sm'
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </Button>
            </motion.div>

            {currentStep < 7 ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleNext}
                  disabled={!canProceed || loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    currentStep === 6
                      ? theme === 'dark'
                        ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30'
                        : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-400/30'
                      : theme === 'dark'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                        : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                    'text-white'
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : currentStep === 6 ? (
                    <>
                      <Check className="w-5 h-5" />
                      Confirmar Orden
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => router.push('/dashboard/admin/cupones-familiares')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30'
                      : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  <Check className="w-5 h-5" />
                  Finalizar
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Cancel Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCancelModal(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={cn(
                    "w-full max-w-md rounded-2xl shadow-2xl border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                      )}>
                        <X className={cn("w-6 h-6", theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
                      </div>
                      <div className="flex-1">
                        <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Cancelar orden?
                        </h3>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Se perdera toda la informacion ingresada y no podras recuperarla.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn("flex gap-3 p-6 pt-4 border-t", theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCancelModal(false)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                        theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      )}
                    >
                      Continuar editando
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/dashboard/admin/cupones-familiares')}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                        theme === 'dark' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                      )}
                    >
                      Si, cancelar
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
