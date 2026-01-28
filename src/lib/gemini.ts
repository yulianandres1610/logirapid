/**
 * Google Gemini AI Client
 * Funciones para generación de imagenes de productos
 * Usa Gemini 3 Pro Image Preview para generación de imágenes
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'

// Límite de tamaño para imágenes enviadas a Gemini (2MB en base64 ≈ 1.5MB original)
const GEMINI_MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB en base64
const GEMINI_TARGET_SIZE = 1024 // Redimensionar a max 1024px si es muy grande
const STANDARD_IMAGE_SIZE = 1024 // Tamaño estándar para todas las imágenes de productos

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
// Modelo para generación de imágenes de productos
// gemini-2.0-flash-exp soporta generación nativa de imágenes con responseModalities: ['IMAGE', 'TEXT']
const IMAGE_GENERATION_MODEL = 'gemini-2.0-flash-exp'

/**
 * Obtiene el cliente de Gemini AI
 */
function getGeminiClient() {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY no esta configurado en las variables de entorno')
  }
  return new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
}

/**
 * Comprime/redimensiona una imagen si excede el límite de Gemini
 * @param base64Data - Imagen en base64
 * @returns Imagen comprimida en base64
 */
async function compressImageForGemini(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  // Si ya está dentro del límite, devolver sin cambios
  if (cleanBase64.length <= GEMINI_MAX_IMAGE_SIZE) {
    console.log('[Gemini] Image size OK:', Math.round(cleanBase64.length / 1024), 'KB')
    return cleanBase64
  }

  console.log('[Gemini] Image too large:', Math.round(cleanBase64.length / 1024), 'KB, compressing...')

  try {
    const inputBuffer = Buffer.from(cleanBase64, 'base64')

    // Obtener metadata para saber dimensiones actuales
    const metadata = await sharp(inputBuffer).metadata()
    const maxDimension = Math.max(metadata.width || 0, metadata.height || 0)

    // Calcular ratio de redimensionamiento si es necesario
    let resizeOptions = {}
    if (maxDimension > GEMINI_TARGET_SIZE) {
      resizeOptions = {
        width: GEMINI_TARGET_SIZE,
        height: GEMINI_TARGET_SIZE,
        fit: 'inside' as const,
        withoutEnlargement: true
      }
    }

    // Comprimir con calidad reducida progresivamente hasta que quepa
    let quality = 85
    let outputBuffer: Buffer
    let outputBase64: string

    do {
      outputBuffer = await sharp(inputBuffer)
        .resize(resizeOptions)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()

      outputBase64 = outputBuffer.toString('base64')
      quality -= 10
    } while (outputBase64.length > GEMINI_MAX_IMAGE_SIZE && quality > 20)

    console.log('[Gemini] Compressed to:', Math.round(outputBase64.length / 1024), 'KB (quality:', quality + 10, ')')

    return outputBase64
  } catch (error) {
    console.error('[Gemini] Compression error:', error)
    // En caso de error, devolver original
    return cleanBase64
  }
}

/**
 * Normaliza una imagen a tamaño estándar 1024x1024 con fondo blanco
 * Esto asegura que todas las imágenes de productos tengan el mismo tamaño
 */
