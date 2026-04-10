import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/campaigns
 * Create a fully structured marketing campaign with sales scripts.
 * Body: {
 *   name, description, type, startDate?, endDate?,
 *   targetProducts: [{ productId, productName, originalPrice, campaignPrice }],
 *   targetCategories: string[],
 *   discountType: 'percentage' | 'fixed' | 'price_match',
 *   discountValue: number,
 *   budget?: number,
 *   salesScripts: {
 *     elevator: string,           -- 30-second pitch
 *     social: {                   -- Social media content
 *       facebook: string,
 *       instagram: string,
 *       whatsapp: string
 *     },
 *     video: {                    -- Video script structure
 *       hook: string,             -- First 3 seconds (attention grabber)
 *       problem: string,          -- What problem does this solve?
 *       solution: string,         -- Our product/offer as the solution
 *       proof: string,            -- Social proof, testimonials, data
 *       offer: string,            -- The specific deal/discount
 *       cta: string,              -- Call to action
 *       duration: string          -- Suggested video length
 *     },
 *     objections: Array<{ objection: string, response: string }>,
 *     keyMessages: string[],
 *     hashtags: string[],
 *     targetAudience: string
 *   },
 *   suggestionReason?: string
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    // Ensure sales_scripts column exists
    try {
      await db.query('ALTER TABLE mi_campaigns ADD COLUMN IF NOT EXISTS sales_scripts JSONB DEFAULT \'{}\'')
    } catch { /* ignore */ }

    const body = await request.json()
    const {
      name, description, type, startDate, endDate,
      targetProducts, targetCategories, discountType, discountValue,
      budget, salesScripts, suggestionReason
    } = body

    if (!name || !type) {
      return NextResponse.json({ success: false, error: 'name y type requeridos' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO mi_campaigns (
        company_id, name, description, type, status, start_date, end_date,
        target_products, target_categories, discount_type, discount_value,
        budget, sales_scripts, suggested_by, suggestion_reason
      ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      auth.companyId,
      name,
      description || null,
      type,
      startDate || null,
      endDate || null,
      JSON.stringify(targetProducts || []),
      JSON.stringify(targetCategories || []),
      discountType || null,
      discountValue || null,
      budget || null,
      JSON.stringify(salesScripts || {}),
      auth.agentType || 'openclaw',
      suggestionReason || null
    ])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id, name, type },
      message: 'Campaña creada con scripts de venta'
    })
  } catch (error) {
    console.error('[MI External Campaigns] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear campaña' }, { status: 500 })
  }
}
