'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Check,
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Loader2,
  Barcode,
  Tag,
  Truck,
  Plus,
  Trash2,
  Edit3,
  Scale,
  Sparkles,
  Wand2,
  AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'

type Step = 'info' | 'image' | 'pricing' | 'variants' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'info', title: 'Información', description: 'Datos básicos', icon: Package },
  { id: 'image', title: 'Imagen', description: 'Foto del producto', icon: ImageIcon },
  { id: 'pricing', title: 'Precios', description: 'Costos y venta', icon: DollarSign },
  { id: 'variants', title: 'Variantes', description: 'Colores, tallas...', icon: Layers },
  { id: 'review', title: 'Revisión', description: 'Confirmar datos', icon: Check }
]

const CATEGORIES = [
  'Alimentos',
  'Bebidas',
  'Carnes y Embutidos',
  'Lácteos',
  'Frutas y Verduras',
  'Panadería',
  'Limpieza',
  'Higiene Personal',
  'Electrodomésticos',
  'Electrónica',
  'Ropa',
  'Hogar',
  'Otros'
]

const UNITS_OF_MEASURE = [
  { id: 'unidad', name: 'Unidad', abbr: 'u' },
  { id: 'kg', name: 'Kilogramo', abbr: 'kg' },
  { id: 'lb', name: 'Libra', abbr: 'lb' },
  { id: 'g', name: 'Gramo', abbr: 'g' },
  { id: 'oz', name: 'Onza', abbr: 'oz' },
  { id: 'lt', name: 'Litro', abbr: 'lt' },
  { id: 'gal', name: 'Galón', abbr: 'gal' },
  { id: 'ml', name: 'Mililitro', abbr: 'ml' },
  { id: 'docena', name: 'Docena', abbr: 'doc' },
  { id: 'caja', name: 'Caja', abbr: 'cj' },
  { id: 'paquete', name: 'Paquete', abbr: 'paq' },
  { id: 'par', name: 'Par', abbr: 'par' },
  { id: 'metro', name: 'Metro', abbr: 'm' },
  { id: 'yarda', name: 'Yarda', abbr: 'yd' }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

interface Variant {
  id: string
  name: string
  sku: string
  barcode: string
  costPrice: string
  sellingPrice: string
  options: { type: string; value: string }[]
  imageUrl: string
}

interface VariantType {
  id: string
  name: string
  values: string[]
}

export default function CreateProductPage() {
  const { theme } = useTheme()
  const router = useRouter()

  // Exchange rates for currency conversion
  const { USD_CUP_BCC, USD_MLC } = useMarketExchangeRates()

  const [currentStep, setCurrentStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // AI Suggestion states
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string
    description: string
    imageUrl?: string | null
  } | null>(null)
  const [showAiSuggestion, setShowAiSuggestion] = useState(false)
  const [generatingDescription, setGeneratingDescription] = useState(false)

  // Barcode image lookup states - soporta múltiples imágenes por barcode
  interface ExistingImageItem {
    url: string
    imageIndex: number
    isPrimary: boolean
  }
  const [existingImages, setExistingImages] = useState<ExistingImageItem[]>([])
  const [selectedExistingImage, setSelectedExistingImage] = useState<ExistingImageItem | null>(null)
  const [checkingImage, setCheckingImage] = useState(false)
  const [useExistingImage, setUseExistingImage] = useState(false)

  // AI Image processing states
  const [processWithAI, setProcessWithAI] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiImageResult, setAiImageResult] = useState<{
    qualityScore?: number
    suggestions?: string[]
  } | null>(null)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [cleaningImage, setCleaningImage] = useState(false)
  const [generatingVariantImage, setGeneratingVariantImage] = useState<string | null>(null) // variant id being generated
  const [cleaningVariantImage, setCleaningVariantImage] = useState<string | null>(null) // variant id being cleaned
  const [imagePrompt, setImagePrompt] = useState('') // Descripción para generar imagen del producto
  const [variantImagePrompts, setVariantImagePrompts] = useState<Record<string, string>>({}) // Descripción para generar imagen de variantes

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    unitOfMeasure: 'unidad',
    imageUrl: '',
    imageFile: null as File | null,
    costPrice: '',
    sellingPrice: '',
    currency: 'USD',
    sku: '',
    barcode: '',
    supplierName: '',
    supplierContact: '',
    supplierReference: '',
    minimumStock: '5',
    hasVariants: false
  })

  // Variant types (customizable)
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([])
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeValue, setNewTypeValue] = useState('')
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)

  // Variants
  const [variants, setVariants] = useState<Variant[]>([])
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Suggestion function
  const fetchAiSuggestion = async () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      return
    }

    setAiLoading(true)
    setShowAiSuggestion(false)

    try {
      const response = await fetch('/api/ai/product-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: formData.name.trim() })
      })

      const data = await response.json()

      if (data.success && data.data) {
        setAiSuggestion({
          category: data.data.category,
          description: data.data.description,
          imageUrl: data.data.imageUrl || null
        })
        setShowAiSuggestion(true)
      } else {
        console.error('AI Suggestion error:', data.error)
      }
    } catch (error) {
      console.error('AI Suggestion fetch error:', error)
    } finally {
      setAiLoading(false)
    }
  }

  // Apply AI suggestions
  const applyAiCategory = () => {
    if (aiSuggestion?.category) {
      setFormData(prev => ({ ...prev, category: aiSuggestion.category }))
    }
  }

  const applyAiDescription = () => {
    if (aiSuggestion?.description) {
      setFormData(prev => ({ ...prev, description: aiSuggestion.description }))
    }
  }

  // Generar descripción directamente con IA
  const generateDescriptionWithAI = async () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      return
    }

    setGeneratingDescription(true)

    try {
      const response = await fetch('/api/ai/product-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: formData.name.trim() })
      })

      const data = await response.json()

      if (data.success && data.data?.description) {
        setFormData(prev => ({ ...prev, description: data.data.description }))
        // También guardar la sugerencia completa por si quiere usarla después
        setAiSuggestion({
          category: data.data.category,
          description: data.data.description,
          imageUrl: data.data.imageUrl || null
        })
      } else {
        console.error('AI Description error:', data.error)
      }
    } catch (error) {
      console.error('AI Description fetch error:', error)
    } finally {
      setGeneratingDescription(false)
    }
  }

  const applyAiImage = () => {
    if (aiSuggestion?.imageUrl) {
      setFormData(prev => ({ ...prev, imageUrl: aiSuggestion.imageUrl || '' }))
    }
  }

  const applyAllAiSuggestions = () => {
    if (aiSuggestion) {
      setFormData(prev => ({
        ...prev,
        category: aiSuggestion.category || prev.category,
        description: aiSuggestion.description || prev.description,
        imageUrl: aiSuggestion.imageUrl || prev.imageUrl
      }))
      setShowAiSuggestion(false)
    }
  }

  // Generate a random EAN-13 compatible barcode
  const generateBarcode = (): string => {
    // Prefijo de país (generamos uno aleatorio para productos internos)
    const prefix = '200' // 200-299 son para uso interno
    // Número de producto aleatorio (9 dígitos)
    const product = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
    // Calcular dígito de control EAN-13
    const code = prefix + product
    let sum = 0
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3)
    }
    const checkDigit = (10 - (sum % 10)) % 10
    return code + checkDigit
  }

  // Ensure barcode exists before image operations
  const ensureBarcode = (): string => {
    if (formData.barcode && formData.barcode.trim() !== '') {
      return formData.barcode
    }
    const newBarcode = generateBarcode()
    setFormData(prev => ({ ...prev, barcode: newBarcode }))
    return newBarcode
  }

  // Check for existing images by barcode (soporta múltiples)
  useEffect(() => {
    const checkImageByBarcode = async () => {
      if (formData.barcode && formData.barcode.length >= 8) {
        setCheckingImage(true)
        try {
          const res = await fetch(`/api/products/image-by-barcode?barcode=${formData.barcode}`)
          const data = await res.json()
          if (data.success && data.found && data.data.images && data.data.images.length > 0) {
            const images: ExistingImageItem[] = data.data.images.map((img: any) => ({
              url: img.imageUrl,
              imageIndex: img.imageIndex || 1,
              isPrimary: img.isPrimary || false
            }))
            setExistingImages(images)
            // Pre-seleccionar la imagen principal
            const primary = images.find(img => img.isPrimary) || images[0]
            setSelectedExistingImage(primary)
          } else {
            setExistingImages([])
            setSelectedExistingImage(null)
          }
        } catch (error) {
          console.error('Error checking barcode image:', error)
          setExistingImages([])
          setSelectedExistingImage(null)
        }
        setCheckingImage(false)
      } else {
        setExistingImages([])
        setSelectedExistingImage(null)
      }
    }

    const timer = setTimeout(checkImageByBarcode, 500)
    return () => clearTimeout(timer)
  }, [formData.barcode])

  // Use selected existing image when user confirms
  const useFoundImage = () => {
    if (selectedExistingImage) {
      setFormData(prev => ({ ...prev, imageUrl: selectedExistingImage.url }))
      setUseExistingImage(true)
    }
  }

  // Generate image with AI
  const generateImageWithAI = async () => {
    if (!formData.name.trim()) {
      setErrors({ ...errors, image: 'Ingresa el nombre del producto primero' })
      return
    }

    // Ensure we have a barcode before generating image
    const barcodeToUse = ensureBarcode()

    setGeneratingImage(true)
    try {
      // Combinar descripción del producto con el prompt personalizado
      const fullDescription = imagePrompt.trim()
        ? `${formData.description || ''}. Estilo de imagen: ${imagePrompt}`.trim()
        : formData.description

      const res = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          productName: formData.name,
          productDescription: fullDescription,
          barcode: barcodeToUse,
          saveToStorage: true
        })
      })

      const data = await res.json()
      if (data.success && data.data?.generated) {
        // Usar imageUrl si se guardó, o imageBase64 para preview
        const imageToUse = data.data.imageUrl || data.data.imageBase64
        if (imageToUse) {
          setFormData(prev => ({ ...prev, imageUrl: imageToUse }))
        } else {
          setErrors({ ...errors, image: 'No se pudo generar la imagen' })
        }
      } else {
        setErrors({ ...errors, image: data.error || 'Error al generar imagen con IA' })
      }
    } catch (error) {
      console.error('Error generating image:', error)
      setErrors({ ...errors, image: 'Error al generar imagen' })
    }
    setGeneratingImage(false)
  }

  // Generate image with AI for a variant
  const generateVariantImageWithAI = async (variantId: string, variantName: string) => {
    if (!formData.name.trim()) {
      return
    }

    setGeneratingVariantImage(variantId)
    try {
      // Build description: "Product Name - Variant Name" (e.g. "Telefono - Rojo")
      const fullProductName = `${formData.name} - ${variantName}`

      // Obtener el prompt personalizado de la variante
      const variantPrompt = variantImagePrompts[variantId] || ''
      const baseDescription = `${formData.description || ''} Variante: ${variantName}`
      const fullDescription = variantPrompt.trim()
        ? `${baseDescription}. Estilo de imagen: ${variantPrompt}`.trim()
        : baseDescription

      const res = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          productName: fullProductName,
          productDescription: fullDescription,
          saveToStorage: false // Don't save to storage until product is created
        })
      })

      const data = await res.json()
      if (data.success && data.data?.generated) {
        // Use imageUrl if saved, or imageBase64 for preview
        const imageToUse = data.data.imageUrl || data.data.imageBase64
        if (imageToUse) {
          updateVariant(variantId, 'imageUrl', imageToUse)
        }
      } else {
        console.error('Error generating variant image:', data.error)
      }
    } catch (error) {
      console.error('Error generating variant image:', error)
    }
    setGeneratingVariantImage(null)
  }

  // Clean variant image with AI (remove background and standardize)
  const cleanVariantImageWithAI = async (variantId: string) => {
    const variant = variants.find(v => v.id === variantId)
    if (!variant?.imageUrl) {
      return
    }

    setCleaningVariantImage(variantId)

    try {
      // Convertir imagen a base64
      let imageBase64 = ''

      if (variant.imageUrl.startsWith('data:')) {
        imageBase64 = variant.imageUrl
      } else if (variant.imageUrl.startsWith('blob:')) {
        // Si es blob URL, fetch y convertir
        const response = await fetch(variant.imageUrl)
        const blob = await response.blob()
        const reader = new FileReader()
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } else {
        // Si es URL normal, fetch y convertir
        const response = await fetch(variant.imageUrl)
        const blob = await response.blob()
        const reader = new FileReader()
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      }

      if (!imageBase64) {
        console.error('No se pudo procesar la imagen de la variante')
        setCleaningVariantImage(null)
        return
      }

      // Usar el barcode de la variante o generar uno temporal
      const barcodeToUse = variant.barcode || `VAR-${variant.id}`

      const res = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clean',
          imageBase64: imageBase64,
          barcode: barcodeToUse,
          saveToStorage: true
        })
      })

      const data = await res.json()

      if (data.success) {
        const cleanedImage = data.data?.imageUrl ||
          (data.data?.imageBase64 ? `data:image/jpeg;base64,${data.data.imageBase64}` : null)

        if (cleanedImage) {
          updateVariant(variantId, 'imageUrl', cleanedImage)
        }
      } else {
        console.error('Error cleaning variant image:', data.error)
      }
    } catch (error) {
      console.error('Error cleaning variant image:', error)
    }

    setCleaningVariantImage(null)
  }

  // Clean image with AI (remove background)
  const cleanImageWithAI = async () => {
    if (!formData.imageUrl && !formData.imageFile) {
      setErrors({ ...errors, image: 'Primero sube una imagen para limpiar' })
      return
    }

    setCleaningImage(true)
    setErrors({ ...errors, image: '' })

    try {
      // Convertir imagen a base64
      let imageBase64 = ''

      if (formData.imageFile) {
        // Si hay archivo, convertirlo
        const reader = new FileReader()
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(formData.imageFile!)
        })
      } else if (formData.imageUrl) {
        // Si es URL, intentar descargar y convertir
        if (formData.imageUrl.startsWith('data:')) {
          imageBase64 = formData.imageUrl
        } else {
          // Fetch la imagen y convertir a base64
          const response = await fetch(formData.imageUrl)
          const blob = await response.blob()
          const reader = new FileReader()
          imageBase64 = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        }
      }

      if (!imageBase64) {
        setErrors({ ...errors, image: 'No se pudo procesar la imagen' })
        setCleaningImage(false)
        return
      }

      // Ensure we have a barcode before cleaning
      const barcodeToUse = ensureBarcode()

      const res = await fetch('/api/ai/process-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clean',
          imageBase64: imageBase64,
          barcode: barcodeToUse,
          saveToStorage: true
        })
      })

      const data = await res.json()

      if (data.success) {
        // Usar la URL guardada o el base64 devuelto
        const cleanedImage = data.data?.imageUrl ||
          (data.data?.imageBase64 ? `data:image/jpeg;base64,${data.data.imageBase64}` : null)

        if (cleanedImage) {
          setFormData(prev => ({
            ...prev,
            imageUrl: cleanedImage,
            imageFile: null // Limpiar el archivo ya que ahora tenemos URL
          }))
        } else {
          setErrors({ ...errors, image: 'La imagen no pudo ser limpiada' })
        }
      } else {
        setErrors({ ...errors, image: data.error || 'Error al limpiar imagen' })
      }
    } catch (error) {
      console.error('Error cleaning image:', error)
      setErrors({ ...errors, image: 'Error al limpiar imagen con IA' })
    }

    setCleaningImage(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, image: 'El archivo es muy grande (máx. 5MB)' })
        return
      }

      // Validar tipo de archivo
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        setErrors({ ...errors, image: 'Tipo de archivo no permitido. Solo se aceptan PNG, JPG, WEBP y GIF' })
        return
      }

      // Crear URL del objeto y actualizar estado
      const objectUrl = URL.createObjectURL(file)
      console.log('[Image Upload] File selected:', { name: file.name, type: file.type, size: file.size, url: objectUrl })

      setFormData(prev => ({
        ...prev,
        imageFile: file,
        imageUrl: objectUrl
      }))
      setErrors({ ...errors, image: '' })

      // Limpiar imágenes existentes si las había
      setExistingImages([])
      setSelectedExistingImage(null)
      setUseExistingImage(false)
    }
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'info') {
      if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    }

    if (step === 'pricing') {
      if (!formData.costPrice) newErrors.costPrice = 'El precio de costo es requerido'
      if (!formData.sellingPrice) newErrors.sellingPrice = 'El precio de venta es requerido'
      if (parseFloat(formData.sellingPrice) < parseFloat(formData.costPrice)) {
        newErrors.sellingPrice = 'El precio de venta debe ser mayor al costo'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    // Auto-generate barcode when leaving info step if empty
    if (currentStep === 'info' && (!formData.barcode || formData.barcode.trim() === '')) {
      ensureBarcode()
    }

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!formData.imageFile) return null

    setUploadingImage(true)
    console.log('[Image Upload] Starting upload to server...')

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.imageFile)
      uploadFormData.append('folder', 'market-products')

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: uploadFormData
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[Image Upload] Server error:', data)
        setErrors(prev => ({ ...prev, image: data.error || 'Error al subir la imagen' }))
        return null
      }

      console.log('[Image Upload] Upload successful:', data.url)
      return data.url || null
    } catch (error: any) {
      console.error('[Image Upload] Error:', error)
      setErrors(prev => ({ ...prev, image: error.message || 'Error al subir la imagen' }))
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return

    setLoading(true)
    try {
      // Determine image URL
      let imageUrl: string | null = null

      // If there's a file to upload, upload it first
      if (formData.imageFile) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        } else {
          console.warn('Image upload failed, continuing without image')
        }
      }
      // If we have a base64 data URL, upload it to storage first
      else if (formData.imageUrl && formData.imageUrl.startsWith('data:')) {
        console.log('[Product Create] Uploading base64 image to storage...')
        try {
          const barcodeToUse = formData.barcode || ensureBarcode()
          const res = await fetch('/api/upload/product-image', {
            method: 'POST',
            body: (() => {
              const fd = new FormData()
              // Convert base64 to blob
              const base64Data = formData.imageUrl.split(',')[1]
              const mimeType = formData.imageUrl.split(';')[0].split(':')[1]
              const byteCharacters = atob(base64Data)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              const blob = new Blob([byteArray], { type: mimeType })
              fd.append('file', blob, `${barcodeToUse}.jpg`)
              fd.append('barcode', barcodeToUse)
              return fd
            })()
          })
          const uploadData = await res.json()
          if (uploadData.success && uploadData.data?.imageUrl) {
            imageUrl = uploadData.data.imageUrl
            console.log('[Product Create] Base64 uploaded:', imageUrl)
          }
        } catch (uploadError) {
          console.error('[Product Create] Failed to upload base64:', uploadError)
        }
      }
      // If we already have an imageUrl (from AI generation, cleaning, or existing),
      // use it (but not if it's a blob URL which is temporary)
      else if (formData.imageUrl && !formData.imageUrl.startsWith('blob:')) {
        imageUrl = formData.imageUrl
      }

      console.log('[Product Create] Using image URL:', imageUrl)

      const response = await fetch('/api/market/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          unitOfMeasure: formData.unitOfMeasure,
          imageUrl: imageUrl,
          costPrice: parseFloat(formData.costPrice),
          sellingPrice: parseFloat(formData.sellingPrice),
          currency: formData.currency,
          sku: formData.sku || undefined,
          barcode: formData.barcode || undefined,
          supplierName: formData.supplierName || undefined,
          supplierContact: formData.supplierContact || undefined,
          supplierReference: formData.supplierReference || undefined,
          minimumStock: parseInt(formData.minimumStock) || 5,
          hasVariants: formData.hasVariants,
          variants: formData.hasVariants ? variants.map(v => ({
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            costPrice: parseFloat(v.costPrice) || 0,
            sellingPrice: parseFloat(v.sellingPrice) || 0,
            options: v.options,
            imageUrl: v.imageUrl || null
          })) : []
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al crear producto')
      }

      router.push('/dashboard/market/inventory')
    } catch (error) {
      console.error('Error creating product:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al crear producto' })
    } finally {
      setLoading(false)
    }
  }

  const getMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0
    const sell = parseFloat(formData.sellingPrice) || 0
    if (cost === 0) return 0
    return Math.round(((sell - cost) / cost) * 100)
  }

  const addVariantType = () => {
    if (!newTypeName.trim()) return
    const newType: VariantType = {
      id: `type-${Date.now()}`,
      name: newTypeName.trim(),
      values: []
    }
    setVariantTypes([...variantTypes, newType])
    setNewTypeName('')
    setEditingTypeId(newType.id)
  }

  const addValueToType = (typeId: string) => {
    if (!newTypeValue.trim()) return
    setVariantTypes(types =>
      types.map(t =>
        t.id === typeId
          ? { ...t, values: [...t.values, newTypeValue.trim()] }
          : t
      )
    )
    setNewTypeValue('')
  }

  const removeValueFromType = (typeId: string, value: string) => {
    setVariantTypes(types =>
      types.map(t =>
        t.id === typeId
          ? { ...t, values: t.values.filter(v => v !== value) }
          : t
      )
    )
  }

  const removeVariantType = (typeId: string) => {
    setVariantTypes(types => types.filter(t => t.id !== typeId))
  }

  const generateVariants = () => {
    if (variantTypes.length === 0) return

    // Generate all combinations
    const generateCombinations = (types: VariantType[]): { type: string; value: string }[][] => {
      if (types.length === 0) return [[]]
      const [first, ...rest] = types
      const restCombinations = generateCombinations(rest)
      const result: { type: string; value: string }[][] = []

      for (const value of first.values) {
        for (const combo of restCombinations) {
          result.push([{ type: first.name, value }, ...combo])
        }
      }

      return result
    }

    const combinations = generateCombinations(variantTypes)
    const newVariants: Variant[] = combinations.map((combo, index) => ({
      id: `var-${Date.now()}-${index}`,
      name: combo.map(c => c.value).join(' - '),
      sku: '',
      barcode: '',
      costPrice: formData.costPrice,
      sellingPrice: formData.sellingPrice,
      options: combo,
      imageUrl: ''
    }))

    setVariants(newVariants)
    setFormData(prev => ({ ...prev, hasVariants: true }))
  }

  const updateVariant = (variantId: string, field: keyof Variant, value: string) => {
    setVariants(vars =>
      vars.map(v =>
        v.id === variantId ? { ...v, [field]: value } : v
      )
    )
  }

  const removeVariant = (variantId: string) => {
    setVariants(vars => vars.filter(v => v.id !== variantId))
    if (variants.length <= 1) {
      setFormData(prev => ({ ...prev, hasVariants: false }))
    }
  }

  const symbol = CURRENCY_SYMBOLS[formData.currency] || '$'
  const selectedUnit = UNITS_OF_MEASURE.find(u => u.id === formData.unitOfMeasure)

  return (
    <div className={cn(
      "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
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
                {/* Step 1: Information */}
                {currentStep === 'info' && (
                  <motion.div
                    key="info"
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
                      Información del Producto
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre del Producto *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => {
                              setFormData({ ...formData, name: e.target.value })
                              setShowAiSuggestion(false)
                            }}
                            placeholder="Ej: Arroz Premium 5kg"
                            className={cn(
                              'flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              errors.name
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                          <motion.button
                            type="button"
                            onClick={fetchAiSuggestion}
                            disabled={aiLoading || !formData.name.trim() || formData.name.trim().length < 2}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              theme === 'dark'
                                ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25'
                                : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-400/25'
                            )}
                          >
                            {aiLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="hidden sm:inline">Pensando...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">IA</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}

                        {/* AI Suggestion Panel */}
                        <AnimatePresence>
                          {showAiSuggestion && aiSuggestion && (
                            <motion.div
                              initial={{ opacity: 0, y: -10, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: 'auto' }}
                              exit={{ opacity: 0, y: -10, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className={cn(
                                "mt-4 p-4 rounded-xl border-2 border-dashed relative overflow-hidden",
                                theme === 'dark'
                                  ? 'bg-gradient-to-br from-violet-900/20 to-purple-900/20 border-violet-500/50'
                                  : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-300'
                              )}
                            >
                              {/* Sparkle decoration */}
                              <div className="absolute top-2 right-2">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                >
                                  <Wand2 className={cn(
                                    "w-5 h-5",
                                    theme === 'dark' ? 'text-violet-400' : 'text-violet-500'
                                  )} />
                                </motion.div>
                              </div>

                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className={cn(
                                  "w-4 h-4",
                                  theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                                )} />
                                <span className={cn(
                                  "text-sm font-semibold",
                                  theme === 'dark' ? 'text-violet-300' : 'text-violet-700'
                                )}>
                                  Sugerencias de IA
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowAiSuggestion(false)}
                                  className={cn(
                                    "ml-auto p-1 rounded-full transition-colors",
                                    theme === 'dark'
                                      ? 'hover:bg-gray-700 text-gray-400'
                                      : 'hover:bg-gray-200 text-gray-500'
                                  )}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="space-y-3">
                                {/* Category suggestion */}
                                <div className={cn(
                                  "flex items-center justify-between p-3 rounded-lg",
                                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                                )}>
                                  <div className="flex items-center gap-2">
                                    <Package className={cn(
                                      "w-4 h-4",
                                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                    )} />
                                    <span className={cn(
                                      "text-sm",
                                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                    )}>
                                      Categoría: <strong>{aiSuggestion.category}</strong>
                                    </span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    onClick={applyAiCategory}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                      "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                                      formData.category === aiSuggestion.category
                                        ? theme === 'dark'
                                          ? 'bg-green-900/50 text-green-300'
                                          : 'bg-green-100 text-green-700'
                                        : theme === 'dark'
                                          ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                          : 'bg-violet-500 hover:bg-violet-600 text-white'
                                    )}
                                  >
                                    {formData.category === aiSuggestion.category ? (
                                      <span className="flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Aplicado
                                      </span>
                                    ) : (
                                      'Aplicar'
                                    )}
                                  </motion.button>
                                </div>

                                {/* Description suggestion */}
                                <div className={cn(
                                  "flex items-start justify-between p-3 rounded-lg gap-3",
                                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                                )}>
                                  <div className="flex items-start gap-2 flex-1">
                                    <Edit3 className={cn(
                                      "w-4 h-4 mt-0.5 flex-shrink-0",
                                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                                    )} />
                                    <span className={cn(
                                      "text-sm",
                                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                    )}>
                                      {aiSuggestion.description}
                                    </span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    onClick={applyAiDescription}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={cn(
                                      "px-3 py-1 text-xs font-medium rounded-full transition-colors flex-shrink-0",
                                      formData.description === aiSuggestion.description
                                        ? theme === 'dark'
                                          ? 'bg-green-900/50 text-green-300'
                                          : 'bg-green-100 text-green-700'
                                        : theme === 'dark'
                                          ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                          : 'bg-violet-500 hover:bg-violet-600 text-white'
                                    )}
                                  >
                                    {formData.description === aiSuggestion.description ? (
                                      <span className="flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Aplicado
                                      </span>
                                    ) : (
                                      'Aplicar'
                                    )}
                                  </motion.button>
                                </div>

                                {/* Image suggestion */}
                                {aiSuggestion.imageUrl && (
                                  <div className={cn(
                                    "flex items-center justify-between p-3 rounded-lg gap-3",
                                    theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                                  )}>
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                                        <img
                                          src={aiSuggestion.imageUrl}
                                          alt="Imagen sugerida"
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none'
                                          }}
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1">
                                          <ImageIcon className={cn(
                                            "w-4 h-4 flex-shrink-0",
                                            theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                          )} />
                                          <span className={cn(
                                            "text-sm font-medium",
                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                          )}>
                                            Imagen encontrada
                                          </span>
                                        </div>
                                        <p className={cn(
                                          "text-xs truncate mt-0.5",
                                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                        )}>
                                          {aiSuggestion.imageUrl.substring(0, 50)}...
                                        </p>
                                      </div>
                                    </div>
                                    <motion.button
                                      type="button"
                                      onClick={applyAiImage}
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-full transition-colors flex-shrink-0",
                                        formData.imageUrl === aiSuggestion.imageUrl
                                          ? theme === 'dark'
                                            ? 'bg-green-900/50 text-green-300'
                                            : 'bg-green-100 text-green-700'
                                          : theme === 'dark'
                                            ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                            : 'bg-violet-500 hover:bg-violet-600 text-white'
                                      )}
                                    >
                                      {formData.imageUrl === aiSuggestion.imageUrl ? (
                                        <span className="flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Aplicado
                                        </span>
                                      ) : (
                                        'Aplicar'
                                      )}
                                    </motion.button>
                                  </div>
                                )}
                              </div>

                              {/* Apply All Button */}
                              <motion.button
                                type="button"
                                onClick={applyAllAiSuggestions}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  "w-full mt-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                                  theme === 'dark'
                                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white'
                                    : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white'
                                )}
                              >
                                <Sparkles className="w-4 h-4" />
                                Aplicar Todo
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className={cn(
                            "block text-sm font-medium",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Descripción
                          </label>
                          <motion.button
                            type="button"
                            onClick={generateDescriptionWithAI}
                            disabled={generatingDescription || !formData.name.trim() || formData.name.trim().length < 2}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              theme === 'dark'
                                ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25'
                                : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-400/25'
                            )}
                          >
                            {generatingDescription ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                Generar con IA
                              </>
                            )}
                          </motion.button>
                        </div>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Describe el producto o usa el botón de IA para generar automáticamente..."
                          rows={3}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                        {!formData.name.trim() && (
                          <p className={cn(
                            "text-xs mt-1",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            Ingresa el nombre del producto para usar la generación con IA
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Categoría
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        >
                          <option value="">Seleccionar categoría</option>
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Scale className="w-4 h-4" />
                          Unidad de Medida
                        </label>
                        <select
                          value={formData.unitOfMeasure}
                          onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        >
                          {UNITS_OF_MEASURE.map(unit => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name} ({unit.abbr})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Tag className="w-4 h-4" />
                          SKU (Referencia Interna)
                        </label>
                        <input
                          type="text"
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                          placeholder="Se generará automáticamente"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Barcode className="w-4 h-4" />
                          Código de Barras
                        </label>
                        <input
                          type="text"
                          value={formData.barcode}
                          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                          placeholder="Se generará automáticamente"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Stock Mínimo de Alerta
                        </label>
                        <input
                          type="number"
                          value={formData.minimumStock}
                          onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                          placeholder="5"
                          min="0"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Truck className="w-4 h-4" />
                          Proveedor
                        </label>
                        <input
                          type="text"
                          value={formData.supplierName}
                          onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                          placeholder="Nombre del proveedor (opcional)"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Image */}
                {currentStep === 'image' && (
                  <motion.div
                    key="image"
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
                        <ImageIcon className="w-5 h-5 text-white" />
                      </div>
                      Imagen del Producto
                    </h2>

                    {/* Existing Images Found Section - Galería de imágenes */}
                    {existingImages.length > 0 && !formData.imageUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "rounded-xl p-4 border-2",
                          theme === 'dark'
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-green-50 border-green-200'
                        )}
                      >
                        <h4 className={cn(
                          "font-semibold flex items-center gap-2 mb-3",
                          theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        )}>
                          <Check className="w-4 h-4" />
                          {existingImages.length === 1
                            ? 'Imagen encontrada'
                            : `${existingImages.length} imágenes encontradas`}
                        </h4>

                        {/* Galería de imágenes */}
                        <div className="flex flex-wrap gap-3 mb-4">
                          {existingImages.map((img) => (
                            <motion.div
                              key={img.imageIndex}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedExistingImage(img)}
                              className={cn(
                                "relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all",
                                selectedExistingImage?.imageIndex === img.imageIndex
                                  ? 'border-green-500 ring-2 ring-green-500/50'
                                  : theme === 'dark'
                                    ? 'border-gray-600 hover:border-gray-500'
                                    : 'border-gray-300 hover:border-gray-400'
                              )}
                            >
                              <img
                                src={img.url}
                                alt={`Imagen ${img.imageIndex}`}
                                className="w-full h-full object-cover"
                              />
                              {img.isPrimary && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] px-1 rounded-bl">
                                  Principal
                                </div>
                              )}
                              {selectedExistingImage?.imageIndex === img.imageIndex && (
                                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                  <Check className="w-6 h-6 text-green-500" />
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>

                        <p className={cn(
                          "text-sm mb-3",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          {existingImages.length === 1
                            ? 'Este código de barras ya tiene una imagen registrada.'
                            : 'Selecciona una imagen de la galería para usar en este producto.'}
                        </p>

                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={useFoundImage}
                            disabled={!selectedExistingImage}
                            className={cn(
                              "px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium transition-colors",
                              selectedExistingImage
                                ? 'hover:bg-green-600'
                                : 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            Usar imagen seleccionada
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setExistingImages([])
                              setSelectedExistingImage(null)
                            }}
                            className={cn(
                              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                              theme === 'dark'
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            )}
                          >
                            Agregar nueva imagen
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {/* Checking barcode indicator */}
                    {checkingImage && (
                      <div className="flex items-center justify-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Buscando imagen por codigo de barras...
                        </span>
                      </div>
                    )}

                    {/* Upload Area */}
                    {(existingImages.length === 0 || formData.imageUrl) && (
                      <motion.div
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                          theme === 'dark'
                            ? 'border-gray-600 hover:border-purple-500/50 hover:bg-purple-500/5'
                            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {formData.imageUrl ? (
                          <div className="space-y-4">
                            <div className="relative inline-block">
                              <img
                                src={formData.imageUrl}
                                alt="Preview"
                                className="max-w-xs max-h-48 rounded-xl mx-auto object-contain shadow-lg"
                                onError={(e) => {
                                  console.error('[Image Preview] Error loading image:', formData.imageUrl)
                                  setErrors(prev => ({ ...prev, image: 'Error al cargar la vista previa de la imagen' }))
                                }}
                                onLoad={() => {
                                  console.log('[Image Preview] Image loaded successfully')
                                  setErrors(prev => ({ ...prev, image: '' }))
                                }}
                              />
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Revocar blob URL si existe para liberar memoria
                                  if (formData.imageUrl.startsWith('blob:')) {
                                    URL.revokeObjectURL(formData.imageUrl)
                                  }
                                  setFormData({ ...formData, imageUrl: '', imageFile: null })
                                  setUseExistingImage(false)
                                }}
                                className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                              >
                                <X className="w-4 h-4" />
                              </motion.button>
                            </div>

                            {/* Clean Image Button */}
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                cleanImageWithAI()
                              }}
                              disabled={cleaningImage}
                              className={cn(
                                "w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all text-sm",
                                cleaningImage
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-md shadow-blue-500/20'
                              )}
                            >
                              {cleaningImage ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Limpiando fondo...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  Limpiar imagen (fondo blanco)
                                </>
                              )}
                            </motion.button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className={cn(
                              "w-16 h-16 mx-auto rounded-xl flex items-center justify-center",
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <Upload className="w-8 h-8 text-gray-400" />
                            </div>
                            <div>
                              <p className={cn(
                                "font-medium",
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                Arrastra o haz clic para subir
                              </p>
                              <p className={cn(
                                "text-sm mt-1",
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                              )}>
                                PNG, JPG o WEBP hasta 5MB
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* AI Options */}
                    {!formData.imageUrl && existingImages.length === 0 && (
                      <div className="space-y-3">
                        <div className={cn(
                          "flex items-center gap-2 text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600" />
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-4 h-4" />
                            Generar con IA
                          </span>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600" />
                        </div>

                        {/* Campo de descripción para la IA */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Describe la imagen que deseas
                          </label>
                          <textarea
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="Ej: Producto sobre fondo blanco, estilo profesional, vista frontal, iluminación de estudio..."
                            rows={2}
                            className={cn(
                              "w-full px-4 py-3 rounded-xl border text-sm resize-none transition-all",
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-purple-500'
                            )}
                          />
                          <p className={cn(
                            "text-xs mt-1",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            Opcional: describe el estilo, fondo, ángulo o cualquier detalle específico
                          </p>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={generateImageWithAI}
                          disabled={generatingImage || !formData.name.trim()}
                          className={cn(
                            "w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all",
                            generatingImage || !formData.name.trim()
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                              : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/20'
                          )}
                        >
                          {generatingImage ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Generando con Gemini AI...
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-5 h-5" />
                              Generar imagen con IA
                            </>
                          )}
                        </motion.button>

                        {!formData.name.trim() && (
                          <p className={cn(
                            "text-xs text-center",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            Ingresa el nombre del producto en el paso anterior para usar esta opción
                          </p>
                        )}
                      </div>
                    )}

                    {errors.image && <p className="text-red-500 text-sm text-center">{errors.image}</p>}

                    <p className={cn(
                      "text-sm text-center",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      Este paso es opcional. Puedes agregar la imagen despues.
                    </p>
                  </motion.div>
                )}

                {/* Step 3: Pricing */}
                {currentStep === 'pricing' && (
                  <motion.div
                    key="pricing"
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
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      Precios y Costos
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Moneda
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        >
                          <option value="USD">USD - Dólar</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="CUP">CUP - Peso Cubano</option>
                          <option value="MLC">MLC</option>
                        </select>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Precio de Costo *
                        </label>
                        <div className="relative">
                          <span className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>{symbol}</span>
                          <input
                            type="number"
                            value={formData.costPrice}
                            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                            placeholder="0.0000"
                            step="0.0001"
                            min="0"
                            className={cn(
                              'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              errors.costPrice
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                        {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Precio de Venta *
                        </label>
                        <div className="relative">
                          <span className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>{symbol}</span>
                          <input
                            type="number"
                            value={formData.sellingPrice}
                            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                            placeholder="0.0000"
                            step="0.0001"
                            min="0"
                            className={cn(
                              'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              errors.sellingPrice
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                        {errors.sellingPrice && <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>}
                      </div>
                    </div>

                    {/* Margin Preview */}
                    {formData.costPrice && formData.sellingPrice && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-6 rounded-2xl border',
                          getMargin() >= 30
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : getMargin() >= 15
                              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        )}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>Margen de Ganancia</span>
                            <p className={cn(
                              "text-xs mt-1",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              Ganancia: {symbol}{(parseFloat(formData.sellingPrice) - parseFloat(formData.costPrice)).toFixed(4)} por {selectedUnit?.abbr}
                            </p>
                          </div>
                          <span className={cn(
                            'text-4xl font-bold',
                            getMargin() >= 30 ? 'text-green-600' : getMargin() >= 15 ? 'text-amber-600' : 'text-red-600'
                          )}>
                            {getMargin()}%
                          </span>
                        </div>

                        {/* Selling price in multiple currencies */}
                        <div className={cn(
                          "mt-4 pt-4 border-t",
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <span className={cn(
                            "text-xs font-medium",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>Precio de Venta:</span>
                          <div className="flex flex-wrap gap-3 mt-2">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-sm font-medium",
                              theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                            )}>
                              ${parseFloat(formData.sellingPrice).toFixed(4)} USD
                            </span>
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-sm font-medium",
                              theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                            )}>
                              ${Math.round(parseFloat(formData.sellingPrice) * (USD_CUP_BCC || 411)).toLocaleString()} CUP
                            </span>
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-sm font-medium",
                              theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                            )}>
                              ${(parseFloat(formData.sellingPrice) * (USD_MLC || 1.5)).toFixed(2)} MLC
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className={cn(
                          "mt-4 h-2 rounded-full overflow-hidden",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(getMargin(), 100)}%` }}
                            transition={{ duration: 0.5 }}
                            className={cn(
                              "h-full rounded-full",
                              getMargin() >= 30 ? 'bg-green-500' : getMargin() >= 15 ? 'bg-amber-500' : 'bg-red-500'
                            )}
                          />
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Variants */}
                {currentStep === 'variants' && (
                  <motion.div
                    key="variants"
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
                        <Layers className="w-5 h-5 text-white" />
                      </div>
                      Variantes del Producto
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Las variantes te permiten vender un mismo producto con diferentes opciones (colores, tallas, materiales, etc.).
                      Este paso es opcional.
                    </p>

                    {/* Add variant type */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Crear tipo de variante
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newTypeName}
                          onChange={(e) => setNewTypeName(e.target.value)}
                          placeholder="Ej: Color, Talla, Material..."
                          className={cn(
                            'flex-1 px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white focus:border-amber-500 focus:ring-amber-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20'
                          )}
                          onKeyDown={(e) => e.key === 'Enter' && addVariantType()}
                        />
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={addVariantType}
                          disabled={!newTypeName.trim()}
                          className={cn(
                            "px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            theme === 'dark'
                              ? 'bg-amber-600 hover:bg-amber-700 text-white'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          )}
                        >
                          <Plus className="w-4 h-4" />
                          Agregar
                        </motion.button>
                      </div>
                    </div>

                    {/* Variant types list */}
                    {variantTypes.length > 0 && (
                      <div className="space-y-4">
                        {variantTypes.map((type) => (
                          <motion.div
                            key={type.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "p-4 rounded-xl border",
                              theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-white border-gray-200'
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className={cn(
                                "font-semibold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {type.name}
                              </span>
                              <button
                                onClick={() => removeVariantType(type.id)}
                                className="text-red-500 hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Values */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {type.values.map((value) => (
                                <motion.span
                                  key={value}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className={cn(
                                    "px-3 py-1 rounded-full text-sm flex items-center gap-1",
                                    theme === 'dark'
                                      ? 'bg-amber-900/30 text-amber-300 border border-amber-700'
                                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                                  )}
                                >
                                  {value}
                                  <button
                                    onClick={() => removeValueFromType(type.id, value)}
                                    className="hover:text-red-500 ml-1"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </motion.span>
                              ))}
                            </div>

                            {/* Add value */}
                            {editingTypeId === type.id && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newTypeValue}
                                  onChange={(e) => setNewTypeValue(e.target.value)}
                                  placeholder={`Agregar ${type.name.toLowerCase()}...`}
                                  className={cn(
                                    'flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all',
                                    theme === 'dark'
                                      ? 'bg-gray-800 border-gray-600 text-white focus:border-amber-500 focus:ring-amber-500/20'
                                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20'
                                  )}
                                  onKeyDown={(e) => e.key === 'Enter' && addValueToType(type.id)}
                                  autoFocus
                                />
                                <button
                                  onClick={() => addValueToType(type.id)}
                                  disabled={!newTypeValue.trim()}
                                  className={cn(
                                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                    "disabled:opacity-50",
                                    theme === 'dark'
                                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                  )}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {editingTypeId !== type.id && (
                              <button
                                onClick={() => setEditingTypeId(type.id)}
                                className={cn(
                                  "text-sm flex items-center gap-1 transition-colors",
                                  theme === 'dark'
                                    ? 'text-gray-400 hover:text-amber-400'
                                    : 'text-gray-500 hover:text-amber-600'
                                )}
                              >
                                <Plus className="w-3 h-3" />
                                Agregar valor
                              </button>
                            )}
                          </motion.div>
                        ))}

                        {/* Generate variants button */}
                        {variantTypes.some(t => t.values.length > 0) && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={generateVariants}
                            className={cn(
                              "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                              theme === 'dark'
                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-400/25'
                            )}
                          >
                            <Layers className="w-5 h-5" />
                            Generar Variantes
                          </motion.button>
                        )}
                      </div>
                    )}

                    {/* Generated variants */}
                    {variants.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Variantes Generadas ({variants.length})
                          </h3>
                          <button
                            onClick={() => {
                              setVariants([])
                              setFormData(prev => ({ ...prev, hasVariants: false }))
                            }}
                            className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar todas
                          </button>
                        </div>

                        <div className="grid gap-3">
                          {variants.map((variant, index) => (
                            <motion.div
                              key={variant.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={cn(
                                "p-4 rounded-xl border",
                                theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-white border-gray-200'
                              )}
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex-1 space-y-3">
                                  {/* Row 1: Name and Options */}
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className={cn(
                                        "font-medium",
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      )}>
                                        {variant.name}
                                      </p>
                                      <div className="flex gap-1 mt-1">
                                        {variant.options.map((opt, i) => (
                                          <span
                                            key={i}
                                            className={cn(
                                              "text-xs px-2 py-0.5 rounded-full",
                                              theme === 'dark'
                                                ? 'bg-gray-700 text-gray-300'
                                                : 'bg-gray-100 text-gray-600'
                                            )}
                                          >
                                            {opt.value}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => removeVariant(variant.id)}
                                      className="text-red-500 hover:text-red-600 p-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Row 2: Prices, SKU, Barcode */}
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Costo</label>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">{symbol}</span>
                                        <input
                                          type="number"
                                          value={variant.costPrice}
                                          onChange={(e) => updateVariant(variant.id, 'costPrice', e.target.value)}
                                          className={cn(
                                            'w-full pl-6 pr-2 py-1.5 rounded-lg border text-sm focus:outline-none',
                                            theme === 'dark'
                                              ? 'bg-gray-800 border-gray-600 text-white'
                                              : 'bg-gray-50 border-gray-200 text-gray-900'
                                          )}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Venta</label>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">{symbol}</span>
                                        <input
                                          type="number"
                                          value={variant.sellingPrice}
                                          onChange={(e) => updateVariant(variant.id, 'sellingPrice', e.target.value)}
                                          className={cn(
                                            'w-full pl-6 pr-2 py-1.5 rounded-lg border text-sm focus:outline-none',
                                            theme === 'dark'
                                              ? 'bg-gray-800 border-gray-600 text-white'
                                              : 'bg-gray-50 border-gray-200 text-gray-900'
                                          )}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">SKU</label>
                                      <input
                                        type="text"
                                        value={variant.sku}
                                        onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                                        placeholder="Auto"
                                        className={cn(
                                          'w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none',
                                          theme === 'dark'
                                            ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                                        )}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">Codigo de Barras</label>
                                      <input
                                        type="text"
                                        value={variant.barcode}
                                        onChange={(e) => updateVariant(variant.id, 'barcode', e.target.value)}
                                        placeholder="Auto"
                                        className={cn(
                                          'w-full px-2 py-1.5 rounded-lg border text-sm focus:outline-none',
                                          theme === 'dark'
                                            ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                                        )}
                                      />
                                    </div>
                                  </div>

                                  {/* Row 3: Image selector */}
                                  <div className={cn(
                                    "p-3 rounded-lg border",
                                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                                  )}>
                                    <label className="block text-xs text-gray-500 mb-2">Imagen de la variante</label>
                                    <div className="flex items-center gap-3 mb-2">
                                      {/* Image preview */}
                                      <div className={cn(
                                        "w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center",
                                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                      )}>
                                        {(variant.imageUrl || formData.imageUrl) ? (
                                          <img
                                            src={variant.imageUrl || formData.imageUrl}
                                            alt={variant.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <ImageIcon className="w-5 h-5 text-gray-400" />
                                        )}
                                      </div>

                                      {/* Image options */}
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateVariant(variant.id, 'imageUrl', '')}
                                          className={cn(
                                            "text-xs px-2 py-1 rounded-md transition-all",
                                            !variant.imageUrl
                                              ? theme === 'dark'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-purple-500 text-white'
                                              : theme === 'dark'
                                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                          )}
                                        >
                                          Usar del producto
                                        </button>
                                        <label className={cn(
                                          "text-xs px-2 py-1 rounded-md cursor-pointer transition-all flex items-center gap-1",
                                          theme === 'dark'
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        )}>
                                          <Upload className="w-3 h-3" />
                                          Subir
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0]
                                              if (file) {
                                                // Create preview URL
                                                const previewUrl = URL.createObjectURL(file)
                                                updateVariant(variant.id, 'imageUrl', previewUrl)
                                              }
                                            }}
                                          />
                                        </label>
                                        {/* Clean variant image button */}
                                        {variant.imageUrl && (
                                          <button
                                            type="button"
                                            onClick={() => cleanVariantImageWithAI(variant.id)}
                                            disabled={cleaningVariantImage === variant.id}
                                            className={cn(
                                              "text-xs px-2 py-1 rounded-md transition-all flex items-center gap-1",
                                              cleaningVariantImage === variant.id
                                                ? 'bg-blue-400 text-white cursor-wait'
                                                : theme === 'dark'
                                                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
                                                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                                            )}
                                          >
                                            {cleaningVariantImage === variant.id ? (
                                              <>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Limpiando...
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="w-3 h-3" />
                                                Limpiar
                                              </>
                                            )}
                                          </button>
                                        )}
                                        {variant.imageUrl && (
                                          <button
                                            type="button"
                                            onClick={() => updateVariant(variant.id, 'imageUrl', '')}
                                            className={cn(
                                              "text-xs px-2 py-1 rounded-md transition-all",
                                              theme === 'dark'
                                                ? 'bg-red-900/50 text-red-300 hover:bg-red-900'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            )}
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Generación con IA para variante */}
                                    <div className={cn(
                                      "mt-2 pt-2 border-t",
                                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                                    )}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="w-3 h-3 text-purple-500" />
                                        <span className={cn(
                                          "text-xs font-medium",
                                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                        )}>
                                          Generar con IA
                                        </span>
                                      </div>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={variantImagePrompts[variant.id] || ''}
                                          onChange={(e) => setVariantImagePrompts(prev => ({
                                            ...prev,
                                            [variant.id]: e.target.value
                                          }))}
                                          placeholder="Describe la imagen (ej: fondo blanco, vista frontal...)"
                                          className={cn(
                                            'flex-1 px-2 py-1.5 rounded-lg border text-xs focus:outline-none',
                                            theme === 'dark'
                                              ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500'
                                              : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                                          )}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => generateVariantImageWithAI(variant.id, variant.name)}
                                          disabled={generatingVariantImage === variant.id || !formData.name.trim()}
                                          className={cn(
                                            "text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap",
                                            generatingVariantImage === variant.id
                                              ? 'bg-purple-400 text-white cursor-wait'
                                              : theme === 'dark'
                                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                                                : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
                                          )}
                                        >
                                          {generatingVariantImage === variant.id ? (
                                            <>
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              Generando...
                                            </>
                                          ) : (
                                            <>
                                              <Wand2 className="w-3 h-3" />
                                              Generar
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {variantTypes.length === 0 && variants.length === 0 && (
                      <div className={cn(
                        "text-center py-12 rounded-xl border-2 border-dashed",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Layers className={cn(
                          "w-12 h-12 mx-auto mb-3",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          No hay variantes configuradas
                        </p>
                        <p className={cn(
                          "text-sm mt-1",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          Puedes continuar sin variantes o agregar tipos arriba
                        </p>
                      </div>
                    )}
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
                      Revisión del Producto
                    </h2>

                    <div className={cn(
                      'rounded-2xl p-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="flex gap-6">
                        {/* Image */}
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          className={cn(
                            'w-32 h-32 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-lg',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}
                        >
                          {formData.imageUrl ? (
                            <img
                              src={formData.imageUrl}
                              alt={formData.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-10 h-10 text-gray-400" />
                          )}
                        </motion.div>

                        {/* Details */}
                        <div className="flex-1 space-y-4">
                          <div>
                            <h3 className={cn(
                              "text-xl font-bold",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formData.name || 'Sin nombre'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              {formData.category && (
                                <span className={cn(
                                  "text-sm px-2 py-0.5 rounded-full",
                                  theme === 'dark'
                                    ? 'bg-blue-900/50 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                )}>
                                  {formData.category}
                                </span>
                              )}
                              <span className={cn(
                                "text-sm px-2 py-0.5 rounded-full",
                                theme === 'dark'
                                  ? 'bg-gray-700 text-gray-300'
                                  : 'bg-gray-200 text-gray-600'
                              )}>
                                {selectedUnit?.name}
                              </span>
                            </div>
                            {formData.description && (
                              <p className={cn(
                                "text-sm mt-2",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                {formData.description}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500">Precio de Costo</p>
                              <p className={cn(
                                "font-bold text-lg",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {symbol}{parseFloat(formData.costPrice || '0').toFixed(2)}
                              </p>
                            </div>
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500">Precio de Venta</p>
                              <p className="font-bold text-lg text-green-600">
                                {symbol}{parseFloat(formData.sellingPrice || '0').toFixed(2)}
                              </p>
                            </div>
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500">Margen</p>
                              <p className={cn(
                                'font-bold text-lg',
                                getMargin() >= 30 ? 'text-green-600' : getMargin() >= 15 ? 'text-amber-600' : 'text-red-600'
                              )}>
                                {getMargin()}%
                              </p>
                            </div>
                          </div>

                          {formData.supplierName && (
                            <div className={cn(
                              "p-3 rounded-xl flex items-center gap-3",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <Truck className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="text-xs text-gray-500">Proveedor</p>
                                <p className={cn(
                                  "text-sm font-medium",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formData.supplierName}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Variants summary */}
                      {variants.length > 0 && (
                        <div className={cn(
                          "mt-6 pt-6 border-t",
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <h4 className={cn(
                            "font-semibold mb-3 flex items-center gap-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            <Layers className="w-4 h-4 text-amber-500" />
                            Variantes ({variants.length})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {variants.map((v) => (
                              <span
                                key={v.id}
                                className={cn(
                                  "text-sm px-3 py-1 rounded-full",
                                  theme === 'dark'
                                    ? 'bg-amber-900/30 text-amber-300'
                                    : 'bg-amber-100 text-amber-700'
                                )}
                              >
                                {v.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
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
                  onClick={handleSubmit}
                  disabled={loading || uploadingImage}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  {(loading || uploadingImage) && <Loader2 className="w-5 h-5 animate-spin" />}
                  <Check className="w-5 h-5" />
                  Crear Producto
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
                            ¿Cancelar creación?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perderá toda la información ingresada y no podrás recuperarla.
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
                        onClick={() => router.push('/dashboard/market/inventory')}
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
        </div>
  )
}