async function normalizeImageSize(base64Data: string): Promise<string> {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const inputBuffer = Buffer.from(cleanBase64, 'base64')

    // Obtener metadata de la imagen
    const metadata = await sharp(inputBuffer).metadata()
    const width = metadata.width || STANDARD_IMAGE_SIZE
    const height = metadata.height || STANDARD_IMAGE_SIZE

    console.log(`[Gemini Normalize] Input size: ${width}x${height}`)

    // Calcular el tamaño para que el producto ocupe ~80% del frame
    const maxDimension = Math.max(width, height)
    const targetProductSize = Math.floor(STANDARD_IMAGE_SIZE * 0.8) // 80% del frame
    const scale = targetProductSize / maxDimension

    const scaledWidth = Math.floor(width * scale)
    const scaledHeight = Math.floor(height * scale)

    // Redimensionar la imagen manteniendo proporción
    const resizedBuffer = await sharp(inputBuffer)
      .resize(scaledWidth, scaledHeight, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .toBuffer()

    // Crear imagen final 1024x1024 con fondo blanco y producto centrado
    const outputBuffer = await sharp({
      create: {
        width: STANDARD_IMAGE_SIZE,
        height: STANDARD_IMAGE_SIZE,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
      .composite([{
        input: resizedBuffer,
        gravity: 'center'
      }])
      .png({ quality: 95 })
      .toBuffer()

    const outputBase64 = outputBuffer.toString('base64')
    console.log(`[Gemini Normalize] Output size: ${STANDARD_IMAGE_SIZE}x${STANDARD_IMAGE_SIZE}`)

    return outputBase64
  } catch (error) {
    console.error('[Gemini Normalize] Error:', error)
    // En caso de error, devolver original
    return base64Data.replace(/^data:image\/\w+;base64,/, '')
  }
}

/**
 * Convierte base64 a formato de imagen para Gemini
 */
function base64ToGeminiPart(base64Data: string, mimeType: string = 'image/jpeg') {
  // Remover prefijo data:image/xxx;base64, si existe
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')

  return {
    inlineData: {
      data: cleanBase64,
      mimeType
    }
  }
}

/**
 * Extrae la imagen procesada de la respuesta de Gemini
 * Gemini puede devolver imagenes en diferentes formatos
 */
function extractImageFromResponse(response: any): string | null {
  try {
    const content = response.response?.candidates?.[0]?.content
    if (!content) return null

    for (const part of content.parts || []) {
      // Buscar imagen inline
      if (part.inlineData?.data) {
        return part.inlineData.data
      }
      // Buscar URL de imagen
      if (part.fileData?.fileUri) {
        return part.fileData.fileUri
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Limpia una imagen de producto usando IA
 * - Remueve fondo distractivo
 * - Centra el producto
 * - Aplica fondo blanco profesional
 */
export async function cleanProductImage(imageBase64: string): Promise<{
  success: boolean
  imageBase64?: string
  description?: string
  error?: string
}> {
  if (!GOOGLE_AI_API_KEY) {
    return {
      success: false,
      error: 'GOOGLE_AI_API_KEY no configurada'
    }
  }

  try {
    console.log('[Gemini Clean] Processing image to remove background...')

    // Comprimir la imagen si es muy grande para Gemini
    const cleanBase64 = await compressImageForGemini(imageBase64)

    // Usar Gemini para editar la imagen y remover el fondo
    // Prompt optimizado para generar imagenes del mismo tamano que las generadas (1024x1024)
    const prompt = `Edit this product image for e-commerce:

CRITICAL REQUIREMENTS:
1. Output MUST be exactly 1024x1024 pixels (square format)
2. Remove the background completely and replace with pure white (#FFFFFF)
3. Keep ONLY the main product - remove all other elements, text, watermarks
4. Scale and position the product so it occupies approximately 80% of the frame
5. Center the product both horizontally and vertically
6. Add equal white padding on all sides (approximately 10% margin)
7. Maintain the product's original colors, details, and proportions
8. Apply professional studio lighting appearance
9. Ensure sharp edges where product meets background

The final image should match professional e-commerce product photography standards - clean, consistent, and ready for display on product pages.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GENERATION_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Gemini Clean] API Error:', response.status, errorText)
      return {
        success: false,
        error: 'No se pudo limpiar la imagen'
      }
    }

    const data = await response.json()

    // Buscar imagen en la respuesta
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('[Gemini Clean] Image cleaned successfully, normalizing size...')

          // Normalizar la imagen a 1024x1024 con fondo blanco centrado
          const normalizedImage = await normalizeImageSize(part.inlineData.data)

          return {
            success: true,
            imageBase64: normalizedImage,
            description: 'Imagen limpiada con fondo blanco (1024x1024)'
          }
        }
      }
    }

    // Si no devuelve imagen editada, normalizar la original
    console.log('[Gemini Clean] No edited image returned, normalizing original...')
    const normalizedOriginal = await normalizeImageSize(cleanBase64)
    return {
      success: true,
      imageBase64: normalizedOriginal,
      description: 'Imagen normalizada a tamaño estándar (1024x1024)'
    }

  } catch (error) {
    console.error('[Gemini Clean] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al limpiar imagen'
    }
  }
}

/**
 * Genera una imagen de producto usando Gemini 3 Pro Image Preview
 * Todas las imágenes son cuadradas (1024x1024) con fondo blanco
 */
export async function generateProductImage(
  productName: string,
  description?: string
): Promise<{
  success: boolean
  imageBase64?: string
  imageUrl?: string
  imageDescription?: string
  error?: string
}> {
  if (!GOOGLE_AI_API_KEY) {
    return {
      success: false,
      error: 'GOOGLE_AI_API_KEY no configurada'
    }
  }

  try {
    console.log('[Gemini Image] Generating image for:', productName)

    // Prompt optimizado para imágenes de productos e-commerce
    const imagePrompt = `Generate a professional product photograph of "${productName}"${description ? `. ${description}` : ''}.
Requirements:
- Pure white background (#FFFFFF)
- Professional studio lighting
- Product centered in frame
- Sharp focus, high detail
- E-commerce photography style
- Square format 1024x1024 pixels
- No text, labels, or watermarks
- Clean, minimalist presentation`

    console.log('[Gemini Image] Using model:', IMAGE_GENERATION_MODEL)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GENERATION_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: imagePrompt
            }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Gemini Image] API Error:', response.status, errorText)

      // Fallback a Gemini 2.0 Flash
      console.log('[Gemini Image] Trying fallback model...')
      return await generateImageWithFallback(productName, description)
    }

    const data = await response.json()

    // Buscar imagen en la respuesta
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('[Gemini Image] Image generated successfully, normalizing size...')

          // Normalizar la imagen a 1024x1024 con fondo blanco centrado
          const normalizedImage = await normalizeImageSize(part.inlineData.data)

          return {
            success: true,
            imageBase64: normalizedImage,
            imageDescription: `Imagen generada para ${productName} (1024x1024)`
          }
        }
      }
    }

    // Si no hay imagen, intentar con fallback
    console.log('[Gemini Image] No image in response, trying fallback...')
    return await generateImageWithFallback(productName, description)

  } catch (error) {
    console.error('[Gemini Image] Error:', error)

    // Fallback
    try {
      return await generateImageWithFallback(productName, description)
    } catch (fallbackError) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al generar imagen'
      }
    }
  }
}

/**
 * Genera imagen usando Gemini 2.0 Flash (fallback)
 */
async function generateImageWithFallback(
  productName: string,
  description?: string
): Promise<{
  success: boolean
  imageBase64?: string
  imageDescription?: string
  error?: string
}> {
  try {
    console.log('[Gemini Fallback] Generating image for:', productName)

    const prompt = `Generate a professional product photograph of "${productName}"${description ? `. ${description}` : ''}. Pure white background, studio lighting, centered product, e-commerce style, square format 1024x1024, no text or watermarks.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Gemini Fallback] Error:', errorText)
      return {
        success: false,
        error: 'No se pudo generar la imagen'
      }
    }

    const data = await response.json()

    // Buscar imagen en la respuesta
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('[Gemini Fallback] Image generated successfully, normalizing size...')

          // Normalizar la imagen a 1024x1024 con fondo blanco centrado
          const normalizedImage = await normalizeImageSize(part.inlineData.data)

          return {
            success: true,
            imageBase64: normalizedImage,
            imageDescription: `Imagen generada para ${productName} (1024x1024)`
          }
        }
      }
    }

    return {
      success: false,
      error: 'No se generó imagen en la respuesta'
    }

  } catch (error) {
    console.error('[Gemini Fallback] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar imagen'
    }
  }
}

/**
 * Mejora la calidad de una imagen de producto
 * - Mejora iluminacion y colores
 * - Analiza calidad
 */
export async function enhanceProductImage(imageBase64: string): Promise<{
  success: boolean
  imageBase64?: string
  qualityScore?: number
  suggestions?: string[]
  error?: string
}> {
  try {
    // Comprimir la imagen si es muy grande para Gemini
    const compressedBase64 = await compressImageForGemini(imageBase64)

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const prompt = `Analiza esta imagen de producto para e-commerce y evalua:

1. Calidad de la imagen (1-10)
2. Iluminacion (buena/regular/mala)
3. Fondo (limpio/distractivo)
4. Enfoque (nitido/borroso)
5. Composicion (centrado/descentrado)

Sugiere mejoras especificas si es necesario.

Responde en JSON:
{
  "qualityScore": 8,
  "lighting": "buena",
  "background": "limpio",
  "focus": "nitido",
  "composition": "centrado",
  "suggestions": ["sugerencia1", "sugerencia2"],
  "isAcceptable": true
}`

    const result = await model.generateContent([
      prompt,
      base64ToGeminiPart(compressedBase64)
    ])

    const responseText = result.response.text()

    // Parsear respuesta
    let analysis
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      }
    } catch {
      analysis = { qualityScore: 7, suggestions: [], isAcceptable: true }
    }

    return {
      success: true,
      imageBase64: compressedBase64,
      qualityScore: analysis.qualityScore,
      suggestions: analysis.suggestions
    }
  } catch (error) {
    console.error('[Gemini] Error enhancing image:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al analizar imagen'
    }
  }
}

/**
 * Analiza una imagen y extrae informacion del producto
 */
export async function analyzeProductImage(imageBase64: string): Promise<{
  success: boolean
  product?: {
    name: string
    category: string
    brand?: string
    features: string[]
    barcode?: string
  }
  error?: string
}> {
  try {
    // Comprimir la imagen si es muy grande para Gemini
    const compressedBase64 = await compressImageForGemini(imageBase64)

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const prompt = `Analiza esta imagen de producto y extrae:

1. Nombre del producto
2. Categoria mas apropiada de: Alimentos, Bebidas, Carnes y Embutidos, Lacteos, Frutas y Verduras, Panaderia, Limpieza, Higiene Personal, Electrodomesticos, Electronica, Ropa, Hogar, Otros
3. Marca (si es visible)
4. Caracteristicas principales
5. Codigo de barras (si es visible)

Responde en JSON:
{
  "name": "nombre del producto",
  "category": "categoria",
  "brand": "marca o null",
  "features": ["caracteristica1", "caracteristica2"],
  "barcode": "codigo o null"
}`

    const result = await model.generateContent([
      prompt,
      base64ToGeminiPart(compressedBase64)
    ])

    const responseText = result.response.text()

    // Parsear respuesta
    let productInfo
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        productInfo = JSON.parse(jsonMatch[0])
      }
    } catch {
      productInfo = { name: 'Producto', category: 'Otros', features: [] }
    }

    return {
      success: true,
      product: {
        name: productInfo.name,
        category: productInfo.category,
        brand: productInfo.brand || undefined,
        features: productInfo.features || [],
        barcode: productInfo.barcode || undefined
      }
    }
  } catch (error) {
    console.error('[Gemini] Error analyzing image:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al analizar imagen'
    }
  }
}

