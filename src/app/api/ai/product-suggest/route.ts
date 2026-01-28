import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini Configuration - Optimizado para descripciones de productos
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash' // Modelo rápido para generación de texto

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

interface ProductSuggestion {
  category: string
  description: string
  unitOfMeasure?: string
}

// Fallback categorization based on keywords with word boundary matching
function fallbackCategorization(productName: string): ProductSuggestion {
  const name = productName.toLowerCase()
  const words = name.split(/[\s\-_,\.]+/)

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

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      const hasMatch = words.some(word =>
        word === keyword ||
        word.startsWith(keyword) ||
        (keyword.length >= 4 && word.includes(keyword))
      )
      if (hasMatch) {
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
        const unitOfMeasures: Record<string, string> = {
          'Alimentos': 'unidad',
          'Bebidas': 'unidad',
          'Carnes y Embutidos': 'lb',
          'Lácteos': 'unidad',
          'Frutas y Verduras': 'lb',
          'Panadería': 'unidad',
          'Limpieza': 'unidad',
          'Higiene Personal': 'unidad',
          'Electrodomésticos': 'unidad',
          'Electrónica': 'unidad',
          'Ropa': 'unidad',
          'Hogar': 'unidad'
        }
        return {
          category,
          description: descriptions[category] || `Producto de ${category.toLowerCase()}`,
          unitOfMeasure: unitOfMeasures[category] || 'unidad'
        }
      }
    }
  }

  return {
    category: 'Otros',
    description: 'Producto para inventario',
    unitOfMeasure: 'unidad'
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const { productName } = await request.json()

    if (!productName || productName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del producto debe tener al menos 2 caracteres'
      }, { status: 400, headers: corsHeaders })
    }

    console.log('[AI Suggest] Processing product:', productName)

    // Check if Gemini is configured
    if (!GOOGLE_AI_API_KEY) {
      console.log('[AI Suggest] Gemini not configured, using fallback')
      const fallbackSuggestion = fallbackCategorization(productName.trim())
      return NextResponse.json({
        success: true,
        data: {
          ...fallbackSuggestion,
          productName: productName.trim(),
          source: 'fallback-no-api'
        }
      }, { headers: corsHeaders })
    }

    try {
      const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

      const prompt = `Analiza este producto y genera una ficha para inventario:

Producto: "${productName.trim()}"

CATEGORÍAS (usa exactamente una):
${CATEGORIES.join(', ')}

UNIDADES DE MEDIDA:
unidad, lb, kg, litro, ml, paquete, caja, docena, par, metro, galón

Escribe una descripción comercial (100-200 caracteres) que incluya características y beneficios.

Responde SOLO con JSON válido:
{"category": "Categoría", "description": "Descripción...", "unitOfMeasure": "unidad"}`

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500, // Aumentado para modelos con thinking tokens
        }
      })

      const responseText = result.response.text()
      console.log('[AI Suggest] Gemini response:', responseText)

      // Parse JSON from response
      let suggestion: ProductSuggestion
      try {
        let cleanContent = responseText.trim()
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        }

        const jsonMatch = cleanContent.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          suggestion = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found')
        }
      } catch (parseError) {
        console.error('[AI Suggest] Parse error:', parseError)

        // Try regex extraction
        const categoryMatch = responseText.match(/"category"\s*:\s*"([^"]+)"/)
        const descriptionMatch = responseText.match(/"description"\s*:\s*"([^"]+)"/)
        const unitMatch = responseText.match(/"unitOfMeasure"\s*:\s*"([^"]+)"/)

        if (categoryMatch && descriptionMatch) {
          suggestion = {
            category: categoryMatch[1],
            description: descriptionMatch[1],
            unitOfMeasure: unitMatch ? unitMatch[1] : 'unidad'
          }
        } else {
          // Use fallback
          const fallbackSuggestion = fallbackCategorization(productName.trim())
          return NextResponse.json({
            success: true,
            data: {
              ...fallbackSuggestion,
              productName: productName.trim(),
              source: 'fallback-parse'
            }
          }, { headers: corsHeaders })
        }
      }

      // Validate category
      if (!CATEGORIES.includes(suggestion.category)) {
        console.log('[AI Suggest] Invalid category:', suggestion.category)
        suggestion.category = 'Otros'
      }

      // Truncate description if too long
      if (suggestion.description && suggestion.description.length > 300) {
        suggestion.description = suggestion.description.substring(0, 297) + '...'
      }

      return NextResponse.json({
        success: true,
        data: {
          category: suggestion.category,
          description: suggestion.description,
          unitOfMeasure: suggestion.unitOfMeasure || 'unidad',
          productName: productName.trim(),
          source: 'gemini'
        }
      }, { headers: corsHeaders })

    } catch (aiError) {
      console.error('[AI Suggest] Gemini error:', aiError)

      // Use fallback when Gemini fails
      const fallbackSuggestion = fallbackCategorization(productName.trim())
      return NextResponse.json({
        success: true,
        data: {
          ...fallbackSuggestion,
          productName: productName.trim(),
          source: 'fallback-error'
        }
      }, { headers: corsHeaders })
    }

  } catch (error) {
    console.error('[AI Suggest] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500, headers: corsHeaders })
  }
}
