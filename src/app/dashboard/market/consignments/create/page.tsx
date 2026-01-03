'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Package,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  X,
  Warehouse,
  Calendar,
  Barcode,
  Printer,
  CheckCircle,
  FileUp,
  Upload,
  Sparkles,
  Edit3,
  Link2,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Scan,
  Brain,
  Zap,
  Wand2,
  ImageIcon
} from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { VariantSelectorModal, Variant } from '@/components/market/VariantSelectorModal'
import { InvoiceUploader, InvoiceFile } from '@/components/orders/InvoiceUploader'

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

type Step = 'method' | 'scan' | 'review-scan' | 'supplier' | 'products' | 'invoices' | 'review' | 'confirmation'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

// Steps base (sin IA) - se muestran los pasos 'method' y luego los del flujo manual
const STEPS_MANUAL: WizardStep[] = [
  { id: 'method', title: 'Método', description: 'Seleccionar', icon: FileUp },
  { id: 'supplier', title: 'Proveedor', description: 'Seleccionar', icon: Users },
  { id: 'products', title: 'Productos', description: 'Agregar lineas', icon: Package },
  { id: 'invoices', title: 'Facturas', description: 'Adjuntar', icon: FileUp },
  { id: 'review', title: 'Revision', description: 'Verificar orden', icon: FileText },
  { id: 'confirmation', title: 'Confirmacion', description: 'Finalizar', icon: Check }
]

