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

    const campaignId = result.rows[0].id

    // Auto-generate standard campaign tasks
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS mi_campaign_tasks (
        id SERIAL PRIMARY KEY, campaign_id INTEGER NOT NULL, title VARCHAR(255) NOT NULL,
        description TEXT, assigned_to VARCHAR(100) DEFAULT 'team', status VARCHAR(20) DEFAULT 'pending',
        sort_order INTEGER DEFAULT 0, completed_at TIMESTAMP, completed_by INTEGER, created_at TIMESTAMP DEFAULT NOW())`)

      const defaultTasks = [
        { title: 'Grabar video promocional', description: 'Ver script de video en tab Scripts', assigned: 'team', order: 1 },
        { title: 'Diseñar imagen para Facebook', description: 'Formato 940x788 con branding Servisumic', assigned: 'team', order: 2 },
        { title: 'Diseñar imagen para Instagram', description: 'Formato 1080x1350 con branding Servisumic', assigned: 'team', order: 3 },
        { title: 'Preparar stories', description: 'Stories verticales para Instagram y WhatsApp', assigned: 'team', order: 4 },
        { title: 'Revisar y aprobar textos', description: 'Verificar copys de todas las plataformas', assigned: 'team', order: 5 },
        { title: 'Subir materiales al sistema', description: 'Videos, imágenes y documentos en tab Materiales', assigned: 'team', order: 6 },
        { title: 'Publicar en canales asignados', description: 'Los agentes publicarán automáticamente', assigned: 'openclaw', order: 7 },
      ]

      for (const task of defaultTasks) {
        await db.query(`
          INSERT INTO mi_campaign_tasks (campaign_id, title, description, assigned_to, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [campaignId, task.title, task.description, task.assigned, task.order])
      }
    } catch (taskErr) {
      console.log('[MI Campaigns] Auto-task generation skipped:', taskErr instanceof Error ? taskErr.message : taskErr)
    }

    return NextResponse.json({
      success: true,
      data: { id: campaignId, name, type, tasksGenerated: 7 },
      message: 'Campaña creada con scripts de venta y 7 tareas automáticas'
    })
  } catch (error) {
    console.error('[MI External Campaigns] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear campaña' }, { status: 500 })
  }
}
