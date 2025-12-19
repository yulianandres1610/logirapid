import { NextRequest, NextResponse } from 'next/server'

// Z.ai API Configuration (docs: https://docs.z.ai/api-reference/introduction)
const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/chat/completions'
const ZAI_API_KEY = '98c8e5eeb08d4f42963bcb4d963bbfd6.NbBtw1KWVhSdb5HC'
const ZAI_MODEL = 'glm-4.6' // GLM-4.6 flagship model

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

    // Build a simple, direct prompt
    const systemPrompt = `Clasifica productos para inventario. Responde SOLO con JSON válido.`

    const userPrompt = `Producto: "${productName.trim()}"

Categorías válidas: ${CATEGORIES.join(', ')}

Responde exactamente así (JSON):
{"category": "CATEGORIA", "description": "descripción corta"}

JSON:`

    // Call Z.ai API
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
        temperature: 0.1, // Very low for consistent JSON output
        max_tokens: 150,
        stream: false,
        thinking: { type: 'disabled' } // Disable reasoning mode to get direct response
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

    // Truncate description if too long
    if (suggestion.description && suggestion.description.length > 150) {
      suggestion.description = suggestion.description.substring(0, 147) + '...'
    }

    console.log('[AI Suggest] Final suggestion:', suggestion)

    return NextResponse.json({
      success: true,
      data: {
        category: suggestion.category,
        description: suggestion.description,
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
