import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

/**
 * POST /api/market/accounting/expenses/categorize
 * Use Gemini AI to suggest category for an expense
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    const body = await request.json()
    const { description, amount, vendorName, items } = body

    // Validar que venga description o items
    if (!description && (!items || !Array.isArray(items) || items.length === 0)) {
      return NextResponse.json({
        success: false,
        error: 'Descripción del gasto o lista de items requerida'
      }, { status: 400 })
    }

    // Si viene un array de items, procesarlos en lote
    const isMultipleItems = items && Array.isArray(items) && items.length > 0

    // Check if Gemini is configured
    if (!GOOGLE_AI_API_KEY) {
      console.log('[Categorize API] Gemini not configured, returning default')
      if (isMultipleItems) {
        return NextResponse.json({
          success: true,
          data: {
            categorizedItems: items.map((item: { id?: string; description?: string; amount?: number; suggestedCategory?: string }) => ({
              ...item,
              categoryId: null,
              categoryName: item.suggestedCategory || 'Otros',
              confidence: 0.5
            }))
          }
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          suggestedCategory: null,
          confidence: 0,
          reasoning: 'IA no configurada'
        }
      })
    }

    // Get company's expense categories
    let categoriesResult = await db.query(`
      SELECT id, name, code, description, accounting_type
      FROM market_expense_categories
      WHERE company_id = $1 AND is_active = true
      ORDER BY name
    `, [companyId])

    // Si no hay categorías, crear las predeterminadas
    if (categoriesResult.rows.length === 0) {
      console.log('[Categorize API] No categories found, creating defaults for company:', companyId)

      const defaultCategories = [
        { name: 'Arrendamiento', code: 'RENT', type: 'opex', desc: 'Arrendamiento, alquiler de local, renta' },
        { name: 'Servicios', code: 'UTIL', type: 'opex', desc: 'Electricidad, agua, internet, telefono' },
        { name: 'Salarios', code: 'SAL', type: 'opex', desc: 'Pago de nominas y salarios' },
        { name: 'Inventario', code: 'INV', type: 'cogs', desc: 'Compra de mercancia para venta' },
        { name: 'Transporte', code: 'TRANS', type: 'opex', desc: 'Gastos de transporte y combustible' },
        { name: 'Marketing', code: 'MKT', type: 'opex', desc: 'Publicidad y promocion' },
        { name: 'Mantenimiento', code: 'MAINT', type: 'opex', desc: 'Reparaciones y mantenimiento' },
        { name: 'Impuestos', code: 'TAX', type: 'opex', desc: 'Pagos de impuestos' },
        { name: 'Equipamiento', code: 'EQUIP', type: 'capex', desc: 'Compra de equipos y mobiliario' },
        { name: 'Suministros', code: 'SUPPLY', type: 'opex', desc: 'Suministros de oficina, papeleria, articulos de escritorio' },
        { name: 'Otros', code: 'OTHER', type: 'opex', desc: 'Gastos varios no categorizados' }
      ]

      for (const cat of defaultCategories) {
        try {
          await db.query(`
            INSERT INTO market_expense_categories (company_id, name, code, accounting_type, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (company_id, name) DO NOTHING
          `, [companyId, cat.name, cat.code, cat.type, cat.desc])
        } catch (e) {
          console.error('[Categorize API] Error creating category:', cat.name, e)
        }
      }

      // Recargar categorías
      categoriesResult = await db.query(`
        SELECT id, name, code, description, accounting_type
        FROM market_expense_categories
        WHERE company_id = $1 AND is_active = true
        ORDER BY name
      `, [companyId])
    }

    const categories = categoriesResult.rows
    console.log('[Categorize API] Found categories:', categories.length)

    // Función helper para hacer matching de categoría por nombre
    const findCategoryByName = (suggestedName: string) => {
      if (!suggestedName) return categories.find(c => c.name === 'Otros' || c.code === 'OTHER')

      const searchTerm = suggestedName.toLowerCase()

      // Exact match
      let found = categories.find(c => c.name.toLowerCase() === searchTerm)
      if (found) return found

      // Partial match
      found = categories.find(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(c.name.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm))
      )
      if (found) return found

      // Term mappings
      const termMappings: Record<string, string> = {
        // Suministros de oficina / Office Supplies
        'suministros': 'Suministros', 'supplies': 'Suministros', 'oficina': 'Suministros',
        'office': 'Suministros', 'office supply': 'Suministros', 'office supplies': 'Suministros',
        'papeleria': 'Suministros', 'papel': 'Suministros', 'paper': 'Suministros',
        'boligrafo': 'Suministros', 'pen': 'Suministros', 'lapiz': 'Suministros', 'pencil': 'Suministros',
        'tinta': 'Suministros', 'ink': 'Suministros', 'toner': 'Suministros', 'cartucho': 'Suministros',
        'folder': 'Suministros', 'carpeta': 'Suministros', 'archivador': 'Suministros',
        'grapadora': 'Suministros', 'stapler': 'Suministros', 'grapas': 'Suministros', 'staples': 'Suministros',
        'clips': 'Suministros', 'cinta': 'Suministros', 'tape': 'Suministros',
        'sobre': 'Suministros', 'envelope': 'Suministros', 'etiqueta': 'Suministros', 'label': 'Suministros',
        'notas': 'Suministros', 'post-it': 'Suministros', 'sticky': 'Suministros',
        'cuaderno': 'Suministros', 'notebook': 'Suministros', 'libreta': 'Suministros',
        'escritorio': 'Suministros', 'desk': 'Suministros',
        // Servicios
        'electricidad': 'Servicios', 'agua': 'Servicios', 'internet': 'Servicios',
        'telefono': 'Servicios', 'gas': 'Servicios', 'utilities': 'Servicios', 'luz': 'Servicios',
        // Mantenimiento
        'mantenimiento': 'Mantenimiento', 'limpieza': 'Mantenimiento', 'reparacion': 'Mantenimiento',
        // Transporte
        'transporte': 'Transporte', 'gasolina': 'Transporte', 'combustible': 'Transporte', 'envio': 'Transporte',
        // Inventario
        'inventario': 'Inventario', 'mercancia': 'Inventario',
        // Alimentos
        'alimentos': 'Alimentos', 'comida': 'Alimentos', 'snacks': 'Alimentos', 'bebidas': 'Alimentos',
        // Marketing
        'marketing': 'Marketing', 'publicidad': 'Marketing',
        // Equipamiento
        'equipamiento': 'Equipamiento', 'equipo': 'Equipamiento', 'muebles': 'Equipamiento',
        // Salarios
        'salarios': 'Salarios', 'nomina': 'Salarios', 'sueldo': 'Salarios',
        // Impuestos
        'impuestos': 'Impuestos', 'tax': 'Impuestos',
        // Alquiler
        'alquiler': 'Arrendamiento', 'renta': 'Arrendamiento', 'arriendo': 'Arrendamiento',
        'arrendamiento': 'Arrendamiento', 'arrendacion': 'Arrendamiento', 'local': 'Arrendamiento'
      }

      for (const [term, categoryName] of Object.entries(termMappings)) {
        if (searchTerm.includes(term)) {
          const mapped = categories.find(c => c.name === categoryName)
          if (mapped) return mapped
        }
      }

      return categories.find(c => c.name === 'Otros' || c.code === 'OTHER')
    }

    // Si es procesamiento de múltiples items, hacer matching directo sin IA
    if (isMultipleItems) {
      console.log('[Categorize API] Processing multiple items:', items.length)

      const categorizedItems = items.map((item: { id?: string; description?: string; amount?: number; suggestedCategory?: string }) => {
        const category = findCategoryByName(item.suggestedCategory || item.description || '')
        return {
          ...item,
          categoryId: category?.id || null,
          categoryName: category?.name || 'Otros',
          confidence: category ? 0.85 : 0.5
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          categorizedItems
        }
      })
    }

    // Build category list for prompt
    const categoryList = categories.map(c =>
      `- ${c.name} (${c.code || 'N/A'}): ${c.description || c.accounting_type}`
    ).join('\n')

    // Build prompt for Gemini (solo para categorización individual)
    const prompt = `Eres un asistente de contabilidad. Analiza el siguiente gasto y sugiere la categoría más apropiada.

GASTO A CATEGORIZAR:
- Descripción: ${description}
- Monto: ${amount ? `$${amount}` : 'No especificado'}
- Proveedor/Vendedor: ${vendorName || 'No especificado'}

CATEGORÍAS DISPONIBLES:
${categoryList}

INSTRUCCIONES:
1. Analiza la descripción del gasto
2. Identifica palabras clave que indiquen el tipo de gasto
3. Selecciona la categoría más apropiada de la lista
4. Si no hay una categoría clara, sugiere "Otros"
5. Proporciona un nivel de confianza del 0 al 1

Responde ÚNICAMENTE en formato JSON:
{
  "suggestedCategoryName": "nombre exacto de la categoría",
  "confidence": 0.85,
  "reasoning": "breve explicación de por qué esta categoría"
}`

    try {
      const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

      const result = await model.generateContent(prompt)
      const responseText = result.response.text()

      // Parse JSON response
      let suggestion
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          suggestion = JSON.parse(jsonMatch[0])
        }
      } catch {
        console.log('[Categorize API] Failed to parse Gemini response:', responseText)
        suggestion = { suggestedCategoryName: 'Otros', confidence: 0.5, reasoning: 'No se pudo analizar' }
      }

      // Find category ID - first try exact match
      let suggestedCategory = categories.find(
        c => c.name.toLowerCase() === suggestion.suggestedCategoryName?.toLowerCase()
      )

      // If no exact match, try partial match
      if (!suggestedCategory && suggestion.suggestedCategoryName) {
        const searchTerm = suggestion.suggestedCategoryName.toLowerCase()
        suggestedCategory = categories.find(c =>
          c.name.toLowerCase().includes(searchTerm) ||
          searchTerm.includes(c.name.toLowerCase()) ||
          (c.description && c.description.toLowerCase().includes(searchTerm))
        )
      }

      // Map common terms to categories
      if (!suggestedCategory && suggestion.suggestedCategoryName) {
        const termMappings: Record<string, string> = {
          // Suministros de oficina / Office Supplies
          'suministros': 'Suministros',
          'supplies': 'Suministros',
          'office': 'Suministros',
          'oficina': 'Suministros',
          'papeleria': 'Suministros',
          'papel': 'Suministros',
          'paper': 'Suministros',
          'boligrafo': 'Suministros',
          'pen': 'Suministros',
          'lapiz': 'Suministros',
          'tinta': 'Suministros',
          'ink': 'Suministros',
          'toner': 'Suministros',
          'cartucho': 'Suministros',
          'folder': 'Suministros',
          'carpeta': 'Suministros',
          'grapadora': 'Suministros',
          'stapler': 'Suministros',
          'clips': 'Suministros',
          'cinta': 'Suministros',
          'tape': 'Suministros',
          'sobre': 'Suministros',
          'envelope': 'Suministros',
          'etiqueta': 'Suministros',
          'label': 'Suministros',
          'cuaderno': 'Suministros',
          'notebook': 'Suministros',
          // Servicios
          'electricidad': 'Servicios',
          'electricity': 'Servicios',
          'agua': 'Servicios',
          'water': 'Servicios',
          'internet': 'Servicios',
          'telefono': 'Servicios',
          'phone': 'Servicios',
          'gas': 'Servicios',
          'utilities': 'Servicios',
          'luz': 'Servicios',
          // Alquiler
          'renta': 'Arrendamiento',
          'rent': 'Arrendamiento',
          'arriendo': 'Arrendamiento',
          'arrendamiento': 'Arrendamiento',
          'alquiler': 'Arrendamiento',
          // Salarios
          'nomina': 'Salarios',
          'payroll': 'Salarios',
          'sueldo': 'Salarios',
          'salary': 'Salarios',
          // Inventario
          'mercancia': 'Inventario',
          'inventory': 'Inventario',
          // Transporte
          'gasolina': 'Transporte',
          'fuel': 'Transporte',
          'combustible': 'Transporte',
          // Marketing
          'publicidad': 'Marketing',
          'advertising': 'Marketing',
          // Mantenimiento
          'reparacion': 'Mantenimiento',
          'repair': 'Mantenimiento',
          // Impuestos
          'impuesto': 'Impuestos',
          'tax': 'Impuestos',
          // Equipamiento
          'equipo': 'Equipamiento',
          'equipment': 'Equipamiento',
          'mueble': 'Equipamiento',
          'furniture': 'Equipamiento'
        }

        const searchTerm = suggestion.suggestedCategoryName.toLowerCase()
        for (const [term, categoryName] of Object.entries(termMappings)) {
          if (searchTerm.includes(term)) {
            suggestedCategory = categories.find(c => c.name === categoryName)
            if (suggestedCategory) break
          }
        }
      }

      // Fallback to "Otros" if still no match
      if (!suggestedCategory) {
        suggestedCategory = categories.find(c => c.name === 'Otros' || c.code === 'OTHER')
      }

      console.log('[Categorize API] Gemini suggestion:', suggestion.suggestedCategoryName, '-> Mapped to:', suggestedCategory?.name, 'confidence:', suggestion.confidence)

      return NextResponse.json({
        success: true,
        data: {
          suggestedCategory: suggestedCategory ? {
            id: suggestedCategory.id,
            name: suggestedCategory.name,
            code: suggestedCategory.code,
            accountingType: suggestedCategory.accounting_type
          } : null,
          suggestedCategoryName: suggestion.suggestedCategoryName,
          confidence: suggestion.confidence || 0,
          reasoning: suggestion.reasoning || '',
          aiAnalysis: responseText
        }
      })

    } catch (aiError) {
      console.error('[Categorize API] Gemini error:', aiError)

      // Fallback to "Otros" category
      const fallbackCategory = categories.find(c => c.name === 'Otros' || c.code === 'OTHER')

      return NextResponse.json({
        success: true,
        data: {
          suggestedCategory: fallbackCategory ? {
            id: fallbackCategory.id,
            name: fallbackCategory.name,
            code: fallbackCategory.code,
            accountingType: fallbackCategory.accounting_type
          } : null,
          confidence: 0.3,
          reasoning: 'Categoría por defecto (IA no disponible)'
        }
      })
    }

  } catch (error) {
    console.error('[Categorize API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al categorizar'
    }, { status: 500 })
  }
}
