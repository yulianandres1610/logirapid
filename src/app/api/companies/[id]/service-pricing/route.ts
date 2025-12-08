import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Service definitions
const SERVICE_DEFINITIONS: Record<string, { label: string; category: string }> = {
  'wallet': { label: 'Billetera Digital', category: 'main' },
  'recharge': { label: 'Recargas Moviles', category: 'main' },
  'remittance': { label: 'Cupones Familiares', category: 'main' },
  'tracker': { label: 'Seguimiento', category: 'main' },
  'exchange': { label: 'Cambio de Divisas', category: 'main' },
  'marketplace': { label: 'Marketplace', category: 'main' },
  'paqueteria:pickup-orders': { label: 'Ordenes de Recogida', category: 'paqueteria' },
  'paqueteria:office-orders': { label: 'Ordenes de Oficina', category: 'paqueteria' },
  'paqueteria:warehouses': { label: 'Almacenes', category: 'paqueteria' },
  'paqueteria:drivers': { label: 'Drivers', category: 'paqueteria' },
  'paqueteria:vehicles': { label: 'Vehiculos', category: 'paqueteria' },
  'paqueteria:routes': { label: 'Rutas', category: 'paqueteria' },
  'paqueteria:package-route': { label: 'Empaque', category: 'paqueteria' },
}

