import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

// Z.ai API Configuration (docs: https://docs.z.ai/api-reference/introduction)
const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/chat/completions'
const ZAI_API_KEY = '98c8e5eeb08d4f42963bcb4d963bbfd6.NbBtw1KWVhSdb5HC'
const ZAI_MODEL = 'glm-4.6' // GLM-4.6 flagship model

// Supabase Configuration for image storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET_NAME = 'company-documents'

// Available categories (must match the ones in the create form)
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

interface ZAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface ProductSuggestion {
  category: string
  description: string
  imageUrl?: string
}

// Fallback categorization based on keywords with word boundary matching
function fallbackCategorization(productName: string): ProductSuggestion {
  const name = productName.toLowerCase()
  // Split into words for better matching
  const words = name.split(/[\s\-_,\.]+/)

  // Category mappings with keywords (ordered by priority - more specific first)
  const categoryKeywords: Record<string, string[]> = {
    'Electrodomésticos': ['nevera', 'refrigerador', 'lavadora', 'microondas', 'licuadora', 'batidora', 'televisor', 'television', 'televisión', 'tv', 'aire', 'acondicionado', 'ventilador', 'plancha', 'tostadora', 'cafetera', 'freidora', 'samsung', 'lg', 'sony', 'panasonic'],
    'Electrónica': ['celular', 'teléfono', 'telefono', 'móvil', 'movil', 'tablet', 'laptop', 'computadora', 'computador', 'auricular', 'audífono', 'cargador', 'cable', 'usb', 'mouse', 'teclado', 'memoria', 'pendrive', 'iphone', 'android', 'xiaomi', 'huawei'],
    'Limpieza': ['detergente', 'jabón', 'jabon', 'cloro', 'desinfectante', 'fabuloso', 'escoba', 'trapeador', 'limpiador', 'suavizante', 'lejía', 'lejia', 'roma', 'ace', 'ariel', 'tide'],
    'Carnes y Embutidos': ['carne', 'pollo', 'cerdo', 'res', 'jamón', 'jamon', 'salchicha', 'chorizo', 'bacon', 'tocino', 'mortadela', 'pechuga', 'muslo', 'chuleta', 'bistec', 'pescado', 'embutido'],
    'Lácteos': ['leche', 'queso', 'yogurt', 'yogur', 'mantequilla', 'crema', 'helado', 'natilla', 'flan', 'evaporada', 'condensada'],
    'Alimentos': ['arroz', 'pasta', 'frijol', 'frijoles', 'harina', 'azúcar', 'azucar', 'aceite', 'sopa', 'cereales', 'galleta', 'galleticas', 'chocolate', 'caramelo', 'dulce', 'conserva', 'atún', 'atun', 'sardina', 'mayonesa', 'ketchup', 'mostaza', 'salsa', 'espagueti', 'macarrones', 'premium', 'grano'],
    'Bebidas': ['agua', 'refresco', 'jugo', 'cerveza', 'vino', 'whisky', 'vodka', 'pepsi', 'fanta', 'sprite', 'malta', 'café', 'cafe', 'limonada', 'naranjada', 'coca', 'gaseosa', 'bebida'],
    'Frutas y Verduras': ['manzana', 'naranja', 'plátano', 'platano', 'banana', 'piña', 'pina', 'mango', 'papaya', 'guayaba', 'fruta', 'tomate', 'cebolla', 'ajo', 'lechuga', 'zanahoria', 'papa', 'yuca', 'boniato', 'calabaza', 'pepino', 'pimiento', 'verdura', 'vegetal', 'aguacate'],
    'Panadería': ['pan', 'panetela', 'cake', 'torta', 'pastel', 'bizcocho', 'rosquita', 'tostada', 'croissant', 'panaderia'],
    'Higiene Personal': ['champú', 'champu', 'shampoo', 'acondicionador', 'dental', 'desodorante', 'perfume', 'colonia', 'pañal', 'panal', 'sanitaria', 'higienico', 'higiénico', 'cepillo', 'rasuradora', 'afeitadora', 'crema'],
    'Ropa': ['camisa', 'pantalón', 'pantalon', 'vestido', 'falda', 'blusa', 'camiseta', 't-shirt', 'tshirt', 'zapato', 'tenis', 'sandalia', 'medias', 'calcetín', 'calcetin', 'interior', 'short', 'jean', 'jeans', 'polo', 'nike', 'adidas', 'puma'],
    'Hogar': ['sábana', 'sabana', 'almohada', 'toalla', 'cortina', 'alfombra', 'lámpara', 'lampara', 'vela', 'florero', 'cuadro', 'espejo', 'colchón', 'colchon', 'silla', 'mesa', 'mueble']
  }

  // Find matching category using word boundaries
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      // Check if any word starts with the keyword (for better matching)
      const hasMatch = words.some(word =>
        word === keyword ||
        word.startsWith(keyword) ||
        (keyword.length >= 4 && word.includes(keyword))
      )
      if (hasMatch) {
        // Generate a better description
        const descriptions: Record<string, string> = {
          'Alimentos': 'Producto alimenticio de calidad',
          'Bebidas': 'Bebida refrescante',
          'Carnes y Embutidos': 'Producto cárnico fresco',
          'Lácteos': 'Producto lácteo nutritivo',
          'Frutas y Verduras': 'Producto fresco natural',
          'Panadería': 'Producto de panadería',
          'Limpieza': 'Producto de limpieza para el hogar',
          'Higiene Personal': 'Producto de higiene personal',
          'Electrodomésticos': 'Electrodoméstico de alta calidad',
          'Electrónica': 'Dispositivo electrónico',
          'Ropa': 'Prenda de vestir',
          'Hogar': 'Artículo para el hogar'
        }
        return {
          category,
          description: descriptions[category] || `Producto de ${category.toLowerCase()}`
        }
      }
    }
  }

  // Default fallback
  return {
    category: 'Otros',
    description: 'Producto para inventario'
  }
}