/**
 * Procesa foto de empleado para contrato
 * - Remueve fondo y pone blanco puro
 * - Agrega traje formal según género
 * - Normaliza a 1024x1024
 */
export async function processEmployeePhoto(
  imageBase64: string,
  gender: 'male' | 'female'
): Promise<{
  success: boolean
  imageBase64?: string
  error?: string
}> {
  if (!GOOGLE_AI_API_KEY) {
    return { success: false, error: 'GOOGLE_AI_API_KEY no configurada' }
  }

  try {
    console.log('[Gemini Employee Photo] Processing with gender:', gender)

    // Comprimir si es muy grande (misma función que productos)
    const cleanBase64 = await compressImageForGemini(imageBase64)

    const suitDescription = gender === 'male'
      ? 'dark navy formal business suit with white shirt and tie'
      : 'elegant navy blazer with professional blouse'

    // Prompt simplificado para mejor compatibilidad
    const prompt = `Transform this photo into a professional corporate headshot:
- Remove background, replace with pure white
- Add ${suitDescription} to the person
- Keep face exactly the same, don't alter facial features
- Center the person, head and shoulders visible
- Professional studio lighting
- Output 1024x1024 square image`

    console.log('[Gemini Employee Photo] Using model:', IMAGE_GENERATION_MODEL)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GENERATION_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
            ]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Gemini Employee Photo] API Error:', response.status, errorText)

      // Try fallback: just normalize the original image
      console.log('[Gemini Employee Photo] API failed, normalizing original as fallback...')
      const normalizedOriginal = await normalizeImageSize(cleanBase64)
      return {
        success: true,
        imageBase64: normalizedOriginal,
        error: 'IA no disponible, se uso imagen original normalizada'
      }
    }

    const data = await response.json()

    // Log response for debugging
    console.log('[Gemini Employee Photo] Response received, checking for image...')

    // Check for blocked content
    if (data.candidates?.[0]?.finishReason === 'SAFETY' ||
        data.candidates?.[0]?.finishReason === 'RECITATION' ||
        data.promptFeedback?.blockReason) {
      console.log('[Gemini Employee Photo] Content blocked, normalizing original...')
      const normalizedOriginal = await normalizeImageSize(cleanBase64)
      return {
        success: true,
        imageBase64: normalizedOriginal,
        error: 'Filtro de seguridad activado, se uso imagen original'
      }
    }

    // Buscar imagen en respuesta (mismo patrón que cleanProductImage)
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('[Gemini Employee Photo] Success! AI processed image received.')
          const normalizedImage = await normalizeImageSize(part.inlineData.data)
          return { success: true, imageBase64: normalizedImage }
        }
      }
    }

    // Fallback: normalizar original
    console.log('[Gemini Employee Photo] No AI image returned, normalizing original...')
    const normalizedOriginal = await normalizeImageSize(cleanBase64)
    return { success: true, imageBase64: normalizedOriginal }

  } catch (error) {
    console.error('[Gemini Employee Photo] Error:', error)

    // Last resort fallback
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const normalizedOriginal = await normalizeImageSize(cleanBase64)
      return {
        success: true,
        imageBase64: normalizedOriginal,
        error: 'Error de IA, se uso imagen original'
      }
    } catch (fallbackError) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al procesar imagen'
      }
    }
  }
}

/**
 * Verifica si la API key de Gemini esta configurada
 */
export function isGeminiConfigured(): boolean {
  return !!GOOGLE_AI_API_KEY
}