/**
 * GET /api/companies/[id]/service-pricing
 * Returns service pricing for a specific company
 * For branches: returns parent company pricing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userCompanyId = cookieStore.get('user-company-id')?.value

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Check authorization
    const isSuperAdmin = userRole === 'SUPER_ADMIN'
    const isOwnCompany = userCompanyId && parseInt(userCompanyId) === companyId

    if (!isSuperAdmin && !isOwnCompany) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver precios de esta empresa'
      }, { status: 403 })
    }

    // Get company info (check if branch)
    const companyResult = await db.query(
      `SELECT id, legalname, is_branch, parent_company_id, enabledservices, is_provider
       FROM companies WHERE id = $1`,
      [companyId]
    )

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    // For branches, use parent company's pricing
    const pricingCompanyId = company.is_branch && company.parent_company_id
      ? company.parent_company_id
      : companyId

    // Parse enabled services
    let enabledServices: string[] = []
    try {
      enabledServices = typeof company.enabledservices === 'string'
        ? JSON.parse(company.enabledservices)
        : company.enabledservices || []
    } catch (e) {
      enabledServices = []
    }

    // Get company pricing
    const pricingResult = await db.query(
      `SELECT
        csp.id,
        csp.service_id,
        csp.buy_price,
        csp.sell_price,
        csp.is_active,
        csp.created_at,
        csp.updated_at
       FROM company_service_pricing csp
       WHERE csp.company_id = $1`,
      [pricingCompanyId]
    )

    // Get platform pricing for reference
    const platformResult = await db.query(
      `SELECT service_id, platform_price, pricing_model, unit_type
       FROM service_pricing
       WHERE provider_company_id IS NULL`
    )

    // Create a map of platform prices
    const platformPrices: Record<string, { platformPrice: number; pricingModel: string; unitType: string | null }> = {}
    platformResult.rows.forEach(row => {
      platformPrices[row.service_id] = {
        platformPrice: parseFloat(row.platform_price) || 0,
        pricingModel: row.pricing_model,
        unitType: row.unit_type
      }
    })

    // Create a map of company prices
    const companyPrices: Record<string, { buyPrice: number; sellPrice: number; id: number }> = {}
    pricingResult.rows.forEach(row => {
      companyPrices[row.service_id] = {
        id: row.id,
        buyPrice: parseFloat(row.buy_price) || 0,
        sellPrice: parseFloat(row.sell_price) || 0
      }
    })

    // Build response for all enabled services
    const pricing = enabledServices.map(serviceId => {
      const platformPrice = platformPrices[serviceId]?.platformPrice || 0
      const companyPrice = companyPrices[serviceId]
      const buyPrice = companyPrice?.buyPrice || platformPrice
      const sellPrice = companyPrice?.sellPrice || buyPrice

      return {
        serviceId,
        serviceLabel: SERVICE_DEFINITIONS[serviceId]?.label || serviceId,
        category: SERVICE_DEFINITIONS[serviceId]?.category || 'other',
        platformPrice,
        pricingModel: platformPrices[serviceId]?.pricingModel || 'fixed',
        unitType: platformPrices[serviceId]?.unitType,
        buyPrice,
        sellPrice,
        margin: sellPrice - buyPrice,
        marginPercentage: buyPrice > 0
          ? ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2)
          : '0.00',
        hasCustomPricing: !!companyPrice,
        pricingId: companyPrice?.id
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        companyName: company.legalname,
        isBranch: company.is_branch,
        parentCompanyId: company.parent_company_id,
        pricingCompanyId,
        isProvider: company.is_provider,
        pricing,
        enabledServices
      }
    })

  } catch (error) {
    console.error('[Company Service Pricing API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener precios'
    }, { status: 500 })
  }
}

/**
 * POST /api/companies/[id]/service-pricing
 * Create or update company service pricing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userCompanyId = cookieStore.get('user-company-id')?.value
    const userId = cookieStore.get('user-id')?.value
    const userName = cookieStore.get('user-name')?.value || 'Sistema'

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Check authorization - only SUPER_ADMIN or ADMIN of this company can modify
    const isSuperAdmin = userRole === 'SUPER_ADMIN'
    const isCompanyAdmin = userRole === 'ADMIN' && userCompanyId && parseInt(userCompanyId) === companyId

    if (!isSuperAdmin && !isCompanyAdmin) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para modificar precios de esta empresa'
      }, { status: 403 })
    }

    // Check if company is a branch
    const companyResult = await db.query(
      `SELECT is_branch, parent_company_id FROM companies WHERE id = $1`,
      [companyId]
    )

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    if (companyResult.rows[0].is_branch) {
      return NextResponse.json({
        success: false,
        error: 'Las sucursales heredan precios de la empresa padre. Modifique los precios en la empresa principal.'
      }, { status: 400 })
    }

    const body = await request.json()
    const { prices, notes = null } = body

    if (!Array.isArray(prices)) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere un array de precios'
      }, { status: 400 })
    }

    const results = []
    const errors = []

    for (const price of prices) {
      try {
        const { serviceId, sellPrice } = price

        if (!serviceId) {
          errors.push({ serviceId, error: 'ID de servicio requerido' })
          continue
        }

        // Get platform price (buy price for this company)
        const platformResult = await db.query(
          `SELECT platform_price FROM service_pricing WHERE service_id = $1 AND provider_company_id IS NULL`,
          [serviceId]
        )
        const buyPrice = platformResult.rows[0]?.platform_price || 0

        // Validate margin (sell price >= buy price)
        if (sellPrice < buyPrice) {
          errors.push({
            serviceId,
            error: `El precio de venta ($${sellPrice}) no puede ser menor al precio de compra ($${buyPrice})`
          })
          continue
        }

        // Check existing
        const existingQuery = await db.query(
          `SELECT id, buy_price, sell_price FROM company_service_pricing WHERE company_id = $1 AND service_id = $2`,
          [companyId, serviceId]
        )

        let result
        let changeType: 'create' | 'update'
        let oldValues = { buyPrice: null as number | null, sellPrice: null as number | null }

        if (existingQuery.rows.length > 0) {
          const existing = existingQuery.rows[0]
          oldValues = {
            buyPrice: parseFloat(existing.buy_price),
            sellPrice: parseFloat(existing.sell_price)
          }
          changeType = 'update'

          result = await db.query(
            `UPDATE company_service_pricing
             SET buy_price = $1, sell_price = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [buyPrice, sellPrice, existing.id]
          )
        } else {
          changeType = 'create'
          result = await db.query(
            `INSERT INTO company_service_pricing (company_id, service_id, buy_price, sell_price)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [companyId, serviceId, buyPrice, sellPrice]
          )
        }

        const updated = result.rows[0]

        // Log to history
        await db.query(
          `INSERT INTO service_pricing_history
           (company_service_pricing_id, change_type, service_id, company_id,
            old_buy_price, old_sell_price, new_buy_price, new_sell_price,
            changed_by_user_id, changed_by_user_name, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            updated.id, changeType, serviceId, companyId,
            oldValues.buyPrice, oldValues.sellPrice, buyPrice, sellPrice,
            userId ? parseInt(userId) : null, userName, notes
          ]
        )

        results.push({
          serviceId,
          success: true,
          action: changeType,
          buyPrice: parseFloat(updated.buy_price),
          sellPrice: parseFloat(updated.sell_price)
        })
      } catch (err) {
        errors.push({
          serviceId: price.serviceId,
          error: err instanceof Error ? err.message : 'Error desconocido'
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      data: {
        updated: results,
        errors
      },
      message: `${results.length} precios actualizados, ${errors.length} errores`
    })

  } catch (error) {
    console.error('[Company Service Pricing API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar precios'
    }, { status: 500 })
  }
}