// Download image from external URL and upload to Supabase Storage
async function downloadAndUploadImage(imageUrl: string): Promise<string | null> {
  try {
    console.log('[AI Suggest] Downloading image from:', imageUrl)

    // Check if Supabase is configured
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[AI Suggest] Supabase not configured, returning original URL')
      return imageUrl
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      console.error('[AI Suggest] Failed to download image:', response.status)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Validate content type is an image
    if (!contentType.startsWith('image/')) {
      console.error('[AI Suggest] Response is not an image:', contentType)
      return null
    }

    // Get the image data as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check file size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      console.warn('[AI Suggest] Image too large:', buffer.length)
      return null
    }

    // Determine file extension from content type
    let extension = 'jpg'
    if (contentType.includes('png')) extension = 'png'
    else if (contentType.includes('webp')) extension = 'webp'
    else if (contentType.includes('gif')) extension = 'gif'

    // Generate unique filename
    const timestamp = Date.now()
    const randomSuffix = randomBytes(8).toString('hex')
    const fileName = `ai-product-${timestamp}-${randomSuffix}.${extension}`
    const storagePath = `market-products/${fileName}`

    console.log('[AI Suggest] Uploading to Supabase:', storagePath)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType,
        upsert: false
      })

    if (error) {
      console.error('[AI Suggest] Supabase upload error:', error.message)
      return null
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    console.log('[AI Suggest] Image uploaded successfully:', publicUrlData.publicUrl)
    return publicUrlData.publicUrl
  } catch (error) {
    console.error('[AI Suggest] Error downloading/uploading image:', error)
    return null
  }
}

