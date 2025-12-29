import { NextRequest, NextResponse } from 'next/server'

// Z.ai API Configuration
const ZAI_API_URL = 'https://api.z.ai/api/paas/v4/chat/completions'
const ZAI_API_KEY = '98c8e5eeb08d4f42963bcb4d963bbfd6.NbBtw1KWVhSdb5HC'
const ZAI_MODEL = 'glm-4.6'

interface ZAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface MarketplaceSuggestion {
  title: string
  description: string
}

// Fallback suggestion based on product info
function fallbackSuggestion(productName: string, category?: string): MarketplaceSuggestion {
  const categoryDescriptions: Record<string, string> = {
    'Alimentos': 'Producto alimenticio de alta calidad, ideal para su despensa. Frescura garantizada.',
    'Bebidas': 'Bebida refrescante perfecta para cualquier momento del dia. Sabor autentico.',
    'Carnes y Embutidos': 'Producto carnico de primera calidad. Fresco y listo para preparar.',
    'Lacteos': 'Producto lacteo nutritivo y delicioso. Ideal para toda la familia.',
    'Frutas y Verduras': 'Producto natural fresco del campo. Calidad y frescura garantizada.',
    'Panaderia': 'Producto de panaderia artesanal. Recien horneado con ingredientes selectos.',
    'Limpieza': 'Producto de limpieza eficaz para mantener tu hogar impecable.',
    'Higiene Personal': 'Producto de higiene personal de calidad para tu cuidado diario.',
    'Electrodomesticos': 'Electrodomestico de alta calidad con garantia. Eficiencia y durabilidad.',
    'Electronica': 'Dispositivo electronico de ultima tecnologia. Rendimiento superior.',
    'Ropa': 'Prenda de vestir de calidad con excelente acabado y comodidad.',
    'Hogar': 'Articulo para el hogar que combina funcionalidad y estilo.'
  }

  return {
    title: productName,
    description: category && categoryDescriptions[category]
      ? categoryDescriptions[category]
      : `${productName} - Producto de calidad disponible para tu negocio. Excelente precio y disponibilidad inmediata.`
  }
}

export async function POST(request: NextRequest) {
  try {
    const { productName, category, currentPrice } = await request.json()

    if (!productName || productName.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del producto debe tener al menos 2 caracteres'
      }, { status: 400 })
    }

    console.log('[AI Marketplace Suggest] Processing:', productName)

    const systemPrompt = `Eres un experto en marketing y ventas de productos para marketplace B2B. Tu trabajo es crear titulos atractivos y descripciones comerciales que impulsen las ventas. Responde UNICAMENTE con JSON valido, sin texto adicional.`

    const userPrompt = `Genera un titulo comercial y una descripcion atractiva para publicar este producto en un marketplace B2B:

Producto: "${productName.trim()}"
${category ? `Categoria: ${category}` : ''}
${currentPrice ? `Precio: $${currentPrice}` : ''}

INSTRUCCIONES:
1. El TITULO debe ser atractivo, claro y comercial (maximo 80 caracteres)
   - Puede incluir caracteristicas destacadas
   - Debe ser profesional pero llamativo

2. La DESCRIPCION debe ser persuasiva (100-200 caracteres):
   - Destacar beneficios principales
   - Incluir llamada a la accion sutil
   - Lenguaje profesional para compradores mayoristas
   - Mencionar calidad, disponibilidad o ventajas

FORMATO DE RESPUESTA (JSON valido):
{"title": "Titulo comercial atractivo", "description": "Descripcion persuasiva del producto..."}

JSON:`

    try {
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
          temperature: 0.4,
          max_tokens: 250,
          stream: false,
          thinking: { type: 'disabled' }
        })
      })

      if (!response.ok) {
        console.error('[AI Marketplace Suggest] API Error:', response.status)
        const fallback = fallbackSuggestion(productName.trim(), category)
        return NextResponse.json({
          success: true,
          data: { ...fallback, source: 'fallback' }
        })
      }

      const data: ZAIResponse = await response.json()
      console.log('[AI Marketplace Suggest] Raw response:', JSON.stringify(data))

      if (!data.choices || data.choices.length === 0) {
        const fallback = fallbackSuggestion(productName.trim(), category)
        return NextResponse.json({
          success: true,
          data: { ...fallback, source: 'fallback-empty' }
        })
      }

      const content = data.choices[0].message.content || ''
      let suggestion: MarketplaceSuggestion

      try {
        let cleanContent = content.trim()
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        }
        cleanContent = cleanContent.replace(/^\s+|\s+$/g, '')

        suggestion = JSON.parse(cleanContent)
      } catch (parseError) {
        console.error('[AI Marketplace Suggest] Parse error:', parseError)

        // Try regex extraction
        const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/)
        const descriptionMatch = content.match(/"description"\s*:\s*"([^"]+)"/)

        if (titleMatch && descriptionMatch) {
          suggestion = {
            title: titleMatch[1],
            description: descriptionMatch[1]
          }
        } else {
          const fallback = fallbackSuggestion(productName.trim(), category)
          return NextResponse.json({
            success: true,
            data: { ...fallback, source: 'fallback-parse' }
          })
        }
      }

      // Validate and truncate if needed
      if (suggestion.title && suggestion.title.length > 100) {
        suggestion.title = suggestion.title.substring(0, 97) + '...'
      }
      if (suggestion.description && suggestion.description.length > 500) {
        suggestion.description = suggestion.description.substring(0, 497) + '...'
      }

      console.log('[AI Marketplace Suggest] Final suggestion:', suggestion)

      return NextResponse.json({
        success: true,
        data: {
          title: suggestion.title || productName,
          description: suggestion.description,
          source: 'ai'
        }
      })

    } catch (apiError) {
      console.error('[AI Marketplace Suggest] API call error:', apiError)
      const fallback = fallbackSuggestion(productName.trim(), category)
      return NextResponse.json({
        success: true,
        data: { ...fallback, source: 'fallback-error' }
      })
    }

  } catch (error) {
    console.error('[AI Marketplace Suggest] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
