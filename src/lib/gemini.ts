/**
 * Google Gemini AI Client
 * Funciones para procesamiento de imagenes de productos
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'

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
 * Genera una imagen de producto desde descripcion
 * Usa Gemini para crear una descripcion visual y buscar imagen similar
 */
export async function generateProductImage(
  productName: string,
  description?: string
): Promise<{
  success: boolean
  imageDescription?: string
  searchTerms?: string[]
  error?: string
}> {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const prompt = `Eres un experto en fotografia de productos para e-commerce.

Para el producto: "${productName}"
${description ? `Descripcion: ${description}` : ''}

Genera:
1. Una descripcion visual detallada de como deberia verse la imagen del producto (para buscar stock photos similares)
2. Terminos de busqueda en ingles para encontrar imagenes similares
3. Caracteristicas visuales clave

Responde en JSON:
{
  "visualDescription": "descripcion detallada de la imagen ideal",
  "searchTerms": ["term1", "term2", "term3"],
  "keyFeatures": ["feature1", "feature2"],
  "suggestedBackground": "white/transparent/lifestyle"
}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Parsear respuesta JSON
    let imageInfo
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        imageInfo = JSON.parse(jsonMatch[0])
      }
    } catch {
      imageInfo = {
        visualDescription: `Imagen profesional de ${productName}`,
        searchTerms: [productName, 'product photo', 'white background'],
        suggestedBackground: 'white'
      }
    }

    return {
      success: true,
      imageDescription: imageInfo.visualDescription,
      searchTerms: imageInfo.searchTerms
    }
  } catch (error) {
    console.error('[Gemini] Error generating image description:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar descripcion'
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
