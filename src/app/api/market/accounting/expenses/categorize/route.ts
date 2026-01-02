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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'

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
    const { description, amount, vendorName } = body

    if (!description) {
      return NextResponse.json({
        success: false,
        error: 'Descripción del gasto requerida'
      }, { status: 400 })
    }

    // Check if Gemini is configured
    if (!GOOGLE_AI_API_KEY) {
      console.log('[Categorize API] Gemini not configured, returning default')
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
        { name: 'Alquiler', code: 'RENT', type: 'opex', desc: 'Gastos de alquiler del local' },
        { name: 'Servicios', code: 'UTIL', type: 'opex', desc: 'Electricidad, agua, internet, telefono' },
        { name: 'Salarios', code: 'SAL', type: 'opex', desc: 'Pago de nominas y salarios' },
        { name: 'Inventario', code: 'INV', type: 'cogs', desc: 'Compra de mercancia para venta' },
        { name: 'Transporte', code: 'TRANS', type: 'opex', desc: 'Gastos de transporte y combustible' },
        { name: 'Marketing', code: 'MKT', type: 'opex', desc: 'Publicidad y promocion' },
        { name: 'Mantenimiento', code: 'MAINT', type: 'opex', desc: 'Reparaciones y mantenimiento' },
        { name: 'Impuestos', code: 'TAX', type: 'opex', desc: 'Pagos de impuestos' },
        { name: 'Equipamiento', code: 'EQUIP', type: 'capex', desc: 'Compra de equipos y mobiliario' },
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

    // Build category list for prompt
    const categoryList = categories.map(c =>
      `- ${c.name} (${c.code || 'N/A'}): ${c.description || c.accounting_type}`
    ).join('\n')

    // Build prompt for Gemini
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

      // Find category ID
      const suggestedCategory = categories.find(
        c => c.name.toLowerCase() === suggestion.suggestedCategoryName?.toLowerCase()
      )

      console.log('[Categorize API] Gemini suggestion:', suggestion.suggestedCategoryName, 'confidence:', suggestion.confidence)

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

      // Return without AI suggestion
      return NextResponse.json({
        success: true,
        data: {
          suggestedCategory: null,
          confidence: 0,
          reasoning: 'Error al consultar IA'
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
