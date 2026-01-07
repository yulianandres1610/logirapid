'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck,
  Package,
  Calendar,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  Building2,
  Phone,
  MapPin,
  FileText,
  FileUp,
  Upload,
  Sparkles,
  Edit3,
  Link2,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Scan,
  Brain,
  Zap,
  Warehouse,
  Users,
  Wand2,
  ImageIcon,
  DollarSign
} from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { VariantSelectorModal, Variant } from '@/components/market/VariantSelectorModal'
import { InvoiceUploader, InvoiceFile } from '@/components/orders/InvoiceUploader'
import { CurrencyDetectionModal } from '@/components/market/CurrencyDetectionModal'
import { MarginWarningModal } from '@/components/market/MarginWarningModal'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import {
  convertToUSD,
  convertOcrItemsToUSD,
  calculateMargin,
  isLowMargin,
  calculateHealthyPrice,
  type SupportedCurrency
} from '@/lib/currency-conversion'

interface ProductVariant {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  costPrice?: number
  stock: number
  imageUrl: string | null
}

type Step = 'method' | 'scan' | 'review-scan' | 'supplier' | 'products' | 'invoices' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

// Steps base (sin IA) - se muestran los pasos 'method' y luego los del flujo manual
const STEPS_MANUAL: WizardStep[] = [
  { id: 'method', title: 'Método', description: 'Seleccionar', icon: FileUp },
  { id: 'supplier', title: 'Proveedor', description: 'Buscar o crear', icon: Truck },
  { id: 'products', title: 'Productos', description: 'Agregar líneas', icon: Package },
  { id: 'invoices', title: 'Facturas', description: 'Adjuntar', icon: FileUp },
  { id: 'review', title: 'Revisar', description: 'Confirmar compra', icon: Check }
]

// Steps con IA - incluye scan y review-scan
const STEPS_AI: WizardStep[] = [
  { id: 'method', title: 'Método', description: 'Seleccionar', icon: FileUp },
  { id: 'scan', title: 'Escanear', description: 'Subir factura', icon: Sparkles },
  { id: 'review-scan', title: 'Revisar', description: 'Productos IA', icon: Eye },
  { id: 'supplier', title: 'Proveedor', description: 'Confirmar', icon: Truck },
  { id: 'products', title: 'Productos', description: 'Verificar', icon: Package },
  { id: 'invoices', title: 'Facturas', description: 'Adjuntar', icon: FileUp },
  { id: 'review', title: 'Revisar', description: 'Confirmar compra', icon: Check }
]

// Interface para productos escaneados por IA
interface ScannedItem {
  id: string
  name: string
  quantity: number
  unitOfMeasure: string
  unitCost: number
  totalCost: number
  sku: string | null
  barcode: string | null
  description: string | null
  isVariantOf: string | null
}

// Interface para datos escaneados de la factura
interface ScannedInvoice {
  vendorName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  items: ScannedItem[]
  subtotal: number
  tax: number
  total: number
  confidence: number
  // Currency conversion fields (optional)
  originalCurrency?: SupportedCurrency
  originalTotal?: number
  conversionRate?: number
}

// Interface para productos con match
interface MatchedItem extends ScannedItem {
  matchType: 'barcode' | 'sku' | 'exact_name' | 'fuzzy_name' | 'variant' | 'none'
  matchedProduct: {
    id: number
    name: string
    sku: string | null
    barcode: string | null
    costPrice: number
    sellingPrice: number
    hasVariants: boolean
    imageUrl: string | null
    categoryId: number | null
    categoryName: string | null
  } | null
  matchedVariant: {
    id: number
    name: string
    sku: string
    barcode: string | null
    costPrice: number
    price: number
  } | null
  suggestedMatches: Array<{
    id: number
    name: string
    sku: string | null
    similarity: number
  }>
  confidence: number
  // Acción del usuario
  action: 'use_existing' | 'create_new' | 'link_to' | 'ignore'
  linkedProductId?: number
  // Precio de venta sugerido para productos nuevos (editable)
  suggestedSellingPrice?: number
  // Imagen y descripción generadas con IA
  generatedImageUrl?: string
  generatedImageBase64?: string // Raw base64 para guardar en S3 al crear producto
  generatedDescription?: string
  isGeneratingImage?: boolean
  isCleaningImage?: boolean
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

interface Supplier {
  id: number
  supplierCode: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  fullAddress: string
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  quantityOnHand: number
  hasVariants?: boolean
  variants?: ProductVariant[]
  isNewProduct?: boolean
  generatedImageBase64?: string // Para productos nuevos creados con OCR + IA
  isVariantOf?: string | null // Nombre del producto base si es variante (detectado por IA)
}

interface PurchaseLine {
  productId: number
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  product: Product
  quantity: number
  unitPrice: number
  totalPrice: number
  isNewProduct?: boolean
  generatedImageBase64?: string // Para productos nuevos creados con OCR + IA
  isVariantOf?: string | null // Nombre del producto base si es variante
}

export default function CreatePurchasePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Exchange rates for currency conversion
  const { USD_CUP, USD_MLC, timestamp: ratesTimestamp } = useMarketExchangeRates()