// Extract image URL from various response formats
function extractImageUrl(content: string): string | null {
  // Try JSON format first
  const jsonMatch = content.match(/"imageUrl"\s*:\s*"([^"]+)"/)
  if (jsonMatch) return jsonMatch[1]

  // Try to find any https URL that looks like an image
  // More lenient pattern that accepts URLs with or without extensions
  const urlPatterns = [
    // URLs with standard image extensions
    /https?:\/\/[^\s"<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"<>]*)?/i,
    // URLs from common CDN/storage services (often don't have extensions)
    /https?:\/\/(?:images|cdn|static|img|media|assets|storage)[^\s"<>]+/i,
    // URLs containing image-related path segments
    /https?:\/\/[^\s"<>]*(?:\/image\/|\/img\/|\/photo\/|\/product\/)[^\s"<>]*/i
  ]

  for (const pattern of urlPatterns) {
    const match = content.match(pattern)
    if (match) return match[0]
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const { productName } = await request.json()

    if (!productName || productName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del producto debe tener al menos 2 caracteres'
      }, { status: 400 })
    }

    console.log('[AI Suggest] Processing product:', productName)

    // Build a detailed prompt for rich descriptions
    const systemPrompt = `Eres un experto en productos de tienda/mercado. Tu trabajo es clasificar productos y escribir descripciones comerciales atractivas y detalladas para el inventario. Responde ÚNICAMENTE con JSON válido, sin texto adicional.`

    const userPrompt = `Analiza este producto y genera una ficha completa:

Producto: "${productName.trim()}"

CATEGORÍAS DISPONIBLES (usa exactamente una):
${CATEGORIES.join(', ')}

INSTRUCCIONES:
1. Selecciona la categoría más apropiada de la lista
2. Escribe una descripción comercial DETALLADA (150-250 caracteres) que incluya:
   - Características principales del producto
   - Beneficios o usos comunes
   - Información relevante (tamaño, marca si aplica)
   - Lenguaje atractivo para ventas

FORMATO DE RESPUESTA (JSON válido):
{"category": "Categoría", "description": "Descripción detallada y comercial del producto..."}

JSON:`

    // Call Z.ai API for category and description
    const response = await fetch(ZAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ZAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Slightly higher for creative descriptions
        max_tokens: 300,
        stream: false,
        thinking: { type: 'disabled' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AI Suggest] API Error:', response.status, errorText)

      // Use fallback categorization when AI API fails
      console.log('[AI Suggest] Using fallback categorization')
      const fallbackSuggestion = fallbackCategorization(productName.trim())

      return NextResponse.json({
        success: true,
        data: {
          category: fallbackSuggestion.category,
          description: fallbackSuggestion.description,
          productName: productName.trim(),
          source: 'fallback'
        }
      })
    }

    const data: ZAIResponse = await response.json()
    console.log('[AI Suggest] Raw response:', JSON.stringify(data))

    if (!data.choices || data.choices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se recibió respuesta del modelo'
      }, { status: 500 })
    }

    // Parse the AI response - handle both content and reasoning_content
    const message = data.choices[0].message
    let content = message.content || ''

    // If content is empty but reasoning_content exists, try to extract from there
    if (!content && (message as any).reasoning_content) {
      console.log('[AI Suggest] Using reasoning_content as fallback')
      // Use fallback instead of trying to parse reasoning
      const fallbackSuggestion = fallbackCategorization(productName.trim())
      return NextResponse.json({
        success: true,
        data: {
          category: fallbackSuggestion.category,
          description: fallbackSuggestion.description,
          productName: productName.trim(),
          source: 'fallback-reasoning'
        }
      })
    }

    let suggestion: ProductSuggestion

    try {
      // Clean the response in case there are markdown code blocks
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      }

      // Remove any leading/trailing whitespace and newlines
      cleanContent = cleanContent.replace(/^\s+|\s+$/g, '')

      suggestion = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('[AI Suggest] Parse error:', parseError, 'Content:', content)

      // Try to extract data with regex as fallback
      const categoryMatch = content.match(/"category"\s*:\s*"([^"]+)"/)
      const descriptionMatch = content.match(/"description"\s*:\s*"([^"]+)"/)

      if (categoryMatch && descriptionMatch) {
        suggestion = {
          category: categoryMatch[1],
          description: descriptionMatch[1]
        }
      } else {
        // Last resort: use keyword-based fallback
        console.log('[AI Suggest] Using keyword fallback due to parse error')
        const fallbackSuggestion = fallbackCategorization(productName.trim())
        return NextResponse.json({
          success: true,
          data: {
            category: fallbackSuggestion.category,
            description: fallbackSuggestion.description,
            productName: productName.trim(),
            source: 'fallback-parse'
          }
        })
      }
    }

    // Validate the category is in our list
    if (!CATEGORIES.includes(suggestion.category)) {
      console.log('[AI Suggest] Invalid category, defaulting to Otros:', suggestion.category)
      suggestion.category = 'Otros'
    }

    // Truncate description if too long (max 300 chars for detailed descriptions)
    if (suggestion.description && suggestion.description.length > 300) {
      suggestion.description = suggestion.description.substring(0, 297) + '...'
    }

    console.log('[AI Suggest] Category and description:', suggestion)

    // Now search for a product image using web search
    let finalImageUrl: string | null = null
    try {
      console.log('[AI Suggest] Searching for product image...')

      const imageSearchResponse = await fetch(ZAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ZAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: ZAI_MODEL,
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente que busca imágenes de productos. Usa la herramienta de búsqueda web para encontrar una imagen del producto y devuelve SOLO la URL de la imagen en formato JSON.'
            },
            {
              role: 'user',
              content: `Busca una imagen de producto para: "${productName.trim()}". Necesito una URL directa a una imagen (jpg, png, webp) de este producto. Responde SOLO con JSON: {"imageUrl": "https://..."}`
            }
          ],
          temperature: 0.1,
          max_tokens: 200,
          stream: false,
          thinking: { type: 'disabled' },
          tools: [
            {
              type: 'web_search',
              web_search: {
                enable: true,
                search_engine: 'search_pro_jina',
                search_result_count: 5
              }
            }
          ]
        })
      })

      if (imageSearchResponse.ok) {
        const imageData = await imageSearchResponse.json()
        const imageContent = imageData.choices?.[0]?.message?.content || ''
        console.log('[AI Suggest] Image search response:', imageContent)

        // Extract image URL using the more lenient function
        const externalImageUrl = extractImageUrl(imageContent)

        if (externalImageUrl) {
          console.log('[AI Suggest] Found external image URL:', externalImageUrl)

          // Download the image and upload to Supabase Storage
          const uploadedUrl = await downloadAndUploadImage(externalImageUrl)

          if (uploadedUrl) {
            finalImageUrl = uploadedUrl
            console.log('[AI Suggest] Image stored in Supabase:', finalImageUrl)
          } else {
            console.warn('[AI Suggest] Failed to store image, returning external URL')
            // Optionally return the external URL as fallback
            // finalImageUrl = externalImageUrl
          }
        }
      }
    } catch (imageError) {
      console.error('[AI Suggest] Image search error:', imageError)
      // Continue without image - it's optional
    }

    console.log('[AI Suggest] Final suggestion:', { ...suggestion, imageUrl: finalImageUrl })

    return NextResponse.json({
      success: true,
      data: {
        category: suggestion.category,
        description: suggestion.description,
        imageUrl: finalImageUrl,
        productName: productName.trim()
      }
    })

  } catch (error) {
    console.error('[AI Suggest] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