// Steps con IA - incluye scan y review-scan
const STEPS_AI: WizardStep[] = [
  { id: 'method', title: 'Método', description: 'Seleccionar', icon: FileUp },
  { id: 'scan', title: 'Escanear', description: 'Subir factura', icon: Sparkles },
  { id: 'review-scan', title: 'Revisar', description: 'Productos IA', icon: Eye },
  { id: 'supplier', title: 'Proveedor', description: 'Confirmar', icon: Users },
  { id: 'products', title: 'Productos', description: 'Verificar', icon: Package },
  { id: 'invoices', title: 'Facturas', description: 'Adjuntar', icon: FileUp },
  { id: 'review', title: 'Revision', description: 'Verificar orden', icon: FileText },
  { id: 'confirmation', title: 'Confirmacion', description: 'Finalizar', icon: Check }
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
  // Imagen y descripción generadas con IA
  generatedImageUrl?: string
  generatedDescription?: string
  isGeneratingImage?: boolean
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

interface WarehouseInfo {
  id: number
  code: string
  name: string
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
  isNewProduct?: boolean // Producto nuevo detectado por OCR que aún no existe en inventario
}

interface OrderLine {
  productId: number
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  product: Product
  quantity: number
  unitCost: number
  unitPrice: number
  totalCost: number
  isNewProduct?: boolean // Línea con producto nuevo que se creará
}

interface CreatedOrder {
  id: number
  orderNumber: string
  totalItems: number
  totalUnits: number
  totalCost: number
}

export default function CreateConsignmentOrderPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Read initial step from URL
  const initialStep = (searchParams.get('step') as Step) || 'method'
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

  // Step: Supplier & Warehouse
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseInfo | null>(null)
  const [consignmentDate, setConsignmentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [supplierSearch, setSupplierSearch] = useState('')

  // Step 2: Products
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)

  // Step 3: Invoices
  const [invoiceFiles, setInvoiceFiles] = useState<InvoiceFile[]>([])

  // Step 4: Confirmation
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printServices, setPrintServices] = useState<Array<{
    id: number
    serviceName: string
    printers: Array<{
      id: number
      printerName: string
      isOnline: boolean
      isDefault: boolean
      printerType: string
    }>
  }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load suppliers and warehouses (usando market_suppliers unificado)
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
          console.log('[Consignment] Loaded suppliers:', data)
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
            console.log('[Consignment] Mapped suppliers:', mappedSuppliers.length)
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
      if (productSearch) searchProducts(productSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Handle file upload for AI scan
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setScanError('Formato no soportado. Usa JPG, PNG, WebP o PDF.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setScanError('El archivo es demasiado grande. Máximo 10MB.')
      return
    }

    setScanError(null)
    setInvoiceFileName(file.name)

    const reader = new FileReader()
    reader.onload = () => {
      setInvoiceFileBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // Process invoice with AI (OCR)
  const processInvoiceWithAI = useCallback(async () => {
    if (!invoiceFileBase64) return

    setIsScanning(true)
    setScanError(null)

    try {
      const response = await fetch('/api/consignments/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: invoiceFileBase64,
          userContext: aiContext || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setScannedData(data.data)
        console.log('[Consignment AI] OCR result:', data.data)
        console.log('[Consignment AI] Items received:', data.data.items)
        console.log('[Consignment AI] Items count:', data.data.items?.length || 0)

        if (data.data.items && data.data.items.length > 0) {
          await matchScannedProducts(data.data.items)
        } else {
          console.warn('[Consignment AI] No items received from OCR!')
          setMatchedProducts([])
        }
        setCurrentStep('review-scan')
      } else {
        setScanError(data.error || 'Error al procesar la factura')
      }
    } catch (error) {
      console.error('Error processing invoice:', error)
      setScanError('Error de conexión al procesar la factura')
    } finally {
      setIsScanning(false)
    }
  }, [invoiceFileBase64, aiContext])

  // Match scanned products against database
  const matchScannedProducts = useCallback(async (items: ScannedItem[]) => {
    console.log('[Consignment AI] Matching products, items to match:', items.length)
    setIsMatching(true)

    try {
      const response = await fetch('/api/market/products/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })

      const data = await response.json()
      console.log('[Consignment AI] Match API response:', data)

      if (data.success) {
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
          action: item.matchType !== 'none' ? 'use_existing' : 'create_new'
        }))

        console.log('[Consignment AI] Matched products:', matched.length, matched)
        setMatchedProducts(matched)
      } else {
        console.error('[Consignment AI] Match API failed:', data.error)
      }
    } catch (error) {
      console.error('Error matching products:', error)
    } finally {
      setIsMatching(false)
    }
  }, [])

  // Handle product action change
  const handleProductAction = useCallback((itemId: string, action: MatchedItem['action'], linkedProductId?: number) => {
    setMatchedProducts(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, action, linkedProductId }
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
      console.log('[Consignment] Generating AI image for:', item.name)

      const response = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          productName: item.name,
          productDescription: item.description || `Producto: ${item.name}`,
          saveToStorage: false // No guardamos aún, solo preview
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        console.log('[Consignment] AI image generated successfully')
        setMatchedProducts(prev => prev.map(p =>
          p.id === itemId ? {
            ...p,
            generatedImageUrl: data.data.imageUrl || data.data.imageBase64,
            generatedDescription: data.data.imageDescription,
            isGeneratingImage: false
          } : p
        ))
      } else {
        console.error('[Consignment] AI image generation failed:', data.error)
        setMatchedProducts(prev => prev.map(p =>
          p.id === itemId ? { ...p, isGeneratingImage: false } : p
        ))
      }
    } catch (error) {
      console.error('[Consignment] Error generating AI image:', error)
      setMatchedProducts(prev => prev.map(p =>
        p.id === itemId ? { ...p, isGeneratingImage: false } : p
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

  // Confirm scanned products and move to supplier step
  const confirmScannedProducts = useCallback(async () => {
    const activeProducts = matchedProducts.filter(p => p.action !== 'ignore')

    if (activeProducts.length === 0) {
      setScanError('Debes incluir al menos un producto')
      return
    }

    console.log('[Consignment] Confirming products:', activeProducts.length)

    const newLines: OrderLine[] = []

    for (const item of activeProducts) {
      if (item.action === 'use_existing' && item.matchedProduct) {
        // Producto existente encontrado en el inventario
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
          newLines.push({
            productId: item.matchedProduct.id,
            variantId: item.matchedVariant.id,
            variantName: item.matchedVariant.name,
            variantSku: item.matchedVariant.sku,
            product,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitPrice: item.matchedVariant.price,
            totalCost: item.totalCost
          })
        } else {
          newLines.push({
            productId: item.matchedProduct.id,
            variantId: null,
            variantName: null,
            variantSku: null,
            product,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitPrice: item.matchedProduct.sellingPrice,
            totalCost: item.totalCost
          })
        }
      } else if (item.action === 'link_to' && item.linkedProductId) {
        // Producto vinculado manualmente
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
              unitCost: item.unitCost,
              unitPrice: linkedProduct.sellingPrice,
              totalCost: item.totalCost
            })
          }
        } catch (error) {
          console.error('Error fetching linked product:', error)
        }
      } else if (item.action === 'create_new') {
        // Producto nuevo - crear producto temporal para agregar a la orden
        // El usuario podrá crearlo en el inventario después o durante el proceso
        const tempProduct: Product = {
          id: -Date.now() - newLines.length, // ID temporal negativo
          name: item.name,
          sku: item.sku || '',
          barcode: item.barcode,
          imageUrl: null,
          costPrice: item.unitCost,
          sellingPrice: item.unitCost * 1.3, // Margen sugerido del 30%
          currency: 'USD',
          quantityOnHand: 0,
          hasVariants: false,
          isNewProduct: true // Marcador para saber que es nuevo
        }

        newLines.push({
          productId: tempProduct.id,
          variantId: null,
          variantName: null,
          variantSku: null,
          product: tempProduct,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unitPrice: tempProduct.sellingPrice,
          totalCost: item.totalCost,
          isNewProduct: true
        })
      }
    }

    console.log('[Consignment] Order lines created:', newLines.length)
    setOrderLines(newLines)

    // Pre-fill supplier if detected - improved matching algorithm
    if (scannedData?.vendorName) {
      const vendorName = scannedData.vendorName
      console.log('[Consignment] Trying to match vendor:', vendorName)
      console.log('[Consignment] Available suppliers:', suppliers.map(s => s.name))

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
      let matchingSupplier = suppliers.find(s => {
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
        console.log('[Consignment] Auto-matched supplier:', matchingSupplier.name, 'from', vendorName)
        setSelectedSupplier(matchingSupplier)
      } else {
        console.log('[Consignment] No matching supplier found for:', vendorName, '- Normalized:', normalizedVendor)
        // Pre-fill search with detected vendor name so user can see results immediately
        setSupplierSearch(vendorName)
      }
    }

    if (scannedData?.invoiceDate) {
      setConsignmentDate(scannedData.invoiceDate)
    }

    // Siempre ir al paso de proveedor/almacén para que el usuario pueda:
    // 1. Confirmar o cambiar el proveedor pre-seleccionado
    // 2. Seleccionar el almacén destino (obligatorio)
    setCurrentStep('supplier')
  }, [matchedProducts, scannedData, suppliers])

  // Reset AI scan data
  const resetAIScan = useCallback(() => {
    setInvoiceFileBase64(null)
    setInvoiceFileName('')
    setAiContext('')
    setScannedData(null)
    setMatchedProducts([])
    setScanError(null)
  }, [])

  // Handle barcode scan
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return

    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(barcodeInput)}&limit=1`)
      const data = await response.json()
      if (data.success && data.data.products?.length > 0) {
        // Use handleProductClick to properly check for variants
        handleProductClick(data.data.products[0])
      } else {
        setErrors({ barcode: 'Producto no encontrado' })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSearchingProducts(false)
      setBarcodeInput('')
    }
  }

  // Add product to order (with optional variant)
  const addProductToOrder = (product: Product, variant?: ProductVariant | null) => {
    const variantId = variant?.id ?? null
    const unitCost = variant?.costPrice ?? variant?.price ?? product.costPrice
    const unitPrice = variant?.price ?? product.sellingPrice

    // Find existing line by product.id + variant.id combination
    const existing = orderLines.find(l =>
      l.productId === product.id && l.variantId === variantId
    )

    if (existing) {
      setOrderLines(prev => prev.map(l =>
        l.productId === product.id && l.variantId === variantId
          ? { ...l, quantity: l.quantity + 1, totalCost: (l.quantity + 1) * l.unitCost }
          : l
      ))
    } else {
      setOrderLines(prev => [...prev, {
        productId: product.id,
        variantId,
        variantName: variant?.name ?? null,
        variantSku: variant?.sku ?? null,
        product,
        quantity: 1,
        unitCost: unitCost,
        unitPrice: unitPrice,
        totalCost: unitCost
      }])
    }
    setProductSearch('')
    setProductResults([])
    setShowVariantModal(false)
    setSelectedProductForVariant(null)
    setErrors({})
  }

  // Handle product click - show variant modal if product has variants
  const handleProductClick = (product: Product) => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setSelectedProductForVariant(product)
      setShowVariantModal(true)
    } else {
      addProductToOrder(product, null)
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
      addProductToOrder(selectedProductForVariant, productVariant)
    }
  }

  // Update line
  const updateLine = (productId: number, variantId: number | null, field: 'quantity' | 'unitCost' | 'unitPrice', value: number) => {
    if (value < 0) return
    if (field === 'quantity' && value < 1) return

    setOrderLines(prev => prev.map(l => {
      if (l.productId !== productId || l.variantId !== variantId) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unitCost') {
        updated.totalCost = updated.quantity * updated.unitCost
      }
      return updated
    }))
  }

  // Remove line
  const removeLine = (productId: number, variantId: number | null) => {
    setOrderLines(prev => prev.filter(l => !(l.productId === productId && l.variantId === variantId)))
  }

  // Calculate totals
  const totalItems = orderLines.length
  const totalUnits = orderLines.reduce((sum, l) => sum + l.quantity, 0)
  const totalCost = orderLines.reduce((sum, l) => sum + l.totalCost, 0)

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'supplier':
        if (!selectedSupplier) newErrors.supplier = 'Selecciona un proveedor'
        if (!selectedWarehouse) newErrors.warehouse = 'Selecciona un almacen'
        break
      case 'products':
        if (orderLines.length === 0) newErrors.products = 'Agrega al menos un producto'
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

  // Submit order
  const handleSubmitOrder = async () => {
    setSubmitting(true)
    try {
      // Preparar los productos nuevos que necesitan ser creados
      const newProducts = orderLines
        .filter(l => l.isNewProduct && l.productId < 0)
        .map(l => ({
          tempId: l.productId, // ID temporal negativo
          name: l.product.name,
          sku: l.product.sku || null,
          barcode: l.product.barcode || null,
          unitCost: l.unitCost,
          sellingPrice: l.unitPrice || l.unitCost * 1.3,
          category: 'General'
        }))

      console.log('[Submit Order] New products to create:', newProducts)
      console.log('[Submit Order] Order lines:', orderLines.map(l => ({
        productId: l.productId,
        name: l.product.name,
        isNewProduct: l.isNewProduct
      })))

      const response = await fetch('/api/consignments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier?.id,
          supplierName: selectedSupplier?.name, // For auto-creating new suppliers
          warehouseId: selectedWarehouse?.id,
          consignmentDate,
          notes: notes || null,
          lines: orderLines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            unitPrice: l.unitPrice,
            isNewProduct: l.isNewProduct || false
          })),
          newProducts: newProducts.length > 0 ? newProducts : undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        const orderId = data.data.id

        // Upload invoices if any
        if (invoiceFiles.length > 0) {
          try {
            const formData = new FormData()
            invoiceFiles.forEach(inv => {
              formData.append('files', inv.file)
            })
            formData.append('orderType', 'consignment')
            formData.append('orderId', orderId.toString())

            await fetch('/api/upload/order-invoices', {
              method: 'POST',
              body: formData
            })
          } catch (uploadError) {
            console.error('Error uploading invoices:', uploadError)
            // Continue even if invoice upload fails
          }
        }

        setCreatedOrder(data.data)
        setCurrentStep('confirmation')
      } else {
        setErrors({ submit: data.error || 'Error al crear orden' })
      }
    } catch (error) {
      console.error('Error:', error)
      setErrors({ submit: 'Error de conexion' })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  // Fetch print services for silent printing
  const fetchPrintServices = async () => {
    try {
      const response = await fetch('/api/print/services?includeOffline=false')
      const data = await response.json()
      if (data.success && data.data?.services) {
        const activeServices = data.data.services.filter(
          (s: { status: string; printers?: unknown[] }) => s.status === 'active' && s.printers && s.printers.length > 0
        )
        setPrintServices(activeServices)

        // Auto-select first available printer
        for (const service of activeServices) {
          const availablePrinter = service.printers.find(
            (p: { isOnline: boolean }) => p.isOnline
          )
          if (availablePrinter) {
            setSelectedPrinter({ serviceId: service.id, printerId: availablePrinter.id })
            break
          }
        }
      }
    } catch (err) {
      console.error('[Consignment Print] Error fetching print services:', err)
    }
  }

  // Print with silent service
  const printWithSilentService = async () => {
    if (!createdOrder || !selectedSupplier || !selectedWarehouse || !selectedPrinter) return

    setPrintingWithService(true)
    try {
      const response = await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'consignment_receipt',
          documentData: {
            orderNumber: createdOrder.orderNumber,
            supplier: {
              code: selectedSupplier.supplierCode,
              name: selectedSupplier.name,
              phone: selectedSupplier.phone
            },
            warehouse: {
              code: selectedWarehouse.code,
              name: selectedWarehouse.name
            },
            lines: orderLines.map(l => ({
              productName: l.product.name,
              sku: l.product.sku,
              barcode: l.product.barcode,
              quantity: l.quantity,
              unitCost: l.unitCost,
              totalCost: l.totalCost
            })),
            totalItems: createdOrder.totalItems,
            totalUnits: createdOrder.totalUnits,
            totalCost: createdOrder.totalCost,
            consignmentDate: consignmentDate,
            notes: notes || undefined
          },
          copies,
          printServiceId: selectedPrinter.serviceId,
          printerId: selectedPrinter.printerId,
          sourceType: 'consignment_order',
          sourceId: createdOrder.id,
          warehouseId: selectedWarehouse.id
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('[Consignment Print] Error printing with service:', err)
      setShowPrintModal(false)
    } finally {
      setPrintingWithService(false)
    }
  }

  // Handle print button click
  const handlePrint = () => {
    fetchPrintServices()
    setShowPrintModal(true)
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.supplierCode && s.supplierCode.toLowerCase().includes(supplierSearch.toLowerCase()))
  )

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
                                ? 'rgba(16, 185, 129, 0.5)'
                                : 'rgba(5, 150, 105, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#10B981' : '#059669'
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
                                ? 'shadow-lg shadow-emerald-500/50'
                                : 'shadow-lg shadow-emerald-400/50'
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-emerald-500/30'
                                : 'shadow-md shadow-emerald-400/30'
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
                            ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
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
                            theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600'
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
                      ¿Cómo deseas registrar esta consignación?
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setEntryMethod('ai'); setCurrentStep('scan') }}
                        className={cn(
                          "p-6 rounded-2xl border-2 text-left transition-all",
                          theme === 'dark'
                            ? 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100')}>
                            <Sparkles className="w-7 h-7 text-blue-500" />
                          </div>
                          <div>
                            <h3 className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Mediante Factura con IA</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white font-medium">Recomendado</span>
                          </div>
                        </div>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Sube una foto o PDF de la factura del proveedor y la IA detectará automáticamente los productos.
                        </p>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setEntryMethod('manual'); setCurrentStep('supplier') }}
                        className={cn(
                          "p-6 rounded-2xl border-2 text-left transition-all",
                          theme === 'dark'
                            ? 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
                            : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100')}>
                            <Edit3 className="w-7 h-7 text-green-500" />
                          </div>
                          <div>
                            <h3 className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>Entrada Manual</h3>
                          </div>
                        </div>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Agrega los productos uno por uno buscando en tu inventario.
                        </p>
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
                    <h2 className={cn("text-xl font-bold flex items-center gap-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      Escanear Factura de Consignación
                    </h2>

                    {/* File Upload Area */}
                    <div className={cn(
                      "border-2 border-dashed rounded-2xl p-8 text-center transition-all relative overflow-hidden",
                      invoiceFileBase64
                        ? theme === 'dark' ? 'border-green-500/50 bg-green-900/10' : 'border-green-300 bg-green-50'
                        : theme === 'dark' ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400',
                      isScanning && 'border-cyan-500/50'
                    )}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileUpload} className="hidden" id="consignment-invoice-upload" disabled={isScanning} />
                      <label htmlFor="consignment-invoice-upload" className={cn("cursor-pointer block", isScanning && "pointer-events-none")}>
                        {invoiceFileBase64 ? (
                          <div className="space-y-4 relative">
                            {invoiceFileBase64.startsWith('data:image') ? (
                              <div className="relative inline-block mx-auto">
                                <img src={invoiceFileBase64} alt="Factura" className={cn("max-h-64 mx-auto rounded-xl shadow-lg transition-all duration-500", isScanning && "brightness-75")} />
                                {/* Scanning Line Effect */}
                                {isScanning && (
                                  <motion.div
                                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                                    initial={{ top: '0%' }}
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="relative inline-block mx-auto">
                                <div className={cn(
                                  "w-24 h-32 mx-auto rounded-xl flex items-center justify-center overflow-hidden transition-all duration-500",
                                  isScanning ? "bg-gradient-to-br from-red-100 to-cyan-100 dark:from-red-900/30 dark:to-cyan-900/30" : theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                                )}>
                                  <FileText className={cn("w-12 h-12 transition-colors duration-500", isScanning ? "text-cyan-600" : "text-red-500")} />
                                  {/* PDF Scanning Effect */}
                                  {isScanning && (
                                    <motion.div
                                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                                      initial={{ top: '0%' }}
                                      animate={{ top: ['0%', '100%', '0%'] }}
                                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                            {!isScanning && (
                              <>
                                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>{invoiceFileName}</p>
                                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Haz clic para cambiar el archivo</p>
                              </>
                            )}
                          </div>
                        ) : (
                          <>
                            <Upload className={cn("w-16 h-16 mx-auto mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                            <p className={cn("text-lg font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Arrastra o haz clic para subir</p>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>JPG, PNG, WebP o PDF (máx. 10MB)</p>
                          </>
                        )}
                      </label>

                      {/* AI Processing Overlay */}
                      <AnimatePresence>
                        {isScanning && (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-6">
                            {/* Glassmorphism Card */}
                            <div className={cn(
                              "relative p-6 rounded-2xl backdrop-blur-xl overflow-hidden",
                              theme === 'dark' ? "bg-gray-900/80 border border-gray-700/50" : "bg-white/80 border border-gray-200/50"
                            )}>
                              {/* Animated border glow */}
                              <motion.div
                                className="absolute inset-0 rounded-2xl"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)', backgroundSize: '200% 100%' }}
                                animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              />

                              {/* Content */}
                              <div className="relative z-10 flex flex-col items-center">
                                {/* Animated Icon Container */}
                                <motion.div
                                  className={cn(
                                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                                    theme === 'dark' ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30" : "bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200"
                                  )}
                                  animate={{ boxShadow: ['0 0 0 0 rgba(34, 211, 238, 0)', '0 0 0 10px rgba(34, 211, 238, 0.1)', '0 0 0 0 rgba(34, 211, 238, 0)'] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                  <AnimatePresence mode="wait">
                                    <motion.div key={ocrStep} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 180 }} transition={{ duration: 0.3 }}>
                                      {React.createElement(ocrSteps[ocrStep].icon, { className: "w-8 h-8 text-cyan-500" })}
                                    </motion.div>
                                  </AnimatePresence>
                                </motion.div>

                                {/* Step Text */}
                                <AnimatePresence mode="wait">
                                  <motion.p key={ocrStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className={cn("font-semibold text-lg", theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600')}>
                                    {ocrSteps[ocrStep].text}
                                  </motion.p>
                                </AnimatePresence>
                                <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Esto puede tomar unos segundos...</p>

                                {/* Progress Bar */}
                                <div className={cn("w-full h-1.5 rounded-full mt-4 overflow-hidden", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                  <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 6, ease: 'linear' }} />
                                </div>
                              </div>

                              {/* Particle effects */}
                              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {[...Array(6)].map((_, i) => (
                                  <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-cyan-400"
                                    initial={{ x: '50%', y: '50%', opacity: 0 }}
                                    animate={{ x: `${20 + Math.random() * 60}%`, y: `${20 + Math.random() * 60}%`, opacity: [0, 1, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
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
                        <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Instrucciones para la IA (opcional)</label>
                        <textarea
                          value={aiContext}
                          onChange={(e) => setAiContext(e.target.value)}
                          placeholder="Ej: El yogurt que viene en diferentes sabores son variantes del mismo producto..."
                          rows={3}
                          className={cn("w-full px-4 py-3 rounded-xl border resize-none", theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400')}
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {scanError && !isScanning && (
                      <div className="p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/30">
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
                          "w-full py-4 rounded-xl font-medium flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-400/30'
                        )}
                      >
                        <Sparkles className="w-5 h-5" />Procesar con IA
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
                      <h2 className={cn("text-xl font-bold flex items-center gap-3", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                        Revisar Productos Detectados
                      </h2>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { resetAIScan(); setCurrentStep('scan') }}
                        className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium", theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}>
                        <RefreshCw className="w-4 h-4" />Escanear otra
                      </motion.button>
                    </div>

                    {scannedData?.vendorName && (
                      <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                        <label className={cn('text-xs font-medium mb-1 block', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Proveedor detectado</label>
                        <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{scannedData.vendorName}</p>
                      </div>
                    )}

                    {matchedProducts.filter(p => p.matchType !== 'none').length > 0 && (
                      <div>
                        <h3 className={cn("font-bold flex items-center gap-2 mb-3", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                          <CheckCircle2 className="w-5 h-5" />Productos Identificados ({matchedProducts.filter(p => p.matchType !== 'none').length})
                        </h3>
                        <div className="space-y-3">
                          {matchedProducts.filter(p => p.matchType !== 'none').map((item) => (
                            <div key={item.id} className={cn('p-4 rounded-xl border', item.action === 'ignore' ? 'opacity-50' : '', theme === 'dark' ? 'bg-green-900/20 border-green-800/50' : 'bg-green-50 border-green-200')}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{item.name}</p>
                                  <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>→ {item.matchedProduct?.name}</p>
                                  <span className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>{item.quantity} {item.unitOfMeasure || 'unidad'} × ${item.unitCost.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>${item.totalCost.toFixed(2)}</span>
                                  <button onClick={() => handleProductAction(item.id, item.action === 'ignore' ? 'use_existing' : 'ignore')} className={cn('p-2 rounded-lg', item.action === 'ignore' ? 'text-green-500' : 'text-gray-400 hover:text-red-500')}>
                                    {item.action === 'ignore' ? <Plus className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchedProducts.filter(p => p.matchType === 'none').length > 0 && (
                      <div>
                        <h3 className={cn("font-bold flex items-center gap-2 mb-3", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                          <AlertTriangle className="w-5 h-5" />Productos Nuevos ({matchedProducts.filter(p => p.matchType === 'none').length})
                        </h3>
                        <div className="space-y-3">
                          {matchedProducts.filter(p => p.matchType === 'none').map((item) => (
                            <div key={item.id} className={cn('p-4 rounded-xl border', item.action === 'ignore' ? 'opacity-50' : '', theme === 'dark' ? 'bg-amber-900/20 border-amber-800/50' : 'bg-amber-50 border-amber-200')}>
                              <div className="flex items-start gap-3">
                                {/* Imagen del producto (generada o placeholder) */}
                                <div className="relative flex-shrink-0">
                                  {item.generatedImageUrl ? (
                                    <img
                                      src={item.generatedImageUrl}
                                      alt={item.name}
                                      className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                    />
                                  ) : (
                                    <div className={cn(
                                      'w-16 h-16 rounded-lg flex items-center justify-center',
                                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                                    )}>
                                      <ImageIcon className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  {/* Boton para generar imagen con IA */}
                                  <button
                                    onClick={() => generateImageWithAI(item.id)}
                                    disabled={item.isGeneratingImage || item.action === 'ignore'}
                                    className={cn(
                                      'absolute -bottom-1 -right-1 p-1.5 rounded-full shadow-lg transition-all',
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
                                {/* Info del producto */}
                                <div className="flex-1 min-w-0">
                                  <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{item.name}</p>
                                  <span className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>{item.quantity} {item.unitOfMeasure || 'unidad'} × ${item.unitCost.toFixed(2)}</span>
                                  {item.generatedDescription && (
                                    <p className={cn('text-xs mt-1 truncate', theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                                      {item.generatedDescription}
                                    </p>
                                  )}
                                </div>
                                {/* Acciones */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>${item.totalCost.toFixed(2)}</span>
                                  <button onClick={() => { setLinkingItemId(item.id); setLinkSearch(''); setShowLinkModal(true) }} className="p-2 rounded-lg text-blue-500 hover:bg-blue-500/10" title="Vincular a existente">
                                    <Link2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleProductAction(item.id, item.action === 'ignore' ? 'create_new' : 'ignore')} className={cn('p-2 rounded-lg', item.action === 'ignore' ? 'text-green-500' : 'text-gray-400 hover:text-red-500')} title={item.action === 'ignore' ? 'Incluir' : 'Excluir'}>
                                    {item.action === 'ignore' ? <Plus className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                              {item.suggestedMatches.length > 0 && item.action !== 'ignore' && item.action !== 'link_to' && (
                                <div className={cn('mt-3 pt-3 border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                                  <p className={cn('text-xs mb-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Sugerencias:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.suggestedMatches.map((s) => (
                                      <button key={s.id} onClick={() => handleProductAction(item.id, 'link_to', s.id)} className={cn('px-3 py-1 rounded-full text-xs font-medium', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')}>
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

                    <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50')}>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Total: {matchedProducts.filter(p => p.action !== 'ignore').length} productos
                      </p>
                      <p className={cn('text-2xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        ${matchedProducts.filter(p => p.action !== 'ignore').reduce((sum, p) => sum + p.totalCost, 0).toFixed(2)}
                      </p>
                    </div>

                    {scanError && (
                      <div className="p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/30">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-red-500 text-sm">{scanError}</p>
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={confirmScannedProducts}
                      disabled={matchedProducts.filter(p => p.action !== 'ignore').length === 0}
                      className={cn(
                        "w-full py-4 rounded-xl font-medium flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                        theme === 'dark' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/30' : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-400/30'
                      )}
                    >
                      <Check className="w-5 h-5" />Continuar con estos productos
                    </motion.button>
                  </motion.div>
                )}

                {/* Step: Supplier */}
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

                    {/* Date */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Fecha de Consignacion
                      </label>
                      <div className="relative max-w-xs">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={consignmentDate}
                          onChange={(e) => setConsignmentDate(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
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
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      Agregar Productos
                    </h2>

                    {/* Barcode Scanner */}
                    <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                      <div className="flex-1 relative">
                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Escanear codigo de barras..."
                          autoFocus
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={searchingProducts}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                      >
                        {searchingProducts ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      </motion.button>
                    </form>
                    {errors.barcode && (
                      <p className="text-sm text-red-500">{errors.barcode}</p>
                    )}

                    {/* Product Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre o SKU..."
                        className={cn(
                          'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />

                      {/* Search Results */}
                      {productResults.length > 0 && (
                        <div className={cn(
                          'absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-10 max-h-64 overflow-y-auto',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}>
                          {productResults.map(product => (
                            <button
                              key={product.id}
                              onClick={() => handleProductClick(product)}
                              className={cn(
                                'w-full p-3 flex items-center gap-3 text-left transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                              )}
                            >
                              <Package className="w-5 h-5 text-gray-400" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                                <p className="text-xs text-gray-500">SKU: {product.sku} | Costo: {formatCurrency(product.costPrice)}</p>
                              </div>
                              <Plus className="w-5 h-5 text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Order Lines */}
                    <div className="space-y-3">
                      {orderLines.length === 0 ? (
                        <div className={cn(
                          'text-center py-12 rounded-xl border-2 border-dashed',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>No hay productos agregados</p>
                          <p className={cn(
                            "text-sm mt-1",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>Escanea o busca productos para agregar</p>
                        </div>
                      ) : (
                        orderLines.map((line, index) => (
                          <motion.div
                            key={line.productId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              'p-4 rounded-xl border',
                              theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className="text-xs text-gray-500">SKU: {line.product.sku}</p>
                              </div>

                              <div className="flex items-center gap-4">
                                {/* Quantity */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateLine(line.productId, line.variantId, 'quantity', parseInt(e.target.value) || 1)}
                                    min={1}
                                    className={cn(
                                      'w-20 px-3 py-1.5 rounded-lg border text-center',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Unit Cost */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Costo</label>
                                  <input
                                    type="number"
                                    value={line.unitCost}
                                    onChange={(e) => updateLine(line.productId, line.variantId, 'unitCost', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min={0}
                                    className={cn(
                                      'w-24 px-3 py-1.5 rounded-lg border text-right',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Unit Price */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">P. Venta</label>
                                  <input
                                    type="number"
                                    value={line.unitPrice}
                                    onChange={(e) => updateLine(line.productId, line.variantId, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min={0}
                                    className={cn(
                                      'w-24 px-3 py-1.5 rounded-lg border text-right',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Total */}
                                <div className="text-right min-w-[80px]">
                                  <label className="block text-xs text-gray-500 mb-1">Total</label>
                                  <p className="font-bold text-emerald-600">{formatCurrency(line.totalCost)}</p>
                                </div>

                                {/* Remove */}
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeLine(line.productId, line.variantId)}
                                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>

                    {errors.products && (
                      <p className="text-sm text-red-500">{errors.products}</p>
                    )}

                    {/* Summary */}
                    {orderLines.length > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'
                      )}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Productos:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{totalItems}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Unidades:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{totalUnits}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-gray-900 dark:text-white">Total Costo:</span>
                          <span className="text-emerald-600">{formatCurrency(totalCost)}</span>
                        </div>
                      </div>
                    )}
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
                      orderType="consignment"
                    />
                  </motion.div>
                )}

                {/* Step 4: Review */}
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      Revisar Orden
                    </h2>

                    {/* Order Info */}
                    <div className={cn(
                      'rounded-2xl p-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className={cn(
                          'p-4 rounded-xl',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <h3 className="text-xs text-gray-500 mb-2">Proveedor</h3>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'px-2 py-1 rounded-lg text-xs font-mono font-bold',
                              theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                            )}>
                              {selectedSupplier?.supplierCode}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedSupplier?.name}</p>
                              {selectedSupplier?.phone && (
                                <p className="text-xs text-gray-500">{selectedSupplier.phone}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={cn(
                          'p-4 rounded-xl',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <h3 className="text-xs text-gray-500 mb-2">Almacen Destino</h3>
                          <div className="flex items-center gap-3">
                            <Warehouse className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedWarehouse?.name}</p>
                              <p className="text-xs text-gray-500">{selectedWarehouse?.code}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
                          <p className="text-xs text-gray-500">productos</p>
                        </div>
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnits}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCost)}</p>
                          <p className="text-xs text-gray-500">total costo</p>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className={cn(
                      'rounded-xl border overflow-hidden',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <table className="w-full">
                        <thead className={cn(
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        )}>
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cant.</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Costo</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P. Venta</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {orderLines.map(line => (
                            <tr key={`${line.productId}-${line.variantId || 'base'}`}>
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className="text-xs text-gray-500">SKU: {line.variantSku || line.product.sku}</p>
                              </td>
                              <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">{line.quantity}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(line.unitCost)}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(line.unitPrice)}</td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(line.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={cn(
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        )}>
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                              Total:
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600 text-lg">
                              {formatCurrency(totalCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
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
                            Se subiran al crear la orden
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Agregar notas u observaciones..."
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                        )}
                      />
                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 'confirmation' && createdOrder && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Orden Creada Exitosamente
                    </h2>
                    <p className="text-gray-500 mb-6">
                      La orden de consignacion ha sido registrada
                    </p>

                    <div className={cn(
                      'inline-block p-6 rounded-2xl mb-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500 mb-1">Numero de Orden</p>
                      <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                        {createdOrder.orderNumber}
                      </p>
                      <div className="flex justify-center gap-6 mt-4">
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{createdOrder.totalItems}</p>
                          <p className="text-xs text-gray-500">productos</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{createdOrder.totalUnits}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(createdOrder.totalCost)}</p>
                          <p className="text-xs text-gray-500">total</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePrint}
                        className={cn(
                          'flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
                          theme === 'dark'
                            ? 'bg-gray-700 text-white hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        <Printer className="w-5 h-5" />
                        Imprimir Recepcion
                      </motion.button>

                      <Link href="/dashboard/market/consignments">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                        >
                          Ver Ordenes
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            {currentStep !== 'confirmation' && (
              <div className="flex justify-between items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToPrevStep}
                  disabled={currentStepIndex === 0}
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
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-400/30',
                      'text-white'
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Crear Orden
                      </>
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
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-400/30',
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
                            ¿Cancelar orden?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perdera toda la informacion ingresada y no podras recuperarla.
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
                        onClick={() => router.push('/dashboard/market/consignments')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
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

          {/* Print Modal */}
          <AnimatePresence>
            {showPrintModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPrintModal(false)}
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
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Printer className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Imprimir Recepcion
                          </h3>
                          <p className="text-xs text-gray-500">#{createdOrder?.orderNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPrintModal(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {printServices.length === 0 ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
                          <p className="text-gray-500">Buscando impresoras...</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Seleccionar Impresora
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {printServices.map(service => (
                                service.printers.map(printer => (
                                  <button
                                    key={`${service.id}-${printer.id}`}
                                    onClick={() => setSelectedPrinter({ serviceId: service.id, printerId: printer.id })}
                                    className={cn(
                                      'w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between',
                                      selectedPrinter?.printerId === printer.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : theme === 'dark'
                                          ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Printer className={cn(
                                        "w-5 h-5",
                                        selectedPrinter?.printerId === printer.id ? 'text-emerald-600' : 'text-gray-400'
                                      )} />
                                      <div>
                                        <p className={cn(
                                          "font-medium",
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          {printer.printerName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {printer.printerType === 'thermal_80mm' ? 'Termica 80mm' : 'Estandar'}
                                        </p>
                                      </div>
                                    </div>
                                    {printer.isOnline ? (
                                      <span className="text-xs text-emerald-500 font-medium">Online</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">Offline</span>
                                    )}
                                  </button>
                                ))
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Copias
                            </label>
                            <div className="flex items-center justify-center gap-4">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.max(1, copies - 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                -
                              </motion.button>
                              <span className={cn(
                                "w-12 text-center text-xl font-bold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {copies}
                              </span>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.min(5, copies + 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                +
                              </motion.button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {printServices.length > 0 && (
                      <div className={cn(
                        "flex gap-3 p-6 pt-4 border-t",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowPrintModal(false)}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          )}
                        >
                          Cancelar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={printWithSilentService}
                          disabled={printingWithService || !selectedPrinter}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                            "bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                          )}
                        >
                          {printingWithService ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Printer className="w-5 h-5" />
                              Imprimir
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}
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
                onClick={() => { setShowLinkModal(false); setLinkingItemId(null) }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('w-full max-w-lg rounded-2xl shadow-xl overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className={cn('p-4 border-b flex items-center justify-between', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('text-lg font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <Link2 className="w-5 h-5 text-blue-500" />Vincular a Producto Existente
                    </h3>
                    <button onClick={() => { setShowLinkModal(false); setLinkingItemId(null) }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <Search className="w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        autoFocus
                        className={cn('flex-1 bg-transparent outline-none', theme === 'dark' ? 'text-white' : 'text-gray-900')}
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
                              if (linkingItemId) handleProductAction(linkingItemId, 'link_to', product.id)
                              setShowLinkModal(false)
                              setLinkingItemId(null)
                              setLinkSearch('')
                            }}
                            className="w-full p-4 flex items-center gap-4 text-left"
                          >
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>SKU: {product.sku}</p>
                            </div>
                            <div className="text-right">
                              <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>${product.costPrice.toFixed(2)}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : linkSearch.length >= 2 && !searchingLink ? (
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
            currency="USD"
          />
        </div>
      
    
  )
}
