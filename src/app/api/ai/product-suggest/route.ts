import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini Configuration - Optimizado para descripciones de productos
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.0-flash'

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
  'Químicos',
  'Materias Primas',
  'Insumos Industriales',
  'Ferretería',
  'Pinturas y Recubrimientos',
  'Envases y Embalajes',
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
    'Carnes y Embutidos': ['carne', 'pollo', 'cerdo', 'res', 'jamón', 'jamon', 'salchicha', 'chorizo', 'bacon', 'tocino', 'mortadela', 'pechuga', 'muslo', 'chuleta', 'bistec', 'pescado', 'embutido', 'salmon', 'salmón', 'trucha', 'tilapia', 'camarón', 'camaron', 'langosta', 'mariscos', 'atún', 'atun', 'sardina', 'filete', 'lomo', 'costilla', 'picadillo', 'croqueta', 'bandeja'],
    'Lácteos': ['leche', 'queso', 'yogurt', 'yogur', 'mantequilla', 'crema', 'helado', 'natilla', 'flan', 'evaporada', 'condensada'],
    'Alimentos': ['arroz', 'pasta', 'frijol', 'frijoles', 'harina', 'azúcar', 'azucar', 'aceite', 'sopa', 'cereales', 'galleta', 'galleticas', 'chocolate', 'caramelo', 'dulce', 'conserva', 'mayonesa', 'ketchup', 'mostaza', 'salsa', 'espagueti', 'macarrones', 'premium', 'grano', 'sal', 'pimienta', 'condimento', 'sazon', 'sazón', 'comino', 'oregano', 'orégano'],
    'Bebidas': ['agua', 'refresco', 'jugo', 'cerveza', 'vino', 'whisky', 'vodka', 'pepsi', 'fanta', 'sprite', 'malta', 'café', 'cafe', 'limonada', 'naranjada', 'coca', 'gaseosa', 'bebida'],
    'Frutas y Verduras': ['manzana', 'naranja', 'plátano', 'platano', 'banana', 'piña', 'pina', 'mango', 'papaya', 'guayaba', 'fruta', 'tomate', 'cebolla', 'ajo', 'lechuga', 'zanahoria', 'papa', 'yuca', 'boniato', 'calabaza', 'pepino', 'pimiento', 'verdura', 'vegetal', 'aguacate'],
    'Panadería': ['pan', 'panetela', 'cake', 'torta', 'pastel', 'bizcocho', 'rosquita', 'tostada', 'croissant', 'panaderia'],
    'Higiene Personal': ['champú', 'champu', 'shampoo', 'acondicionador', 'dental', 'desodorante', 'perfume', 'colonia', 'pañal', 'panal', 'sanitaria', 'higienico', 'higiénico', 'cepillo', 'rasuradora', 'afeitadora', 'crema'],
    'Ropa': ['camisa', 'pantalón', 'pantalon', 'vestido', 'falda', 'blusa', 'camiseta', 't-shirt', 'tshirt', 'zapato', 'tenis', 'sandalia', 'medias', 'calcetín', 'calcetin', 'interior', 'short', 'jean', 'jeans', 'polo', 'nike', 'adidas', 'puma'],
    'Hogar': ['sábana', 'sabana', 'almohada', 'toalla', 'cortina', 'alfombra', 'lámpara', 'lampara', 'vela', 'florero', 'cuadro', 'espejo', 'colchón', 'colchon', 'silla', 'mesa', 'mueble'],
    'Químicos': ['dioxido', 'dióxido', 'titanio', 'titanium', 'acido', 'ácido', 'sulfato', 'carbonato', 'cloruro', 'hidróxido', 'hidroxido', 'soda', 'caustica', 'caústica', 'solvente', 'reactivo', 'químico', 'quimico', 'formaldehido', 'formaldehído', 'peróxido', 'peroxido', 'glicerina', 'metanol', 'etanol', 'acetona', 'amoníaco', 'amoniaco', 'silicato', 'fosfato', 'nitrato', 'benzoato', 'sorbitol', 'propilenglicol', 'resina', 'polímero', 'polimero', 'catalizador', 'emulsificante', 'surfactante', 'tensoactivo', 'alcali', 'álcali'],
    'Materias Primas': ['materia', 'prima', 'pigmento', 'colorante', 'aditivo', 'espesante', 'estabilizante', 'conservante', 'almidón', 'almidon', 'celulosa', 'gelatina', 'cera', 'parafina', 'talco', 'caolín', 'caolin', 'bentonita', 'calcita', 'feldespato', 'cuarzo', 'mica', 'yeso', 'cal', 'mineral', 'extracto', 'esencia', 'fragancia'],
    'Insumos Industriales': ['industrial', 'insumo', 'lubricante', 'grasa', 'sellador', 'adhesivo', 'pegamento', 'soldadura', 'abrasivo', 'lija', 'filtro', 'manguera', 'válvula', 'valvula', 'bomba', 'compresor', 'motor', 'rodamiento', 'correa', 'empaque', 'junta', 'tornillo', 'tuerca', 'arandela', 'remache'],
    'Ferretería': ['ferretería', 'ferreteria', 'herramienta', 'martillo', 'destornillador', 'alicate', 'llave', 'taladro', 'sierra', 'broca', 'clavo', 'cemento', 'arena', 'grava', 'bloque', 'varilla', 'alambre', 'cable', 'tubo', 'tubería', 'tuberia', 'pintura', 'brocha', 'rodillo'],
    'Pinturas y Recubrimientos': ['pintura', 'esmalte', 'barniz', 'laca', 'imprimante', 'primer', 'recubrimiento', 'anticorrosivo', 'epóxico', 'epoxico', 'poliuretano', 'acrílico', 'acrilico', 'vinílica', 'vinilica', 'thinner', 'diluyente', 'disolvente'],
    'Envases y Embalajes': ['envase', 'botella', 'frasco', 'tarro', 'lata', 'bidón', 'bidon', 'tambor', 'tanque', 'contenedor', 'bolsa', 'saco', 'caja', 'cartón', 'carton', 'embalaje', 'empaque', 'etiqueta', 'tapa', 'cierre']
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
          'Alimentos': 'Producto alimenticio de primera calidad, ideal para tu despensa. Seleccionado cuidadosamente para garantizar frescura y sabor en cada preparación.',
          'Bebidas': 'Bebida refrescante perfecta para cualquier ocasión. Disfruta de su sabor único y calidad premium que satisface tu sed.',
          'Carnes y Embutidos': 'Producto cárnico fresco de excelente calidad. Seleccionado y procesado bajo estrictos estándares de higiene para tu mesa.',
          'Lácteos': 'Producto lácteo nutritivo y delicioso. Fuente natural de calcio y proteínas, perfecto para una alimentación balanceada.',
          'Frutas y Verduras': 'Producto fresco y natural, cultivado con los mejores estándares de calidad. Rico en vitaminas y nutrientes esenciales.',
          'Panadería': 'Producto de panadería elaborado con ingredientes selectos. Textura y sabor artesanal que deleitará tu paladar.',
          'Limpieza': 'Producto de limpieza eficaz para mantener tu hogar impecable. Fórmula poderosa que elimina suciedad y gérmenes.',
          'Higiene Personal': 'Producto de higiene personal de alta calidad. Cuida tu piel y bienestar con ingredientes suaves y efectivos.',
          'Electrodomésticos': 'Electrodoméstico de alta calidad y tecnología avanzada. Diseñado para facilitar tu vida diaria con máximo rendimiento.',
          'Electrónica': 'Dispositivo electrónico con tecnología de punta. Rendimiento superior y durabilidad garantizada para tu satisfacción.',
          'Ropa': 'Prenda de vestir cómoda y moderna. Confeccionada con materiales de calidad para un estilo único y duradero.',
          'Hogar': 'Artículo para el hogar funcional y elegante. Diseñado para complementar tus espacios con estilo y practicidad.',
          'Químicos': 'Producto químico de grado industrial con alta pureza y rendimiento. Cumple con estándares de calidad para uso en procesos industriales y formulaciones.',
          'Materias Primas': 'Materia prima de calidad superior para la industria. Seleccionada por su pureza y consistencia para garantizar resultados óptimos en la producción.',
          'Insumos Industriales': 'Insumo industrial de alto rendimiento y durabilidad. Diseñado para optimizar procesos productivos con máxima eficiencia y seguridad.',
          'Ferretería': 'Producto de ferretería resistente y confiable. Fabricado con materiales de primera para garantizar durabilidad en cada proyecto.',
          'Pinturas y Recubrimientos': 'Producto de recubrimiento de alta calidad con excelente cobertura y acabado. Formulado para ofrecer protección duradera y resultados profesionales.',
          'Envases y Embalajes': 'Envase resistente y funcional para almacenamiento y transporte seguro. Diseñado para proteger el contenido y facilitar su manejo.'
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
          'Hogar': 'unidad',
          'Químicos': 'kg',
          'Materias Primas': 'kg',
          'Insumos Industriales': 'unidad',
          'Ferretería': 'unidad',
          'Pinturas y Recubrimientos': 'galón',
          'Envases y Embalajes': 'unidad'
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

      const prompt = `Eres un experto en productos de tienda/mercado. Analiza este producto y genera su ficha para una tienda en línea.

PRODUCTO: "${productName.trim()}"

INSTRUCCIONES:
1. CATEGORÍA - Elige UNA de estas exactamente: ${CATEGORIES.join(', ')}
2. DESCRIPCIÓN - Escribe una descripción COMERCIAL para página web (mínimo 120 caracteres, máximo 250). Debe:
   - Destacar cualidades y beneficios del producto
   - Ser atractiva para el comprador
   - Mencionar características relevantes (frescura, calidad, uso, etc.)
   - NO incluir precios ni ofertas
3. UNIDAD - Elige la más apropiada: unidad, lb, kg, g, litro, ml, paquete, caja, docena, par, metro, galón

EJEMPLOS DE BUENAS DESCRIPCIONES:
- "Salmón fresco en bandeja" → "Salmón fresco de primera calidad, rico en Omega-3 y proteínas. Ideal para preparaciones saludables como al horno, a la plancha o en sushi. Presentación en bandeja lista para cocinar."
- "Arroz Premium" → "Arroz de grano largo premium, seleccionado para garantizar textura suelta y sabor excepcional. Perfecto para acompañar tus platos favoritos o como base de recetas tradicionales."

Responde ÚNICAMENTE con JSON válido (sin explicaciones adicionales):
{"category": "Categoría", "description": "Descripción comercial completa...", "unitOfMeasure": "unidad"}`

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5, // Un poco más creativo para mejores descripciones
          maxOutputTokens: 1000, // Aumentado para descripciones más completas
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

      // Ensure description is adequate length
      if (!suggestion.description || suggestion.description.length < 80) {
        // Use fallback description if AI gave a short one
        const fallback = fallbackCategorization(productName.trim())
        suggestion.description = fallback.description
        console.log('[AI Suggest] Description too short, using fallback')
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