  // Currency detection modal state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [pendingOcrData, setPendingOcrData] = useState<{
    data: ScannedInvoice
    detectedCurrency: SupportedCurrency | null
    currencyHints: string | null
  } | null>(null)

  // Margin warning modal state
  const [showMarginWarning, setShowMarginWarning] = useState(false)
  const [lowMarginItems, setLowMarginItems] = useState<Array<{
    name: string
    costPrice: number
    sellingPrice: number
    margin: number
    suggestedPrice: number
  }>>([])
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null)

  // Read initial step from URL (validate it's a valid step)
  const validSteps: Step[] = ['method', 'scan', 'review-scan', 'supplier', 'products', 'invoices', 'review']
  const urlStep = searchParams.get('step') as Step
  const initialStep = urlStep && validSteps.includes(urlStep) ? urlStep : 'method'
  const [currentStep, setCurrentStep] = useState<Step>(initialStep)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Sync step with URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', currentStep)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [currentStep, pathname, router, searchParams])

  // Método de entrada (IA o manual)
  const [entryMethod, setEntryMethod] = useState<'ai' | 'manual' | null>(null)

  // Step: Scan (IA)
  const [invoiceFileBase64, setInvoiceFileBase64] = useState<string | null>(null)
  const [invoiceFileName, setInvoiceFileName] = useState<string>('')
  const [aiContext, setAiContext] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [ocrStep, setOcrStep] = useState(0)

  // OCR step animation - pasos de escaneo con iconos
  const ocrSteps = [
    { icon: Scan, text: 'Escaneando documento...' },
    { icon: Brain, text: 'Analizando contenido con IA...' },
    { icon: FileText, text: 'Extrayendo productos...' },
    { icon: Zap, text: 'Identificando coincidencias...' },
  ]

  // Ciclar los pasos de animación durante el escaneo
  useEffect(() => {
    if (isScanning) {
      setOcrStep(0)
      const interval = setInterval(() => {
        setOcrStep(prev => (prev + 1) % ocrSteps.length)
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [isScanning])

  // Step: Review Scan (IA)
  const [scannedData, setScannedData] = useState<ScannedInvoice | null>(null)
  const [matchedProducts, setMatchedProducts] = useState<MatchedItem[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<Product[]>([])
  const [searchingLink, setSearchingLink] = useState(false)

  // Steps dinámicos basados en método
  const STEPS = entryMethod === 'ai' ? STEPS_AI : STEPS_MANUAL

  // Step: Supplier & Warehouse (same as consignments)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<{ id: number; code: string; name: string }[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<{ id: number; code: string; name: string } | null>(null)
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false)
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: ''
  })
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  // Step 2: Products
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)

  // Step 4: Invoices
  const [invoiceFiles, setInvoiceFiles] = useState<InvoiceFile[]>([])

  // Step 5: Review
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('USD')

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load suppliers and warehouses on mount (same as consignments)
  useEffect(() => {
    const fetchData = async () => {
      setLoadingSuppliers(true)
      try {
        const [suppliersRes, warehousesRes] = await Promise.all([
          fetch('/api/market/suppliers?limit=100'),
          fetch('/api/market/warehouses')
        ])

        if (suppliersRes.ok) {
          const data = await suppliersRes.json()
          console.log('[Purchase] Loaded suppliers:', data)
          if (data.success) {
            // API returns data.data.suppliers
            const suppliersList = data.data?.suppliers || data.data || []
            // Map API response to expected Supplier interface
            const mappedSuppliers = suppliersList.map((s: { id: number; supplier_code?: string; supplierCode?: string; name: string; phone?: string | null; email?: string | null; address?: string | null; city?: string | null; state?: string | null }) => ({
              id: s.id,
              supplierCode: s.supplier_code || s.supplierCode || '',
              name: s.name,
              phone: s.phone || null,
              email: s.email || null,
              address: s.address || null,
              city: s.city || null,
              state: s.state || null,
              fullAddress: [s.address, s.city, s.state].filter(Boolean).join(', ')
            }))
            console.log('[Purchase] Mapped suppliers:', mappedSuppliers.length)
            setSuppliers(mappedSuppliers)
          }
        }

        if (warehousesRes.ok) {
          const data = await warehousesRes.json()
          if (data.success) setWarehouses(data.data.warehouses || data.data || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    fetchData()
  }, [])

  // Filter suppliers locally with flexible matching
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers

    const normalize = (str: string) => str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()

    const normalizedSearch = normalize(supplierSearch)
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1)

    return suppliers.filter(s => {
      const normalizedName = normalize(s.name)
      const normalizedCode = s.supplierCode ? normalize(s.supplierCode) : ''

      // Strategy 1: Direct inclusion
      if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) return true
      if (normalizedCode.includes(normalizedSearch)) return true

      // Strategy 2: Word matching - if any search word is found in supplier name
      const supplierWords = normalizedName.split(/\s+/)
      const matchedWords = searchWords.filter(sw =>
        supplierWords.some(supW => supW.includes(sw) || sw.includes(supW))
      )
      if (searchWords.length > 0 && matchedWords.length > 0) return true

      return false
    })
  }, [suppliers, supplierSearch])

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductResults([])
      return
    }
    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(query)}&limit=20`)
      const data = await response.json()
      if (data.success) {
        setProductResults(data.data.products || [])
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) {
        searchProducts(productSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Compress image to reduce file size (Vercel has 4.5MB limit for serverless functions)
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Target: max 1200px width for OCR (still very readable)
          const maxWidth = 1200
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }

          // Also limit height to 1600px
          const maxHeight = 1600
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)

          // Start with 65% quality, reduce if still too large
          let quality = 0.65
          let compressedBase64 = canvas.toDataURL('image/jpeg', quality)

          // Target: under 3MB to stay well within Vercel's 4.5MB limit
          while (compressedBase64.length > 3 * 1024 * 1024 && quality > 0.3) {
            quality -= 0.1
            compressedBase64 = canvas.toDataURL('image/jpeg', quality)
          }

          // If still too large, reduce dimensions further
          if (compressedBase64.length > 3 * 1024 * 1024) {
            const scale = 0.6
            canvas.width = Math.round(width * scale)
            canvas.height = Math.round(height * scale)
            const ctx2 = canvas.getContext('2d')
            if (ctx2) {
              ctx2.drawImage(img, 0, 0, canvas.width, canvas.height)
              compressedBase64 = canvas.toDataURL('image/jpeg', 0.5)
            }
          }

          console.log('[Purchase AI] Image compressed:', {
            originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            compressedSize: `${(compressedBase64.length / 1024 / 1024).toFixed(2)}MB`,
            originalDimensions: `${img.width}x${img.height}`,
            newDimensions: `${Math.round(canvas.width)}x${Math.round(canvas.height)}`,
            quality: quality.toFixed(2)
          })
          resolve(compressedBase64)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target?.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [])

  // Handle file upload for AI scan
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setScanError('Formato no soportado. Usa JPG, PNG, WebP o PDF.')
      return
    }

    setScanError(null)
    setInvoiceFileName(file.name)

    // For images, compress before storing
    if (file.type.startsWith('image/')) {
      try {
        const compressedBase64 = await compressImage(file)
        setInvoiceFileBase64(compressedBase64)
      } catch (error) {
        console.error('Error compressing image:', error)
        // Fallback to original file
        const reader = new FileReader()
        reader.onload = () => {
          setInvoiceFileBase64(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    } else {
      // For PDFs, read directly
      const reader = new FileReader()
      reader.onload = () => {
        setInvoiceFileBase64(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [compressImage])

  // Process invoice with AI (OCR)
  const processInvoiceWithAI = useCallback(async () => {
    if (!invoiceFileBase64) return

    setIsScanning(true)
    setScanError(null)

    // Create AbortController with 2 minute timeout for large images
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    try {
      console.log('[Purchase AI] Starting OCR request...', {
        hasContext: !!aiContext,
        contextLength: aiContext?.length || 0,
        base64Length: invoiceFileBase64.length
      })

      const response = await fetch('/api/market/purchases/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: invoiceFileBase64,
          userContext: aiContext || undefined
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Purchase AI] HTTP error:', response.status, errorText)
        setScanError(`Error del servidor (${response.status}). Intenta de nuevo.`)
        return
      }

      const data = await response.json()

      if (data.success) {
        console.log('[Purchase AI] OCR result:', data.data)
        console.log('[Purchase AI] Items received:', data.data.items)
        console.log('[Purchase AI] Items count:', data.data.items?.length || 0)
        console.log('[Purchase AI] Currency detection:', data.data.detectedCurrency, data.data.currencyConfidence, data.data.currencyHints)

        // Check if currency was detected
        const detectedCurrency = data.data.detectedCurrency as SupportedCurrency | null
        const currencyHints = data.data.currencyHints

        if (detectedCurrency === null) {
          // Currency not detected - show modal to ask user
          console.log('[Purchase AI] Currency not detected, showing modal')
          setPendingOcrData({
            data: data.data,
            detectedCurrency: null,
            currencyHints
          })
          setShowCurrencyModal(true)
          setIsScanning(false)
          return
        }

        // Currency detected - process with conversion if needed
        let processedData = data.data
        if (detectedCurrency !== 'USD') {
          console.log('[Purchase AI] Converting from', detectedCurrency, 'to USD')
          const rates = { USD_CUP, USD_MLC }
          const convertedItems = convertOcrItemsToUSD(data.data.items, detectedCurrency, rates)
          const totalConversion = convertToUSD(data.data.total, detectedCurrency, rates)
          const subtotalConversion = convertToUSD(data.data.subtotal, detectedCurrency, rates)
          const taxConversion = convertToUSD(data.data.tax, detectedCurrency, rates)

          processedData = {
            ...data.data,
            items: convertedItems,
            total: totalConversion.convertedAmount,
            subtotal: subtotalConversion.convertedAmount,
            tax: taxConversion.convertedAmount,
            originalCurrency: detectedCurrency,
            originalTotal: data.data.total,
            conversionRate: totalConversion.rate
          }
          console.log('[Purchase AI] Converted totals:', {
            original: data.data.total,
            converted: processedData.total,
            rate: totalConversion.rate
          })
        }

        setScannedData(processedData)

        // Now match the products
        if (processedData.items && processedData.items.length > 0) {
          await matchScannedProducts(processedData.items)
        } else {
          console.warn('[Purchase AI] No items received from OCR!')
          setMatchedProducts([])
        }

        // Move to review-scan step
        setCurrentStep('review-scan')
      } else {
        setScanError(data.error || 'Error al procesar la factura')
      }
    } catch (error) {
      clearTimeout(timeoutId)
      console.error('Error processing invoice:', error)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setScanError('La solicitud tardó demasiado. Intenta con una imagen más pequeña.')
        } else {
          setScanError(`Error: ${error.message}`)
        }
      } else {
        setScanError('Error de conexión al procesar la factura. Verifica tu conexión a internet.')
      }
    } finally {
      setIsScanning(false)
    }
  }, [invoiceFileBase64, aiContext, USD_CUP, USD_MLC])

  // Match scanned products against database
  const matchScannedProducts = useCallback(async (items: ScannedItem[]) => {
    setIsMatching(true)

    try {
      const response = await fetch('/api/market/products/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })

      const data = await response.json()

      if (data.success) {
        // Transform matched items with default actions
        const matched: MatchedItem[] = data.data.matchedItems.map((item: {
          inputItem: ScannedItem
          matchType: MatchedItem['matchType']
          matchedProduct: MatchedItem['matchedProduct']
          matchedVariant: MatchedItem['matchedVariant']
          suggestedMatches: MatchedItem['suggestedMatches']
          confidence: number
        }) => ({
          ...item.inputItem,
          matchType: item.matchType,
          matchedProduct: item.matchedProduct,
          matchedVariant: item.matchedVariant,
          suggestedMatches: item.suggestedMatches || [],
          confidence: item.confidence,
          // Default action based on match type
          action: item.matchType !== 'none' ? 'use_existing' : 'create_new',
          // Precio de venta sugerido: 4% arriba del costo para productos nuevos
          suggestedSellingPrice: item.matchType === 'none'
            ? Math.round(item.inputItem.unitCost * 1.04 * 100) / 100
            : undefined
        }))

        setMatchedProducts(matched)
        console.log('[Purchase AI] Match results:', matched)
      }
    } catch (error) {
      console.error('Error matching products:', error)
    } finally {
      setIsMatching(false)
    }
  }, [])

  // Handle currency confirmation from modal
  const handleCurrencyConfirm = useCallback(async (selectedCurrency: SupportedCurrency) => {
    if (!pendingOcrData) return

    setShowCurrencyModal(false)
    setIsScanning(true)

    try {
      let processedData = pendingOcrData.data

      if (selectedCurrency !== 'USD') {
        console.log('[Purchase AI] User selected currency:', selectedCurrency, '- Converting to USD')
        const rates = { USD_CUP, USD_MLC }
        const convertedItems = convertOcrItemsToUSD(pendingOcrData.data.items, selectedCurrency, rates)
        const totalConversion = convertToUSD(pendingOcrData.data.total, selectedCurrency, rates)
        const subtotalConversion = convertToUSD(pendingOcrData.data.subtotal, selectedCurrency, rates)
        const taxConversion = convertToUSD(pendingOcrData.data.tax, selectedCurrency, rates)

        processedData = {
          ...pendingOcrData.data,
          items: convertedItems,
          total: totalConversion.convertedAmount,
          subtotal: subtotalConversion.convertedAmount,
          tax: taxConversion.convertedAmount,
          originalCurrency: selectedCurrency,
          originalTotal: pendingOcrData.data.total,
          conversionRate: totalConversion.rate
        }
        console.log('[Purchase AI] Converted totals:', {
          original: pendingOcrData.data.total,
          converted: processedData.total,
          currency: selectedCurrency,
          rate: totalConversion.rate
        })
      }

      setScannedData(processedData)

      // Now match the products
      if (processedData.items && processedData.items.length > 0) {
        await matchScannedProducts(processedData.items)
      } else {
        setMatchedProducts([])
      }

      // Move to review-scan step
      setCurrentStep('review-scan')
    } finally {
      setIsScanning(false)
      setPendingOcrData(null)
    }
  }, [pendingOcrData, USD_CUP, USD_MLC, matchScannedProducts])

  // Handle product action change
  const handleProductAction = useCallback((itemId: string, action: MatchedItem['action'], linkedProductId?: number) => {
    setMatchedProducts(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, action, linkedProductId }
      }
      return item
    }))
  }, [])

  // Update matched product fields (name, unitCost, suggestedSellingPrice)
  const handleUpdateMatchedProduct = useCallback((
    itemId: string,
    field: 'name' | 'unitCost' | 'suggestedSellingPrice' | 'quantity',
    value: string | number
  ) => {
    setMatchedProducts(prev => prev.map(item => {
      if (item.id === itemId) {
        if (field === 'name') {
          return { ...item, name: value as string }
        } else if (field === 'unitCost') {
          const newCost = typeof value === 'string' ? parseFloat(value) || 0 : value
          const newTotal = newCost * item.quantity
          // Recalcular precio de venta sugerido (4% arriba del nuevo costo)
          const newSellingPrice = Math.round(newCost * 1.04 * 100) / 100
          return {
            ...item,
            unitCost: newCost,
            totalCost: newTotal,
            suggestedSellingPrice: newSellingPrice
          }
        } else if (field === 'suggestedSellingPrice') {
          const newPrice = typeof value === 'string' ? parseFloat(value) || 0 : value
          return { ...item, suggestedSellingPrice: newPrice }
        } else if (field === 'quantity') {
          const newQty = typeof value === 'string' ? parseFloat(value) || 0 : value
          const newTotal = item.unitCost * newQty
          return { ...item, quantity: newQty, totalCost: newTotal }
        }
      }
      return item
    }))
  }, [])

  // Generate image and description with AI for a product
  const generateImageWithAI = useCallback(async (itemId: string) => {
    const item = matchedProducts.find(p => p.id === itemId)
    if (!item) return

    // Mark as generating
    setMatchedProducts(prev => prev.map(p =>
      p.id === itemId ? { ...p, isGeneratingImage: true } : p
    ))

    try {
      console.log('[Purchase] Generating AI image for:', item.name)

      const response = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          productName: item.name,
          productDescription: item.description || `Producto: ${item.name}`,
          saveToStorage: false // Guardamos después cuando se cree el producto
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        console.log('[Purchase] AI image generated successfully')
        // Extraer base64 de la URL si viene como data URL
        const imageBase64 = data.data.imageBase64?.replace(/^data:image\/\w+;base64,/, '') || null
        setMatchedProducts(prev => prev.map(p =>
          p.id === itemId ? {
            ...p,
            generatedImageUrl: data.data.imageBase64 || data.data.imageUrl,
            generatedImageBase64: imageBase64,
            generatedDescription: data.data.imageDescription,
            isGeneratingImage: false
          } : p
        ))
      } else {
        console.error('[Purchase] AI image generation failed:', data.error)
        setMatchedProducts(prev => prev.map(p =>
          p.id === itemId ? { ...p, isGeneratingImage: false } : p
        ))
      }
    } catch (error) {
      console.error('[Purchase] Error generating AI image:', error)
      setMatchedProducts(prev => prev.map(p =>
        p.id === itemId ? { ...p, isGeneratingImage: false } : p
      ))
    }
  }, [matchedProducts])

  // Upload image and clean it with AI (remove background)
  const uploadAndCleanImage = useCallback(async (itemId: string, file: File) => {
    const item = matchedProducts.find(p => p.id === itemId)
    if (!item || !file) return

    // Mark as cleaning
    setMatchedProducts(prev => prev.map(p =>
      p.id === itemId ? { ...p, isCleaningImage: true } : p
    ))

    try {
      console.log('[Purchase] Uploading and cleaning image for:', item.name)

      // Convert file to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
      })
      reader.readAsDataURL(file)
      const base64Data = await base64Promise

      const response = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clean',
          imageBase64: base64Data,
          productName: item.name,
          saveToStorage: false
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        console.log('[Purchase] Image cleaned successfully')
        const cleanedBase64 = data.data.imageBase64 || base64Data.replace(/^data:image\/\w+;base64,/, '')
        setMatchedProducts(prev => prev.map(p =>
          p.id === itemId ? {
            ...p,
            generatedImageUrl: cleanedBase64.startsWith('data:') ? cleanedBase64 : `data:image/png;base64,${cleanedBase64}`,
            generatedImageBase64: cleanedBase64.replace(/^data:image\/\w+;base64,/, ''),
            generatedDescription: 'Imagen limpiada con IA',
            isCleaningImage: false
          } : p
        ))
      } else {
        console.error('[Purchase] Image cleaning failed:', data.error)
        // Si falla la limpieza, usar la imagen original
        const originalBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')
        setMatchedProducts(prev => prev.map(p =>
          p.id === itemId ? {
            ...p,
            generatedImageUrl: base64Data,
            generatedImageBase64: originalBase64,
            generatedDescription: 'Imagen subida (sin limpiar)',
            isCleaningImage: false
          } : p
        ))
      }
    } catch (error) {
      console.error('[Purchase] Error uploading/cleaning image:', error)
      setMatchedProducts(prev => prev.map(p =>
        p.id === itemId ? { ...p, isCleaningImage: false } : p
      ))
    }
  }, [matchedProducts])

  // Search products for linking
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (linkSearch.length >= 2) {
        setSearchingLink(true)
        try {
          const response = await fetch(`/api/market/products?search=${encodeURIComponent(linkSearch)}&limit=10`)
          const data = await response.json()
          if (data.success) {
            setLinkResults(data.data.products || [])
          }
        } catch (error) {
          console.error('Error searching products for link:', error)
        } finally {
          setSearchingLink(false)
        }
      } else {
        setLinkResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [linkSearch])

  // Generate images for all new products
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false)
  const generateAllImages = useCallback(async () => {
    const newProducts = matchedProducts.filter(p => p.action === 'create_new' && !p.generatedImageBase64)
    if (newProducts.length === 0) return

    setIsGeneratingAllImages(true)
    console.log('[Purchase] Generating images for', newProducts.length, 'products')

    for (const item of newProducts) {
      try {
        setMatchedProducts(prev => prev.map(p =>
          p.id === item.id ? { ...p, isGeneratingImage: true } : p
        ))

        const response = await fetch('/api/ai/process-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            productName: item.name,
            productDescription: `Producto: ${item.name}`,
            saveToStorage: false
          })
        })

        const data = await response.json()

        if (data.success && data.data) {
          const imageBase64 = data.data.imageBase64?.replace(/^data:image\/\w+;base64,/, '') || null
          setMatchedProducts(prev => prev.map(p =>
            p.id === item.id ? {
              ...p,
              generatedImageUrl: data.data.imageBase64 || data.data.imageUrl,
              generatedImageBase64: imageBase64,
              isGeneratingImage: false
            } : p
          ))
        } else {
          setMatchedProducts(prev => prev.map(p =>
            p.id === item.id ? { ...p, isGeneratingImage: false } : p
          ))
        }
      } catch (error) {
        console.error('[Purchase] Error generating image for:', item.name, error)
        setMatchedProducts(prev => prev.map(p =>
          p.id === item.id ? { ...p, isGeneratingImage: false } : p
        ))
      }
    }

    setIsGeneratingAllImages(false)
  }, [matchedProducts])

  // Confirm scanned products and move to supplier step
  const confirmScannedProducts = useCallback(async () => {
    // Filter products that are not ignored
    const activeProducts = matchedProducts.filter(p => p.action !== 'ignore')

    if (activeProducts.length === 0) {
      setScanError('Debes incluir al menos un producto')
      return
    }

    // Create purchase lines from matched products
    const newLines: PurchaseLine[] = []

    for (const item of activeProducts) {
      if (item.action === 'use_existing' && item.matchedProduct) {
        // Use existing product
        const product: Product = {
          id: item.matchedProduct.id,
          name: item.matchedProduct.name,
          sku: item.matchedProduct.sku || '',
          barcode: item.matchedProduct.barcode,
          imageUrl: item.matchedProduct.imageUrl,
          costPrice: item.matchedProduct.costPrice,
          sellingPrice: item.matchedProduct.sellingPrice,
          currency: 'USD',
          quantityOnHand: 0,
          hasVariants: item.matchedProduct.hasVariants
        }

        if (item.matchedVariant) {
          // Use matched variant
          newLines.push({
            productId: item.matchedProduct.id,
            variantId: item.matchedVariant.id,
            variantName: item.matchedVariant.name,
            variantSku: item.matchedVariant.sku,
            product,
            quantity: item.quantity,
            unitPrice: item.unitCost,
            totalPrice: item.totalCost
          })
        } else {
          // Use main product
          newLines.push({
            productId: item.matchedProduct.id,
            variantId: null,
            variantName: null,
            variantSku: null,
            product,
            quantity: item.quantity,
            unitPrice: item.unitCost,
            totalPrice: item.totalCost
          })
        }
      } else if (item.action === 'link_to' && item.linkedProductId) {
        // Fetch the linked product
        try {
          const response = await fetch(`/api/market/products/${item.linkedProductId}`)
          const data = await response.json()
          if (data.success && data.data) {
            const linkedProduct = data.data
            newLines.push({
              productId: linkedProduct.id,
              variantId: null,
              variantName: null,
              variantSku: null,
              product: {
                id: linkedProduct.id,
                name: linkedProduct.name,
                sku: linkedProduct.sku || '',
                barcode: linkedProduct.barcode,
                imageUrl: linkedProduct.imageUrl,
                costPrice: linkedProduct.costPrice,
                sellingPrice: linkedProduct.sellingPrice,
                currency: linkedProduct.currency || 'USD',
                quantityOnHand: linkedProduct.quantityOnHand || 0,
                hasVariants: linkedProduct.hasVariants
              },
              quantity: item.quantity,
              unitPrice: item.unitCost,
              totalPrice: item.totalCost
            })
          }
        } catch (error) {
          console.error('Error fetching linked product:', error)
        }
      } else if (item.action === 'create_new') {
        // Producto nuevo - crear producto temporal para agregar a la orden
        // Usar precio de venta editado o calcular 4% arriba del costo
        const sellingPrice = item.suggestedSellingPrice || Math.round(item.unitCost * 1.04 * 100) / 100
        const tempProduct: Product = {
          id: -Date.now() - newLines.length,
          name: item.name,
          sku: item.sku || '',
          barcode: item.barcode,
          imageUrl: item.generatedImageUrl || null, // Usar imagen generada si existe
          costPrice: item.unitCost,
          sellingPrice: sellingPrice,
          currency: 'USD',
          quantityOnHand: 0,
          hasVariants: false,
          isNewProduct: true,
          generatedImageBase64: item.generatedImageBase64, // Guardar base64 para S3
          isVariantOf: item.isVariantOf || null // Guardar si es variante
        }

        newLines.push({
          productId: tempProduct.id,
          variantId: null,
          variantName: null,
          variantSku: null,
          product: tempProduct,
          quantity: item.quantity,
          unitPrice: item.unitCost,
          totalPrice: item.totalCost,
          isNewProduct: true,
          generatedImageBase64: item.generatedImageBase64, // Pasar base64 para la API
          isVariantOf: item.isVariantOf || null
        })
      }
    }

    console.log('[Purchase] Order lines created:', newLines.length)

    // Set purchase lines
    setPurchaseLines(newLines)

    // Pre-fill supplier if detected - improved matching algorithm (same as consignments)
    if (scannedData?.vendorName) {
      const vendorName = scannedData.vendorName
      console.log('[Purchase] Trying to match vendor:', vendorName)
      console.log('[Purchase] Available suppliers:', suppliers.map(s => s.name))

      // Normalize function: remove accents, special chars, extra spaces
      const normalize = (str: string) => str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9\s]/g, ' ') // replace special chars with space
        .replace(/\s+/g, ' ') // collapse multiple spaces
        .trim()

      const normalizedVendor = normalize(vendorName)
      const vendorWords = normalizedVendor.split(' ').filter(w => w.length > 2)

      // Try multiple matching strategies
      const matchingSupplier = suppliers.find(s => {
        const normalizedSupplier = normalize(s.name)

        // Strategy 1: Exact match after normalization
        if (normalizedSupplier === normalizedVendor) return true

        // Strategy 2: One contains the other
        if (normalizedSupplier.includes(normalizedVendor) || normalizedVendor.includes(normalizedSupplier)) return true

        // Strategy 3: Key words match (at least 60% of vendor words found in supplier)
        const supplierWords = normalizedSupplier.split(' ').filter(w => w.length > 2)
        const matchedWords = vendorWords.filter(vw =>
          supplierWords.some(sw => sw.includes(vw) || vw.includes(sw))
        )
        if (vendorWords.length > 0 && matchedWords.length / vendorWords.length >= 0.6) return true

        return false
      })

      if (matchingSupplier) {
        console.log('[Purchase] Auto-matched supplier:', matchingSupplier.name, 'from', vendorName)
        setSelectedSupplier(matchingSupplier)
      } else {
        console.log('[Purchase] No matching supplier found for:', vendorName, '- Normalized:', normalizedVendor)
        // Pre-fill search with detected vendor name so user can see results immediately
        setSupplierSearch(vendorName)
      }
    }

    // Pre-fill purchase date if detected
    if (scannedData?.invoiceDate) {
      setPurchaseDate(scannedData.invoiceDate)
    }

    // Add scanned invoice to invoice files automatically
    if (invoiceFileBase64 && invoiceFileName) {
      const isPdf = invoiceFileBase64.startsWith('data:application/pdf')
      const newInvoiceFile: InvoiceFile = {
        id: `scanned-${Date.now()}`,
        name: invoiceFileName,
        preview: invoiceFileBase64,
        type: isPdf ? 'application/pdf' : 'image/jpeg',
        size: Math.round(invoiceFileBase64.length * 0.75),
        uploaded: true,
        uploadedAt: new Date().toISOString()
      }
      setInvoiceFiles(prev => {
        // Avoid duplicates
        if (prev.some(f => f.name === invoiceFileName)) return prev
        return [...prev, newInvoiceFile]
      })
    }

    // Move to supplier step
    setCurrentStep('supplier')
  }, [matchedProducts, scannedData, suppliers, invoiceFileBase64, invoiceFileName])

  // Reset AI scan data
  const resetAIScan = useCallback(() => {
    setInvoiceFileBase64(null)
    setInvoiceFileName('')
    setAiContext('')
    setScannedData(null)
    setMatchedProducts([])
    setScanError(null)
  }, [])

  // Create new supplier
  const handleCreateSupplier = async () => {
    if (!newSupplierData.name.trim()) return
    setCreatingSupplier(true)
    try {
      const response = await fetch('/api/market/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplierData)
      })
      const data = await response.json()
      if (data.success) {
        setSelectedSupplier({
          id: data.data.id,
          supplierCode: data.data.supplierCode,
          name: newSupplierData.name,
          phone: newSupplierData.phone || null,
          email: null,
          address: newSupplierData.address || null,
          city: newSupplierData.city || null,
          state: newSupplierData.state || null,
          fullAddress: [newSupplierData.address, newSupplierData.city, newSupplierData.state].filter(Boolean).join(', ')
        })
        setShowNewSupplierModal(false)
        setNewSupplierData({ name: '', phone: '', address: '', city: '', state: '' })
        setSupplierSearch('')
      }
    } catch (error) {
      console.error('Error creating supplier:', error)
    } finally {
      setCreatingSupplier(false)
    }
  }

  // Add product to purchase (with optional variant)
  const addProductToPurchase = (product: Product, variant?: ProductVariant | null) => {
    const variantId = variant?.id ?? null
    const unitPrice = variant?.costPrice ?? variant?.price ?? product.costPrice

    // Find existing line by product.id + variant.id combination
    const existing = purchaseLines.find(l =>
      l.productId === product.id && l.variantId === variantId
    )

    if (existing) {
      setPurchaseLines(prev => prev.map(l =>
        l.productId === product.id && l.variantId === variantId
          ? { ...l, quantity: l.quantity + 1, totalPrice: (l.quantity + 1) * l.unitPrice }
          : l
      ))
    } else {
      setPurchaseLines(prev => [...prev, {
        productId: product.id,
        variantId,
        variantName: variant?.name ?? null,
        variantSku: variant?.sku ?? null,
        product,
        quantity: 1,
        unitPrice: unitPrice,
        totalPrice: unitPrice
      }])
    }
    setProductSearch('')
    setProductResults([])
    setShowProductModal(false)
    setShowVariantModal(false)
    setSelectedProductForVariant(null)
  }

  // Handle product click - show variant modal if product has variants
  const handleProductClick = (product: Product) => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setSelectedProductForVariant(product)
      setShowVariantModal(true)
    } else {
      addProductToPurchase(product, null)
    }
  }

  // Handle variant selection from modal
  const handleVariantSelect = (variant: Variant) => {
    if (selectedProductForVariant) {
      const productVariant: ProductVariant = {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        costPrice: variant.costPrice,
        stock: variant.stock,
        imageUrl: variant.imageUrl
      }
      addProductToPurchase(selectedProductForVariant, productVariant)
    }
  }

  // Update line quantity
  const updateLineQuantity = (productId: number, variantId: number | null, quantity: number) => {
    if (quantity < 1) return
    setPurchaseLines(prev => prev.map(l =>
      l.productId === productId && l.variantId === variantId
        ? { ...l, quantity, totalPrice: quantity * l.unitPrice }
        : l
    ))
  }

  // Update line price
  const updateLinePrice = (productId: number, variantId: number | null, unitPrice: number) => {
    if (unitPrice < 0) return
    setPurchaseLines(prev => prev.map(l =>
      l.productId === productId && l.variantId === variantId
        ? { ...l, unitPrice, totalPrice: l.quantity * unitPrice }
        : l
    ))
  }

  // Remove line
  const removeLine = (productId: number, variantId: number | null) => {
    setPurchaseLines(prev => prev.filter(l => !(l.productId === productId && l.variantId === variantId)))
  }

  // Calculate totals
  const subtotal = purchaseLines.reduce((sum, l) => sum + l.totalPrice, 0)
  const tax = 0
  const total = subtotal + tax

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'supplier':
        if (!selectedSupplier) newErrors.supplier = 'Selecciona un proveedor'
        if (!selectedWarehouse) newErrors.warehouse = 'Selecciona un almacen destino'
        break
      case 'products':
        if (purchaseLines.length === 0) newErrors.products = 'Agrega al menos un producto'
        break
      case 'review':
        if (!purchaseDate) newErrors.purchaseDate = 'La fecha de compra es requerida'
        break
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  // Submit purchase
  const handleSubmit = async () => {
    if (!validateStep('review')) return
    setLoading(true)
    try {
      // Preparar los productos nuevos que necesitan ser creados
      // Agrupar variantes bajo su producto base
      const newProductLines = purchaseLines.filter(l => l.isNewProduct && l.productId < 0)

      // Separar productos base de variantes
      const standaloneProducts = newProductLines.filter(l => !l.isVariantOf)
      const variantLines = newProductLines.filter(l => l.isVariantOf)

      // Agrupar variantes por nombre de producto base
      const variantGroups = new Map<string, typeof variantLines>()
      for (const line of variantLines) {
        const baseName = line.isVariantOf!
        if (!variantGroups.has(baseName)) {
          variantGroups.set(baseName, [])
        }
        variantGroups.get(baseName)!.push(line)
      }

      // Crear productos standalone (sin variantes)
      const newProducts: Array<{
        tempId: number
        name: string
        sku: string | null
        barcode: string | null
        unitCost: number
        sellingPrice: number
        category: string
        imageBase64: string | null
        hasVariants?: boolean
        variants?: Array<{
          tempId: number
          name: string
          sku: string | null
          barcode: string | null
          unitCost: number
          sellingPrice: number
        }>
      }> = standaloneProducts.map(l => ({
        tempId: l.productId,
        name: l.product.name,
        sku: l.product.sku || null,
        barcode: l.product.barcode || null,
        unitCost: l.unitPrice,
        sellingPrice: l.product.sellingPrice || l.unitPrice * 1.04,
        category: 'General',
        imageBase64: l.generatedImageBase64 || l.product.generatedImageBase64 || null
      }))

      // Crear productos base con variantes
      for (const [baseName, variants] of variantGroups) {
        // Calcular precio promedio para el producto base
        const avgCost = variants.reduce((sum, v) => sum + v.unitPrice, 0) / variants.length
        const avgSellingPrice = variants.reduce((sum, v) => sum + (v.product.sellingPrice || v.unitPrice * 1.04), 0) / variants.length

        // Crear producto base con variantes
        const baseProduct = {
          tempId: -Date.now() - Math.random() * 1000, // ID único para el producto base
          name: baseName,
          sku: null,
          barcode: null,
          unitCost: avgCost,
          sellingPrice: avgSellingPrice,
          category: 'General',
          imageBase64: variants[0]?.generatedImageBase64 || variants[0]?.product.generatedImageBase64 || null,
          hasVariants: true,
          variants: variants.map(v => ({
            tempId: v.productId,
            name: v.product.name, // El nombre de la variante (ej: "Yogurt Fresa")
            sku: v.product.sku || null,
            barcode: v.product.barcode || null,
            unitCost: v.unitPrice,
            sellingPrice: v.product.sellingPrice || v.unitPrice * 1.04
          }))
        }

        newProducts.push(baseProduct)
        console.log('[Submit Purchase] Created product with variants:', baseName, 'variants:', variants.length)
      }

      console.log('[Submit Purchase] New products to create:', newProducts)

      const response = await fetch('/api/market/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier!.id,
          supplierName: selectedSupplier!.name, // For auto-creating new suppliers
          supplierContact: selectedSupplier!.phone,
          supplierAddress: selectedSupplier!.fullAddress,
          warehouseId: selectedWarehouse?.id || null,
          purchaseDate,
          expectedDate: expectedDate || null,
          notes: notes || null,
          currency,
          lines: purchaseLines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            isNewProduct: l.isNewProduct || false
          })),
          newProducts: newProducts.length > 0 ? newProducts : undefined
        })
      })
      const data = await response.json()
      if (data.success) {
        const purchaseId = data.data.id

        // Upload invoices if any
        if (invoiceFiles.length > 0) {
          try {
            const formData = new FormData()
            invoiceFiles.forEach(inv => {
              formData.append('files', inv.file)
            })
            formData.append('orderType', 'purchase')
            formData.append('orderId', purchaseId.toString())

            await fetch('/api/upload/order-invoices', {
              method: 'POST',
              body: formData
            })
          } catch (uploadError) {
            console.error('Error uploading invoices:', uploadError)
            // Continue even if invoice upload fails
          }
        }

        router.push('/dashboard/market/purchases')
      } else {
        setErrors({ submit: data.error || 'Error al crear la compra' })
      }
    } catch (error) {
      console.error('Error creating purchase:', error)
      setErrors({ submit: 'Error al crear la compra' })
    } finally {
      setLoading(false)
    }
  }

  // Check margin before submitting
  const handleCheckMarginAndSubmit = useCallback(() => {
    // Get all items that will be created as new products
    const itemsToCheck = purchaseLines.filter(l => l.isNewProduct && l.productId < 0)

    // Also check matched products that will be created
    const matchedItemsToCheck = matchedProducts.filter(item => item.action === 'create_new')

    const lowMargin: Array<{
      name: string
      costPrice: number
      sellingPrice: number
      margin: number
      suggestedPrice: number
    }> = []

    // Check purchase lines
    for (const line of itemsToCheck) {
      const costPrice = line.unitPrice
      const sellingPrice = line.product.sellingPrice || costPrice * 1.04
      const margin = calculateMargin(costPrice, sellingPrice)

      if (isLowMargin(costPrice, sellingPrice, 40)) {
        lowMargin.push({
          name: line.product.name,
          costPrice,
          sellingPrice,
          margin,
          suggestedPrice: calculateHealthyPrice(costPrice)
        })
      }
    }

    // Check matched products that will become new products
    for (const item of matchedItemsToCheck) {
      const costPrice = item.unitCost
      const sellingPrice = item.suggestedSellingPrice || costPrice * 1.04
      const margin = calculateMargin(costPrice, sellingPrice)

      if (isLowMargin(costPrice, sellingPrice, 40)) {
        lowMargin.push({
          name: item.name,
          costPrice,
          sellingPrice,
          margin,
          suggestedPrice: calculateHealthyPrice(costPrice)
        })
      }
    }

    if (lowMargin.length > 0) {
      setLowMarginItems(lowMargin)
      setPendingSaveAction(() => handleSubmit)
      setShowMarginWarning(true)
    } else {
      handleSubmit()
    }
  }, [purchaseLines, matchedProducts, handleSubmit])

  // Handle margin warning confirmation - proceed with save
  const handleMarginWarningConfirm = useCallback(() => {
    setShowMarginWarning(false)
    if (pendingSaveAction) {
      pendingSaveAction()
    }
  }, [pendingSaveAction])

  // Handle margin warning adjust - close modal and let user adjust prices
  const handleMarginWarningAdjust = useCallback(() => {
    setShowMarginWarning(false)
    // Go back to products step if in review
    if (currentStep === 'review') {
      setCurrentStep('products')
    }
  }, [currentStep])

  return (
    <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-[#1a2332]' : 'bg-gray-50'
        )}>
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

            {/* Header */}
            <div className="text-center mb-4">
              <Link
                href="/dashboard/market/purchases"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a compras
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nueva Orden de Compra
              </h1>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
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
                              : currentStepIndex > index
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                          }}
                          transition={{
                            scale: { duration: 0.3 },
                            backgroundColor: { duration: 0.3 }
                          }}
                          whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-green-500/30'
                                : 'shadow-md shadow-green-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
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
                            : currentStepIndex > index
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

                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                        <div className={cn(
                          "absolute inset-0 rounded-full",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{
                            scaleX: currentStepIndex > index ? 1 : 0
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
                "rounded-2xl p-6 sm:p-8",
                theme === 'dark'
                  ? 'bg-[#1a2332]'
                  : 'bg-white border border-gray-200 shadow-lg'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step: Method Selection */}
                {currentStep === 'method' && (
                  <motion.div
                    key="method"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <FileUp className="w-5 h-5 text-white" />
                      </div>
                      ¿Cómo deseas registrar esta compra?
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* AI Option */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setEntryMethod('ai')
                          setCurrentStep('scan')
                        }}
                        className={cn(
                          "p-6 rounded-2xl border-2 text-left transition-all",
                          entryMethod === 'ai'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
                              : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={cn(
                            "w-14 h-14 rounded-xl flex items-center justify-center",
                            theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                          )}>
                            <Sparkles className="w-7 h-7 text-blue-500" />
                          </div>
                          <div>
                            <h3 className={cn(
                              "text-lg font-bold",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              Mediante Factura con IA
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white font-medium">
                              Recomendado
                            </span>
                          </div>
                        </div>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Sube una foto o PDF de la factura del proveedor y la IA detectará automáticamente los productos, cantidades y precios.
                        </p>
                        <div className={cn(
                          "mt-4 flex items-center gap-2 text-sm",
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Detecta productos existentes</span>
                        </div>
                        <div className={cn(
                          "mt-1 flex items-center gap-2 text-sm",
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Extrae datos del proveedor</span>
                        </div>
                      </motion.button>

                      {/* Manual Option */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setEntryMethod('manual')
                          setCurrentStep('supplier')
                        }}
                        className={cn(
                          "p-6 rounded-2xl border-2 text-left transition-all",
                          entryMethod === 'manual'
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
                              : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={cn(
                            "w-14 h-14 rounded-xl flex items-center justify-center",
                            theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
                          )}>
                            <Edit3 className="w-7 h-7 text-green-500" />
                          </div>
                          <div>
                            <h3 className={cn(
                              "text-lg font-bold",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              Entrada Manual
                            </h3>
                          </div>
                        </div>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Agrega los productos uno por uno buscando en tu inventario. Ideal cuando no tienes la factura digitalizada.
                        </p>
                        <div className={cn(
                          "mt-4 flex items-center gap-2 text-sm",
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        )}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Control total sobre cada línea</span>
                        </div>
                        <div className={cn(
                          "mt-1 flex items-center gap-2 text-sm",
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        )}>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Sin necesidad de factura física</span>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Step: Scan Invoice with AI */}
                {currentStep === 'scan' && (
                  <motion.div
                    key="scan"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      Escanear Factura del Proveedor
                    </h2>

                    {/* File Upload Area */}
                    <div className={cn(
                      "border-2 border-dashed rounded-2xl p-8 text-center transition-all relative overflow-hidden",
                      invoiceFileBase64
                        ? theme === 'dark'
                          ? 'border-green-500/50 bg-green-900/10'
                          : 'border-green-300 bg-green-50'
                        : theme === 'dark'
                          ? 'border-gray-600 hover:border-gray-500'
                          : 'border-gray-300 hover:border-gray-400',
                      isScanning && 'border-cyan-500/50'
                    )}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="invoice-upload"
                        disabled={isScanning}
                      />
                      <label htmlFor="invoice-upload" className={cn("cursor-pointer block", isScanning && "pointer-events-none")}>
                        {invoiceFileBase64 ? (
                          <div className="space-y-4 relative">
                            {invoiceFileBase64.startsWith('data:image') ? (
                              <div className="relative inline-block mx-auto">
                                <img
                                  src={invoiceFileBase64}
                                  alt="Factura"
                                  className={cn(
                                    "max-h-64 mx-auto rounded-xl shadow-lg transition-all duration-500",
                                    isScanning && "brightness-75"
                                  )}
                                />
                                {/* Scanning Line Effect */}
                                {isScanning && (
                                  <motion.div
                                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                                    initial={{ top: '0%' }}
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{
                                      duration: 2,
                                      repeat: Infinity,
                                      ease: 'easeInOut'
                                    }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="relative inline-block mx-auto">
                                <div className={cn(
                                  "w-24 h-32 mx-auto rounded-xl flex items-center justify-center overflow-hidden transition-all duration-500",
                                  isScanning
                                    ? "bg-gradient-to-br from-red-100 to-cyan-100 dark:from-red-900/30 dark:to-cyan-900/30"
                                    : theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                                )}>
                                  <FileText className={cn(
                                    "w-12 h-12 transition-colors duration-500",
                                    isScanning ? "text-cyan-600" : "text-red-500"
                                  )} />
                                  {/* PDF Scanning Effect */}
                                  {isScanning && (
                                    <motion.div
                                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                                      initial={{ top: '0%' }}
                                      animate={{ top: ['0%', '100%', '0%'] }}
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'easeInOut'
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                            {!isScanning && (
                              <>
                                <p className={cn(
                                  "text-sm font-medium",
                                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                )}>
                                  {invoiceFileName}
                                </p>
                                <p className={cn(
                                  "text-xs",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                )}>
                                  Haz clic para cambiar el archivo
                                </p>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            <Upload className={cn(
                              "w-16 h-16 mx-auto mb-4",
                              theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                            )} />
                            <p className={cn(
                              "text-lg font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Arrastra o haz clic para subir
                            </p>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              JPG, PNG, WebP o PDF (máx. 10MB)
                            </p>
                          </>
                        )}
                      </label>

                      {/* AI Processing Overlay */}
                      <AnimatePresence>
                        {isScanning && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="mt-6"
                          >
                            {/* Glassmorphism Card */}
                            <div className={cn(
                              "relative p-6 rounded-2xl backdrop-blur-xl overflow-hidden",
                              theme === 'dark'
                                ? "bg-gray-900/80 border border-gray-700/50"
                                : "bg-white/80 border border-gray-200/50"
                            )}>
                              {/* Animated border glow */}
                              <motion.div
                                className="absolute inset-0 rounded-2xl"
                                style={{
                                  background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)',
                                  backgroundSize: '200% 100%'
                                }}
                                animate={{
                                  backgroundPosition: ['200% 0', '-200% 0']
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: 'linear'
                                }}
                              />

                              {/* Content */}
                              <div className="relative z-10 flex flex-col items-center">
                                {/* Animated Icon Container */}
                                <motion.div
                                  className={cn(
                                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                                    theme === 'dark'
                                      ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
                                      : "bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200"
                                  )}
                                  animate={{
                                    boxShadow: [
                                      '0 0 0 0 rgba(34, 211, 238, 0)',
                                      '0 0 0 10px rgba(34, 211, 238, 0.1)',
                                      '0 0 0 0 rgba(34, 211, 238, 0)'
                                    ]
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                  }}
                                >
                                  <AnimatePresence mode="wait">
                                    <motion.div
                                      key={ocrStep}
                                      initial={{ scale: 0, rotate: -180 }}
                                      animate={{ scale: 1, rotate: 0 }}
                                      exit={{ scale: 0, rotate: 180 }}
                                      transition={{ duration: 0.3 }}
                                    >
                                      {React.createElement(ocrSteps[ocrStep].icon, {
                                        className: "w-8 h-8 text-cyan-500"
                                      })}
                                    </motion.div>
                                  </AnimatePresence>
                                </motion.div>

                                {/* Step Text */}
                                <AnimatePresence mode="wait">
                                  <motion.p
                                    key={ocrStep}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={cn(
                                      "font-semibold text-lg",
                                      theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600'
                                    )}
                                  >
                                    {ocrSteps[ocrStep].text}
                                  </motion.p>
                                </AnimatePresence>
                                <p className={cn(
                                  "text-sm mt-1",
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                )}>
                                  Esto puede tomar unos segundos...
                                </p>

                                {/* Progress Bar */}
                                <div className={cn(
                                  "w-full h-1.5 rounded-full mt-4 overflow-hidden",
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )}>
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                    initial={{ width: '0%' }}
                                    animate={{ width: '100%' }}
                                    transition={{
                                      duration: 6,
                                      ease: 'linear'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Particle effects */}
                              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {[...Array(6)].map((_, i) => (
                                  <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 rounded-full bg-cyan-400"
                                    initial={{
                                      x: '50%',
                                      y: '50%',
                                      opacity: 0
                                    }}
                                    animate={{
                                      x: `${20 + Math.random() * 60}%`,
                                      y: `${20 + Math.random() * 60}%`,
                                      opacity: [0, 1, 0]
                                    }}
                                    transition={{
                                      duration: 2,
                                      repeat: Infinity,
                                      delay: i * 0.3,
                                      ease: 'easeOut'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Context Input - hide when scanning */}
                    {!isScanning && (
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Instrucciones para la IA (opcional)
                        </label>
                        <textarea
                          value={aiContext}
                          onChange={(e) => setAiContext(e.target.value)}
                          placeholder="Ej: El yogurt que viene en diferentes sabores son variantes del mismo producto, los precios ya incluyen IVA..."
                          rows={3}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border resize-none",
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                          )}
                        />
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          Usa este campo para dar contexto adicional que ayude a interpretar mejor la factura
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {scanError && !isScanning && (
                      <div className={cn(
                        'p-4 rounded-xl flex items-center gap-3',
                        'bg-red-500/10 border border-red-500/30'
                      )}>
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-500 text-sm">{scanError}</p>
                      </div>
                    )}

                    {/* Process Button - hide when scanning */}
                    {!isScanning && (
                      <motion.button
                        whileHover={{ scale: invoiceFileBase64 ? 1.02 : 1 }}
                        whileTap={{ scale: invoiceFileBase64 ? 0.98 : 1 }}
                        onClick={processInvoiceWithAI}
                        disabled={!invoiceFileBase64}
                        className={cn(
                          "w-full py-4 rounded-xl font-medium flex items-center justify-center gap-3 transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark'
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-400/30'
                        )}
                      >
                        <Sparkles className="w-5 h-5" />
                        Procesar con IA
                      </motion.button>
                    )}
                  </motion.div>
                )}

                {/* Step: Review Scan Results */}
                {currentStep === 'review-scan' && (
                  <motion.div
                    key="review-scan"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className={cn(
                        "text-xl font-bold flex items-center gap-3",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                        Revisar Productos Detectados
                      </h2>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          resetAIScan()
                          setCurrentStep('scan')
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Escanear otra
                      </motion.button>
                    </div>

                    {/* Detected Vendor */}
                    {scannedData?.vendorName && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                      )}>
                        <label className={cn(
                          'text-xs font-medium mb-1 block',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          Proveedor detectado
                        </label>
                        <p className={cn(
                          'text-lg font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {scannedData.vendorName}
                        </p>
                        {scannedData.invoiceNumber && (
                          <p className={cn(
                            'text-sm mt-1',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Factura: {scannedData.invoiceNumber}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Matched Products - Existing */}
                    {matchedProducts.filter(p => p.matchType !== 'none').length > 0 && (
                      <div>
                        <h3 className={cn(
                          "font-bold flex items-center gap-2 mb-3",
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        )}>
                          <CheckCircle2 className="w-5 h-5" />
                          Productos Identificados ({matchedProducts.filter(p => p.matchType !== 'none').length})
                        </h3>
                        <div className="space-y-3">
                          {matchedProducts.filter(p => p.matchType !== 'none').map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                'p-4 rounded-xl border',
                                item.action === 'ignore'
                                  ? theme === 'dark'
                                    ? 'bg-gray-800/50 border-gray-700 opacity-50'
                                    : 'bg-gray-100 border-gray-200 opacity-50'
                                  : theme === 'dark'
                                    ? 'bg-green-900/20 border-green-800/50'
                                    : 'bg-green-50 border-green-200'
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                    theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
                                  )}>
                                    <Package className="w-5 h-5 text-green-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {item.name}
                                    </p>
                                    <p className={cn(
                                      'text-sm mt-0.5',
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    )}>
                                      Vinculado a: <span className="font-medium">{item.matchedProduct?.name}</span>
                                      {item.matchedVariant && ` - ${item.matchedVariant.name}`}
                                    </p>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className={cn(
                                        'text-sm',
                                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                      )}>
                                        {item.quantity} {item.unitOfMeasure || 'unidad'} × ${item.unitCost.toFixed(2)}
                                      </span>
                                      <span className={cn(
                                        'text-xs px-2 py-0.5 rounded-full',
                                        item.matchType === 'barcode' || item.matchType === 'sku'
                                          ? 'bg-green-500/20 text-green-500'
                                          : item.matchType === 'exact_name'
                                            ? 'bg-blue-500/20 text-blue-500'
                                            : 'bg-amber-500/20 text-amber-500'
                                      )}>
                                        {item.matchType === 'barcode' ? 'Por código de barras' :
                                         item.matchType === 'sku' ? 'Por SKU' :
                                         item.matchType === 'exact_name' ? 'Nombre exacto' :
                                         item.matchType === 'variant' ? 'Variante' :
                                         'Nombre similar'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    'font-bold',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    ${item.totalCost.toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => handleProductAction(
                                      item.id,
                                      item.action === 'ignore' ? 'use_existing' : 'ignore'
                                    )}
                                    className={cn(
                                      'p-2 rounded-lg transition-colors',
                                      item.action === 'ignore'
                                        ? 'text-green-500 hover:bg-green-500/10'
                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                                    )}
                                  >
                                    {item.action === 'ignore' ? (
                                      <Plus className="w-4 h-4" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unmatched Products - New */}
                    {matchedProducts.filter(p => p.matchType === 'none').length > 0 && (
                      <div>
                        <h3 className={cn(
                          "font-bold flex items-center gap-2 mb-3",
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )}>
                          <Package className="w-5 h-5" />
                          Productos Nuevos ({matchedProducts.filter(p => p.matchType === 'none').length})
                        </h3>
                        <div className="flex items-center justify-between mb-3">
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Estos productos serán creados con la compra.
                          </p>
                          {matchedProducts.filter(p => p.action === 'create_new' && !p.generatedImageBase64).length > 0 && (
                            <button
                              onClick={generateAllImages}
                              disabled={isGeneratingAllImages}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                                theme === 'dark'
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-purple-800'
                                  : 'bg-purple-500 hover:bg-purple-600 text-white disabled:bg-purple-300'
                              )}
                            >
                              {isGeneratingAllImages ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Generando...
                                </>
                              ) : (
                                <>
                                  <Wand2 className="w-4 h-4" />
                                  Generar todas las imágenes
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {matchedProducts.filter(p => p.matchType === 'none').map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                'p-4 rounded-xl border',
                                item.action === 'ignore'
                                  ? theme === 'dark'
                                    ? 'bg-gray-800/50 border-gray-700 opacity-50'
                                    : 'bg-gray-100 border-gray-200 opacity-50'
                                  : item.action === 'link_to'
                                    ? theme === 'dark'
                                      ? 'bg-blue-900/20 border-blue-800/50'
                                      : 'bg-blue-50 border-blue-200'
                                    : theme === 'dark'
                                      ? 'bg-blue-900/20 border-blue-800/50'
                                      : 'bg-blue-50 border-blue-200'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {/* Imagen del producto (generada o placeholder) */}
                                <div className="relative flex-shrink-0">
                                  {item.generatedImageUrl ? (
                                    <img
                                      src={item.generatedImageUrl}
                                      alt={item.name}
                                      className="w-14 h-14 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                    />
                                  ) : (
                                    <div className={cn(
                                      'w-14 h-14 rounded-lg flex items-center justify-center',
                                      item.action === 'link_to'
                                        ? theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                                        : theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                                    )}>
                                      <ImageIcon className={cn(
                                        "w-6 h-6",
                                        item.action === 'link_to' ? 'text-blue-400' : 'text-blue-400'
                                      )} />
                                    </div>
                                  )}
                                  {/* Botones de imagen: Generar con IA o Subir */}
                                  <div className="absolute -bottom-1 -right-1 flex gap-1">
                                    {/* Input oculto para subir imagen */}
                                    <input
                                      type="file"
                                      id={`upload-image-${item.id}`}
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          uploadAndCleanImage(item.id, file)
                                        }
                                        e.target.value = '' // Reset para permitir subir el mismo archivo
                                      }}
                                    />
                                    {/* Boton para subir imagen */}
                                    <button
                                      onClick={() => document.getElementById(`upload-image-${item.id}`)?.click()}
                                      disabled={item.isCleaningImage || item.action === 'ignore'}
                                      className={cn(
                                        'p-1.5 rounded-full shadow-lg transition-all',
                                        item.isCleaningImage
                                          ? 'bg-blue-500 cursor-wait'
                                          : 'bg-blue-500 hover:bg-blue-600',
                                        item.action === 'ignore' && 'opacity-50 cursor-not-allowed'
                                      )}
                                      title="Subir foto y limpiar con IA"
                                    >
                                      {item.isCleaningImage ? (
                                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                                      ) : (
                                        <Upload className="w-3 h-3 text-white" />
                                      )}
                                    </button>
                                    {/* Boton para generar imagen con IA */}
                                    <button
                                      onClick={() => generateImageWithAI(item.id)}
                                      disabled={item.isGeneratingImage || item.action === 'ignore'}
                                      className={cn(
                                        'p-1.5 rounded-full shadow-lg transition-all',
                                        item.isGeneratingImage
                                          ? 'bg-purple-500 cursor-wait'
                                          : item.generatedImageUrl
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-purple-500 hover:bg-purple-600',
                                        item.action === 'ignore' && 'opacity-50 cursor-not-allowed'
                                      )}
                                      title={item.generatedImageUrl ? 'Regenerar imagen con IA' : 'Generar imagen con IA'}
                                    >
                                      {item.isGeneratingImage ? (
                                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                                      ) : (
                                        <Wand2 className="w-3 h-3 text-white" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                {/* Info del producto - Editable para productos nuevos */}
                                <div className="flex-1 min-w-0 space-y-2">
                                  {/* Nombre editable */}
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => handleUpdateMatchedProduct(item.id, 'name', e.target.value)}
                                    disabled={item.action === 'ignore' || item.action === 'link_to'}
                                    className={cn(
                                      'w-full px-2 py-1 rounded-lg font-medium text-sm border transition-colors',
                                      theme === 'dark'
                                        ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 disabled:opacity-50'
                                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:opacity-50'
                                    )}
                                    placeholder="Nombre del producto"
                                  />
                                  {item.action === 'link_to' && item.linkedProductId && (
                                    <p className={cn(
                                      'text-sm',
                                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                    )}>
                                      Vinculado a producto existente
                                    </p>
                                  )}
                                  {/* Cantidad, Costo y Precio de Venta editables */}
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <div className="flex items-center gap-1">
                                      <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Cant:</span>
                                      <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateMatchedProduct(item.id, 'quantity', e.target.value)}
                                        disabled={item.action === 'ignore'}
                                        min="0"
                                        step="0.01"
                                        className={cn(
                                          'w-16 px-2 py-0.5 rounded text-sm border text-center',
                                          theme === 'dark'
                                            ? 'bg-gray-800 border-gray-700 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                        )}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Costo:</span>
                                      <div className="relative">
                                        <span className={cn('absolute left-2 top-1/2 -translate-y-1/2 text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>$</span>
                                        <input
                                          type="number"
                                          value={item.unitCost}
                                          onChange={(e) => handleUpdateMatchedProduct(item.id, 'unitCost', e.target.value)}
                                          disabled={item.action === 'ignore'}
                                          min="0"
                                          step="0.01"
                                          className={cn(
                                            'w-20 pl-5 pr-2 py-0.5 rounded text-sm border text-right',
                                            theme === 'dark'
                                              ? 'bg-gray-800 border-gray-700 text-white'
                                              : 'bg-white border-gray-300 text-gray-900'
                                          )}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={cn('text-xs', theme === 'dark' ? 'text-green-500' : 'text-green-600')}>Venta:</span>
                                      <div className="relative">
                                        <span className={cn('absolute left-2 top-1/2 -translate-y-1/2 text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>$</span>
                                        <input
                                          type="number"
                                          value={item.suggestedSellingPrice || Math.round(item.unitCost * 1.04 * 100) / 100}
                                          onChange={(e) => handleUpdateMatchedProduct(item.id, 'suggestedSellingPrice', e.target.value)}
                                          disabled={item.action === 'ignore' || item.action === 'link_to'}
                                          min="0"
                                          step="0.01"
                                          className={cn(
                                            'w-20 pl-5 pr-2 py-0.5 rounded text-sm border text-right',
                                            theme === 'dark'
                                              ? 'bg-gray-800 border-green-700 text-green-400'
                                              : 'bg-green-50 border-green-300 text-green-700'
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  {item.generatedDescription && (
                                    <p className={cn('text-xs truncate', theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                                      {item.generatedDescription}
                                    </p>
                                  )}
                                </div>
                                {/* Acciones */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="text-right">
                                    <span className={cn(
                                      'font-bold block',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      ${item.totalCost.toFixed(2)}
                                    </span>
                                    <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                      total
                                    </span>
                                  </div>
                                  {/* Link button */}
                                  <button
                                    onClick={() => {
                                      setLinkingItemId(item.id)
                                      setLinkSearch('')
                                      setLinkResults([])
                                      setShowLinkModal(true)
                                    }}
                                    className={cn(
                                      'p-2 rounded-lg transition-colors',
                                      'text-blue-500 hover:bg-blue-500/10'
                                    )}
                                    title="Vincular a producto existente"
                                  >
                                    <Link2 className="w-4 h-4" />
                                  </button>
                                  {/* Ignore/Include button */}
                                  <button
                                    onClick={() => handleProductAction(
                                      item.id,
                                      item.action === 'ignore' ? 'create_new' : 'ignore'
                                    )}
                                    className={cn(
                                      'p-2 rounded-lg transition-colors',
                                      item.action === 'ignore'
                                        ? 'text-green-500 hover:bg-green-500/10'
                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                                    )}
                                    title={item.action === 'ignore' ? 'Incluir' : 'Excluir'}
                                  >
                                    {item.action === 'ignore' ? (
                                      <Plus className="w-4 h-4" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              {/* Suggested matches */}
                              {item.action !== 'ignore' && item.action !== 'link_to' && item.suggestedMatches.length > 0 && (
                                <div className={cn(
                                  'mt-3 pt-3 border-t',
                                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                )}>
                                  <p className={cn(
                                    'text-xs mb-2',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )}>
                                    Sugerencias:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.suggestedMatches.map((s) => (
                                      <button
                                        key={s.id}
                                        onClick={() => handleProductAction(item.id, 'link_to', s.id)}
                                        className={cn(
                                          'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                          theme === 'dark'
                                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                        )}
                                      >
                                        {s.name} ({Math.round(s.similarity * 100)}%)
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
                    )}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Total detectado ({matchedProducts.filter(p => p.action !== 'ignore').length} productos)
                          </p>
                          <p className={cn(
                            'text-2xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            ${matchedProducts
                              .filter(p => p.action !== 'ignore')
                              .reduce((sum, p) => sum + p.totalCost, 0)
                              .toFixed(2)}
                          </p>
                        </div>
                        {scannedData && (
                          <div className="text-right">
                            <p className={cn(
                              'text-xs',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )}>
                              Confianza IA
                            </p>
                            <p className={cn(
                              'text-lg font-bold',
                              scannedData.confidence >= 0.8
                                ? 'text-green-500'
                                : scannedData.confidence >= 0.6
                                  ? 'text-amber-500'
                                  : 'text-red-500'
                            )}>
                              {Math.round(scannedData.confidence * 100)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Currency conversion breakdown */}
                    {scannedData?.originalCurrency && scannedData.originalCurrency !== 'USD' && (
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-amber-500" />
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                          )}>
                            Conversión de moneda aplicada
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}>
                            Original: ${scannedData.originalTotal?.toLocaleString('es-CU', { minimumFractionDigits: 2 })} {scannedData.originalCurrency}
                          </span>
                          <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-500'}>→</span>
                          <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${scannedData.total?.toFixed(2)} USD
                          </span>
                        </div>
                        <p className={cn(
                          'text-xs mt-2',
                          theme === 'dark' ? 'text-amber-500' : 'text-amber-600'
                        )}>
                          Tasa ElToque: 1 USD = {scannedData.originalCurrency === 'CUP'
                            ? scannedData.conversionRate?.toLocaleString()
                            : scannedData.conversionRate?.toFixed(2)} {scannedData.originalCurrency}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {scanError && (
                      <div className={cn(
                        'p-4 rounded-xl flex items-center gap-3',
                        'bg-red-500/10 border border-red-500/30'
                      )}>
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-500 text-sm">{scanError}</p>
                      </div>
                    )}

                    {/* Confirm Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={confirmScannedProducts}
                      disabled={matchedProducts.filter(p => p.action !== 'ignore').length === 0}
                      className={cn(
                        "w-full py-4 rounded-xl font-medium flex items-center justify-center gap-3 transition-all",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        theme === 'dark'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30'
                          : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-400/30'
                      )}
                    >
                      <Check className="w-5 h-5" />
                      Continuar con estos productos
                    </motion.button>
                  </motion.div>
                )}

                {/* Step: Supplier & Warehouse (same design as consignments) */}
                {currentStep === 'supplier' && (
                  <motion.div
                    key="supplier"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Proveedor y Almacen
                    </h2>

                    {/* Supplier Selection */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Proveedor *
                      </label>

                      {/* Show detected vendor name if AI scanned but no match found */}
                      {scannedData?.vendorName && !selectedSupplier && (
                        <div className={cn(
                          'p-3 rounded-xl border mb-3 flex items-start gap-3',
                          theme === 'dark'
                            ? 'border-amber-600/50 bg-amber-900/20'
                            : 'border-amber-400 bg-amber-50'
                        )}>
                          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className={cn(
                              'font-medium text-sm',
                              theme === 'dark' ? 'text-amber-300' : 'text-amber-700'
                            )}>
                              Proveedor detectado: <strong>{scannedData.vendorName}</strong>
                            </p>
                            <p className={cn(
                              'text-xs mt-0.5',
                              theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                            )}>
                              No se encontro coincidencia automatica. Busca y selecciona el proveedor correcto.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          placeholder={scannedData?.vendorName ? `Buscar "${scannedData.vendorName}"...` : "Buscar proveedor..."}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      {/* Selected Supplier Display */}
                      {selectedSupplier && !supplierSearch && (
                        <div className={cn(
                          'p-4 rounded-xl border mb-3',
                          theme === 'dark'
                            ? 'border-emerald-600 bg-emerald-900/20'
                            : 'border-emerald-500 bg-emerald-50'
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="px-2 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500 text-white">
                                {selectedSupplier.supplierCode}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{selectedSupplier.name}</p>
                                {selectedSupplier.phone && (
                                  <p className="text-xs text-gray-500">{selectedSupplier.phone}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedSupplier(null)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                              )}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Search Results - Always show suppliers */}
                      {loadingSuppliers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                      ) : !selectedSupplier ? (
                        <>
                          {/* Show suppliers grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                            {(supplierSearch ? filteredSuppliers : suppliers.slice(0, 20)).map(supplier => (
                              <motion.button
                                key={supplier.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSelectedSupplier(supplier)
                                  setSupplierSearch('')
                                }}
                                className={cn(
                                  'p-4 rounded-xl border text-left transition-all',
                                  theme === 'dark'
                                    ? 'border-gray-700 bg-gray-800 hover:border-emerald-600'
                                    : 'border-gray-200 bg-white hover:border-emerald-500'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'px-2 py-1 rounded-lg text-xs font-mono font-bold',
                                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                  )}>
                                    {supplier.supplierCode}
                                  </div>
                                  <div>
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>{supplier.name}</p>
                                    {supplier.phone && (
                                      <p className="text-xs text-gray-500">{supplier.phone}</p>
                                    )}
                                  </div>
                                </div>
                              </motion.button>
                            ))}
                          </div>

                          {/* No results - option to create */}
                          {supplierSearch && filteredSuppliers.length === 0 && (
                            <div className={cn(
                              'mt-3 p-4 rounded-xl border-2 border-dashed text-center',
                              theme === 'dark' ? 'border-emerald-600/50 bg-emerald-900/10' : 'border-emerald-400 bg-emerald-50'
                            )}>
                              <p className={cn(
                                'font-medium mb-2',
                                theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                              )}>
                                No se encontró &quot;{supplierSearch}&quot;
                              </p>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  // Create supplier with detected name
                                  const newSupplier: Supplier = {
                                    id: -Date.now(),
                                    supplierCode: 'NUEVO',
                                    name: supplierSearch || scannedData?.vendorName || 'Nuevo Proveedor',
                                    phone: null,
                                    email: null,
                                    address: null,
                                    city: null,
                                    state: null,
                                    fullAddress: ''
                                  }
                                  setSelectedSupplier(newSupplier)
                                  setSupplierSearch('')
                                }}
                                className={cn(
                                  'px-4 py-2 rounded-lg font-medium inline-flex items-center gap-2',
                                  theme === 'dark'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                )}
                              >
                                <Plus className="w-4 h-4" />
                                Crear proveedor &quot;{supplierSearch}&quot;
                              </motion.button>
                            </div>
                          )}

                          {/* Empty state when no suppliers at all */}
                          {!supplierSearch && suppliers.length === 0 && (
                            <div className={cn(
                              'text-center py-8 rounded-xl border-2 border-dashed',
                              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                            )}>
                              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>No hay proveedores registrados</p>
                              <p className={cn(
                                'text-sm mt-1',
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              )}>Escribe un nombre para crear uno nuevo</p>
                            </div>
                          )}
                        </>
                      ) : null}
                      {errors.supplier && (
                        <p className="text-sm text-red-500 mt-2">{errors.supplier}</p>
                      )}
                    </div>

                    {/* Warehouse Selection */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Almacen Destino *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {warehouses.map(warehouse => (
                          <motion.button
                            key={warehouse.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedWarehouse(warehouse)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all flex items-center gap-3',
                              selectedWarehouse?.id === warehouse.id
                                ? theme === 'dark'
                                  ? 'border-emerald-600 bg-emerald-900/20'
                                  : 'border-emerald-500 bg-emerald-50'
                                : theme === 'dark'
                                  ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                            )}
                          >
                            <Warehouse className={cn(
                              'w-5 h-5',
                              selectedWarehouse?.id === warehouse.id ? 'text-emerald-500' : 'text-gray-400'
                            )} />
                            <div>
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{warehouse.name}</p>
                              <p className="text-xs text-gray-500">{warehouse.code}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      {errors.warehouse && (
                        <p className="text-sm text-red-500 mt-2">{errors.warehouse}</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Products */}
                {currentStep === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className={cn(
                        "text-xl font-bold flex items-center gap-3",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        Productos de la Compra
                      </h2>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowProductModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-lg"
                      >
                        <Plus className="w-5 h-5" />Agregar
                      </motion.button>
                    </div>

                    {purchaseLines.length === 0 ? (
                      <div className={cn(
                        'text-center py-16 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                      )}>
                        <Package className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>No hay productos agregados</p>
                        <p className={cn('text-sm mb-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Haz clic en &quot;Agregar&quot; para comenzar</p>
                      </div>
                    ) : (
                      <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                        <table className="w-full">
                          <thead className={cn(theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                            <tr>
                              <th className={cn('px-4 py-3 text-left text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Producto</th>
                              <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cantidad</th>
                              <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>P. Unitario</th>
                              <th className={cn('px-4 py-3 text-right text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Subtotal</th>
                              <th className="px-4 py-3 w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchaseLines.map((line, index) => (
                              <motion.tr
                                key={line.productId}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className={cn('border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}
                              >
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    {line.product.imageUrl ? (
                                      <img src={line.product.imageUrl} alt={line.product.name} className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                        <Package className="w-6 h-6 text-gray-400" />
                                      </div>
                                    )}
                                    <div>
                                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                      </p>
                                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                        SKU: {line.variantSku || line.product.sku}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => updateLineQuantity(line.productId, line.variantId, line.quantity - 1)}
                                      className={cn('w-8 h-8 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
                                    >-</button>
                                    <input
                                      type="number"
                                      value={line.quantity}
                                      onChange={(e) => updateLineQuantity(line.productId, line.variantId, parseInt(e.target.value) || 1)}
                                      className={cn('w-16 text-center rounded-lg py-2 border', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                    />
                                    <button
                                      onClick={() => updateLineQuantity(line.productId, line.variantId, line.quantity + 1)}
                                      className={cn('w-8 h-8 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
                                    >+</button>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center">
                                    <span className={cn('text-sm mr-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{CURRENCY_SYMBOLS[currency]}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={line.unitPrice}
                                      onChange={(e) => updateLinePrice(line.productId, line.variantId, parseFloat(e.target.value) || 0)}
                                      className={cn('w-24 text-center rounded-lg py-2 border', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                    />
                                  </div>
                                </td>
                                <td className={cn('px-4 py-4 text-right font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {CURRENCY_SYMBOLS[currency]}{line.totalPrice.toFixed(2)}
                                </td>
                                <td className="px-4 py-4">
                                  <button onClick={() => removeLine(line.productId, line.variantId)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                        <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                          <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Subtotal:</span>
                                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{CURRENCY_SYMBOLS[currency]}{subtotal.toFixed(2)}</span>
                              </div>
                              <div className={cn('flex justify-between pt-2 border-t font-bold text-lg', theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900')}>
                                <span>Total:</span>
                                <span>{CURRENCY_SYMBOLS[currency]}{total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {errors.products && <p className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{errors.products}</p>}
                  </motion.div>
                )}

                {/* Step 3: Invoices */}
                {currentStep === 'invoices' && (
                  <motion.div
                    key="invoices"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <FileUp className="w-5 h-5 text-white" />
                      </div>
                      Facturas Originales
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Adjunta las facturas o recibos originales del proveedor. Este paso es opcional.
                    </p>

                    <InvoiceUploader
                      invoices={invoiceFiles}
                      onInvoicesChange={setInvoiceFiles}
                      orderType="purchase"
                    />
                  </motion.div>
                )}

                {/* Step 5: Review */}
                {currentStep === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      Resumen de la Compra
                    </h2>

                    {/* Supplier Card */}
                    <div className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                      <h3 className={cn('font-medium mb-3 flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <Truck className="w-4 h-4" />Proveedor
                      </h3>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedSupplier?.name}</p>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{selectedSupplier?.supplierCode}</p>
                          {selectedSupplier?.phone && (
                            <p className={cn('text-sm flex items-center gap-1 mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              <Phone className="w-3 h-3" />{selectedSupplier.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          <Calendar className="w-4 h-4 inline mr-1" />Fecha de Compra *
                        </label>
                        <input
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          className={cn('w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          <Calendar className="w-4 h-4 inline mr-1" />Entrega Esperada
                        </label>
                        <input
                          type="date"
                          value={expectedDate}
                          onChange={(e) => setExpectedDate(e.target.value)}
                          className={cn('w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <FileText className="w-4 h-4 inline mr-1" />Notas (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Agregar notas adicionales..."
                        rows={3}
                        className={cn('w-full px-4 py-3 rounded-xl border resize-none', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400')}
                      />
                    </div>

                    {/* Invoices Summary */}
                    {invoiceFiles.length > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl border flex items-center gap-4',
                        theme === 'dark' ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'
                      )}>
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'
                        )}>
                          <FileUp className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {invoiceFiles.length} {invoiceFiles.length === 1 ? 'factura adjunta' : 'facturas adjuntas'}
                          </p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
                          )}>
                            Se subiran al crear la compra
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Products Summary */}
                    <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className={cn('px-5 py-3 border-b', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <h3 className={cn('font-medium flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          <Package className="w-4 h-4" />Productos ({purchaseLines.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {purchaseLines.map((line) => (
                          <div key={line.productId} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {line.product.imageUrl ? (
                                <img src={line.product.imageUrl} alt={line.product.name} className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                  x{line.quantity} @ {CURRENCY_SYMBOLS[currency]}{line.unitPrice.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {CURRENCY_SYMBOLS[currency]}{line.totalPrice.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                            <div className="flex justify-between">
                              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Subtotal:</span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{CURRENCY_SYMBOLS[currency]}{subtotal.toFixed(2)}</span>
                            </div>
                            <div className={cn('flex justify-between pt-2 border-t font-bold text-lg', theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900')}>
                              <span>Total:</span>
                              <span className="text-green-500">{CURRENCY_SYMBOLS[currency]}{total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {errors.submit && (
                      <div className={cn('p-4 rounded-xl flex items-center gap-3', 'bg-red-500/10 border border-red-500/30')}>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-red-500">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons - Hide for method, scan, review-scan steps (they have their own buttons) */}
            {!['method', 'scan', 'review-scan'].includes(currentStep) && (
              <div className="flex justify-between items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    // Custom back navigation for AI flow
                    if (entryMethod === 'ai' && currentStep === 'supplier') {
                      setCurrentStep('review-scan')
                    } else {
                      goToPrevStep()
                    }
                  }}
                  disabled={currentStep === 'supplier' && entryMethod === 'manual'}
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
                </motion.button>

                {currentStep === 'review' ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCheckMarginAndSubmit}
                    disabled={loading}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                      'text-white'
                    )}
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />Creando...</>
                    ) : (
                      <><Check className="w-5 h-5" />Crear Compra</>
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goToNextStep}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                        : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                      'text-white'
                    )}
                  >
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {/* Product Search Modal */}
          <AnimatePresence>
            {showProductModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setShowProductModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className={cn('p-4 border-b flex items-center justify-between', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Buscar Producto</h3>
                    <button onClick={() => setShowProductModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4">
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <Search className="w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, SKU o código de barras..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        autoFocus
                        className={cn('flex-1 bg-transparent outline-none', theme === 'dark' ? 'text-white' : 'text-gray-900')}
                      />
                      {searchingProducts && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {productResults.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {productResults.map((product) => (
                          <motion.button
                            key={product.id}
                            whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                            onClick={() => handleProductClick(product)}
                            className="w-full p-4 flex items-center gap-4 text-left"
                          >
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-14 h-14 rounded-lg object-cover" />
                            ) : (
                              <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                <Package className="w-7 h-7 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                                {product.hasVariants && (
                                  <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    {product.variants?.length || 0} var
                                  </span>
                                )}
                              </div>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                SKU: {product.sku}{product.barcode && ` • ${product.barcode}`}
                              </p>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Stock: {product.quantityOnHand} unidades
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {CURRENCY_SYMBOLS[product.currency]}{product.costPrice.toFixed(2)}
                              </p>
                              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Precio costo</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : productSearch.length >= 2 && !searchingProducts ? (
                      <div className="p-8 text-center">
                        <Package className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No se encontraron productos</p>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Search className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Escribe para buscar productos</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New Supplier Modal */}
          <AnimatePresence>
            {showNewSupplierModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setShowNewSupplierModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('w-full max-w-md rounded-2xl shadow-xl overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className={cn('p-4 border-b flex items-center justify-between', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Nuevo Proveedor</h3>
                    <button onClick={() => setShowNewSupplierModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label>
                      <input
                        type="text"
                        value={newSupplierData.name}
                        onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                        className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Teléfono</label>
                      <input
                        type="text"
                        value={newSupplierData.phone}
                        onChange={(e) => setNewSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                        className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Dirección</label>
                      <input
                        type="text"
                        value={newSupplierData.address}
                        onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                        className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Ciudad</label>
                        <input
                          type="text"
                          value={newSupplierData.city}
                          onChange={(e) => setNewSupplierData(prev => ({ ...prev, city: e.target.value }))}
                          className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                        />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Provincia</label>
                        <input
                          type="text"
                          value={newSupplierData.state}
                          onChange={(e) => setNewSupplierData(prev => ({ ...prev, state: e.target.value }))}
                          className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={cn('p-4 border-t flex justify-end gap-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <button
                      onClick={() => setShowNewSupplierModal(false)}
                      className={cn('px-4 py-2 rounded-lg font-medium', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateSupplier}
                      disabled={!newSupplierData.name.trim() || creatingSupplier}
                      className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white disabled:opacity-50"
                    >
                      {creatingSupplier ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Proveedor'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 pb-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                        )}>
                          <X className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold mb-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            ¿Cancelar compra?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Los datos ingresados se perderán y no podrás recuperarlos.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCancelModal(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Continuar editando
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/purchases')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Sí, cancelar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Link Product Modal */}
          <AnimatePresence>
            {showLinkModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkingItemId(null)
                }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full max-w-lg rounded-2xl shadow-xl overflow-hidden',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className={cn(
                    'p-4 border-b flex items-center justify-between',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h3 className={cn(
                      'text-lg font-bold flex items-center gap-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <Link2 className="w-5 h-5 text-blue-500" />
                      Vincular a Producto Existente
                    </h3>
                    <button
                      onClick={() => {
                        setShowLinkModal(false)
                        setLinkingItemId(null)
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}>
                      <Search className="w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        autoFocus
                        className={cn(
                          'flex-1 bg-transparent outline-none',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}
                      />
                      {searchingLink && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {linkResults.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {linkResults.map((product) => (
                          <motion.button
                            key={product.id}
                            whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                            onClick={() => {
                              if (linkingItemId) {
                                handleProductAction(linkingItemId, 'link_to', product.id)
                              }
                              setShowLinkModal(false)
                              setLinkingItemId(null)
                              setLinkSearch('')
                            }}
                            className="w-full p-4 flex items-center gap-4 text-left"
                          >
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className={cn(
                                'w-12 h-12 rounded-lg flex items-center justify-center',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              )}>
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {product.name}
                              </p>
                              <p className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                SKU: {product.sku}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                'font-bold',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                ${product.costPrice.toFixed(2)}
                              </p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : linkSearch.length >= 2 && !searchingLink ? (
                      <div className="p-8 text-center">
                        <Package className={cn(
                          'w-12 h-12 mx-auto mb-3',
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          No se encontraron productos
                        </p>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Search className={cn(
                          'w-12 h-12 mx-auto mb-3',
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          Escribe para buscar productos
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Variant Selector Modal */}
          <VariantSelectorModal
            isOpen={showVariantModal}
            onClose={() => {
              setShowVariantModal(false)
              setSelectedProductForVariant(null)
            }}
            product={selectedProductForVariant ? {
              id: selectedProductForVariant.id,
              name: selectedProductForVariant.name,
              imageUrl: selectedProductForVariant.imageUrl,
              variants: (selectedProductForVariant.variants || []).map(v => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                price: v.price,
                costPrice: v.costPrice,
                stock: v.stock,
                imageUrl: v.imageUrl
              }))
            } : null}
            onSelect={handleVariantSelect}
            mode="purchase"
            showOutOfStock={true}
            currency={currency}
          />

          {/* Currency Detection Modal */}
          <CurrencyDetectionModal
            isOpen={showCurrencyModal}
            onConfirm={(currency) => {
              setShowCurrencyModal(false)
              handleCurrencyConfirm(currency)
            }}
            detectedHints={pendingOcrData?.currencyHints}
            total={pendingOcrData?.data.total || 0}
            rates={{ USD_CUP, USD_MLC }}
            ratesTimestamp={ratesTimestamp}
          />

          {/* Margin Warning Modal */}
          <MarginWarningModal
            isOpen={showMarginWarning}
            onClose={() => setShowMarginWarning(false)}
            onConfirm={handleMarginWarningConfirm}
            onAdjustPrices={handleMarginWarningAdjust}
            items={lowMarginItems}
            recommendedMargin={40}
          />
    </div>
  )
}
// Force rebuild Sat Jan  3 18:16:45 EST 2026
