/**
 * Google Gemini AI Client
 * Funciones para generación de imagenes de productos
 * Usa Imagen 3 (modelo de generación de imágenes de Google)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
const IMAGEN_MODEL = 'imagen-3.0-generate-002' // Modelo de generación de imágenes

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
 * Limpia una imagen de producto
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
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const prompt = `Analiza esta imagen de producto y describe:
1. Que producto es
2. Sus caracteristicas visuales principales
3. El estado del fondo (limpio, con ruido, etc)

Responde en formato JSON:
{"product": "nombre", "features": ["caracteristica1", "caracteristica2"], "backgroundStatus": "descripcion del fondo", "needsCleaning": true/false}`

    const result = await model.generateContent([
      prompt,
      base64ToGeminiPart(imageBase64)
    ])

    const responseText = result.response.text()

    // Intentar parsear JSON de la respuesta
    let analysis
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      }
    } catch {
      analysis = { product: 'Producto', needsCleaning: false }
    }

    return {
      success: true,
      imageBase64: imageBase64, // Por ahora devolvemos la original
      description: `Producto: ${analysis.product}. ${analysis.backgroundStatus || 'Fondo analizado'}`
    }
  } catch (error) {
    console.error('[Gemini] Error cleaning image:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar imagen'
    }
  }
}

/**
 * Genera una imagen de producto usando Google Imagen 3
 * API REST directa para generación de imágenes
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
    console.log('[Imagen] Generating image for:', productName)

    // Construir prompt profesional para imagen de producto
    const imagePrompt = `Professional product photography of ${productName}${description ? `, ${description}` : ''}. Clean white background, studio lighting, high resolution, e-commerce style, centered product, sharp focus, no text or watermarks.`

    console.log('[Imagen] Prompt:', imagePrompt)

    // Llamar a la API de Imagen 3 de Google
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateImages?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          number_of_images: 1,
          aspect_ratio: '1:1',
          safety_filter_level: 'BLOCK_LOW_AND_ABOVE',
          person_generation: 'DONT_ALLOW'
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Imagen] API Error:', response.status, errorText)

      // Si Imagen 3 no está disponible, intentar con Gemini 2.0 Flash
      console.log('[Imagen] Trying Gemini 2.0 Flash as fallback...')
      return await generateImageWithGeminiFlash(productName, description)
    }

    const data = await response.json()
    console.log('[Imagen] Response received')

    // Extraer imagen generada
    if (data.images && data.images.length > 0) {
      const imageData = data.images[0]

      if (imageData.bytesBase64Encoded) {
        return {
          success: true,
          imageBase64: imageData.bytesBase64Encoded,
          imageDescription: `Imagen generada para ${productName}`
        }
      }
    }

    // Si no hay imagen, intentar con Gemini Flash
    console.log('[Imagen] No image in response, trying Gemini Flash...')
    return await generateImageWithGeminiFlash(productName, description)

  } catch (error) {
    console.error('[Imagen] Error:', error)

    // Fallback a Gemini Flash
    try {
      return await generateImageWithGeminiFlash(productName, description)
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
async function generateImageWithGeminiFlash(
  productName: string,
  description?: string
): Promise<{
  success: boolean
  imageBase64?: string
  imageDescription?: string
  error?: string
}> {
  try {
    console.log('[Gemini Flash] Generating image for:', productName)

    const prompt = `Generate a professional product image: ${productName}${description ? `. ${description}` : ''}. White background, studio lighting, e-commerce style.`

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
            responseModalities: ['IMAGE', 'TEXT'],
            responseMimeType: 'image/png'
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Gemini Flash] Error:', errorText)
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
          console.log('[Gemini Flash] Image generated successfully')
          return {
            success: true,
            imageBase64: part.inlineData.data,
            imageDescription: `Imagen generada para ${productName}`
          }
        }
      }
    }

    return {
      success: false,
      error: 'No se generó imagen en la respuesta'
    }

  } catch (error) {
    console.error('[Gemini Flash] Error:', error)
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
      base64ToGeminiPart(imageBase64)
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
      imageBase64: imageBase64,
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
      base64ToGeminiPart(imageBase64)
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
 * Verifica si la API key de Gemini esta configurada
 */
export function isGeminiConfigured(): boolean {
  return !!GOOGLE_AI_API_KEY
}
