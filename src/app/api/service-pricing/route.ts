import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Service definitions with labels
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
 * GET /api/service-pricing
 * Returns all platform-level service pricing (global defaults)
 * Only SUPER_ADMIN can access
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    // Only SUPER_ADMIN can view platform pricing
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo SUPER_ADMIN puede ver precios de plataforma.'
      }, { status: 403 })
    }

    // Get all global pricing (where provider_company_id is NULL)
    const result = await db.query(`
      SELECT
        sp.id,
        sp.service_id,
        sp.provider_cost,
        sp.platform_price,
        sp.provider_company_id,
        sp.pricing_model,
        sp.unit_type,
        sp.is_active,
        sp.created_at,
        sp.updated_at,
        c.legalname as provider_company_name
      FROM service_pricing sp
      LEFT JOIN companies c ON sp.provider_company_id = c.id
      ORDER BY sp.service_id
    `)

    // Enhance with labels and calculate margins
    const pricing = result.rows.map(row => ({
      id: row.id,
      serviceId: row.service_id,
      serviceLabel: SERVICE_DEFINITIONS[row.service_id]?.label || row.service_id,
      category: SERVICE_DEFINITIONS[row.service_id]?.category || 'other',
      providerCost: parseFloat(row.provider_cost) || 0,
      platformPrice: parseFloat(row.platform_price) || 0,
      margin: (parseFloat(row.platform_price) || 0) - (parseFloat(row.provider_cost) || 0),
      marginPercentage: row.provider_cost > 0
        ? ((parseFloat(row.platform_price) - parseFloat(row.provider_cost)) / parseFloat(row.provider_cost) * 100).toFixed(2)
        : '0.00',
      providerCompanyId: row.provider_company_id,
      providerCompanyName: row.provider_company_name,
      pricingModel: row.pricing_model,
      unitType: row.unit_type,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    // Separate global vs provider-specific pricing
    const globalPricing = pricing.filter(p => !p.providerCompanyId)
    const providerPricing = pricing.filter(p => p.providerCompanyId)

    return NextResponse.json({
      success: true,
      data: {
        global: globalPricing,
        byProvider: providerPricing,
        serviceDefinitions: SERVICE_DEFINITIONS
      }
    })

  } catch (error) {
    console.error('[Service Pricing API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener precios'
    }, { status: 500 })
  }
}

/**
 * POST /api/service-pricing
 * Create or update platform pricing for a service
 * Only SUPER_ADMIN can modify
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userId = cookieStore.get('user-id')?.value
    const userName = cookieStore.get('user-name')?.value || 'Sistema'

    // Only SUPER_ADMIN can modify platform pricing
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo SUPER_ADMIN puede modificar precios de plataforma.'
      }, { status: 403 })
    }

    const body = await request.json()
    const {
      serviceId,
      providerCost,
      platformPrice,
      providerCompanyId = null,
      pricingModel = 'fixed',
      unitType = null,
      notes = null
    } = body

    // Validate required fields
    if (!serviceId) {
      return NextResponse.json({
        success: false,
        error: 'El ID del servicio es requerido'
      }, { status: 400 })
    }

    // Validate service exists in definitions
    if (!SERVICE_DEFINITIONS[serviceId]) {
      return NextResponse.json({
        success: false,
        error: `Servicio no valido: ${serviceId}`
      }, { status: 400 })
    }

    // Check if pricing already exists
    const existingQuery = await db.query(
      `SELECT id, provider_cost, platform_price
       FROM service_pricing
       WHERE service_id = $1 AND (provider_company_id = $2 OR (provider_company_id IS NULL AND $2 IS NULL))`,
      [serviceId, providerCompanyId]
    )

    let result
    let changeType: 'create' | 'update'
    let oldValues = { providerCost: null as number | null, platformPrice: null as number | null }

    if (existingQuery.rows.length > 0) {
      // Update existing
      const existing = existingQuery.rows[0]
      oldValues = {
        providerCost: parseFloat(existing.provider_cost),
        platformPrice: parseFloat(existing.platform_price)
      }
      changeType = 'update'

      result = await db.query(
        `UPDATE service_pricing
         SET provider_cost = $1,
             platform_price = $2,
             pricing_model = $3,
             unit_type = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [providerCost || 0, platformPrice || 0, pricingModel, unitType, existing.id]
      )
    } else {
      // Create new
      changeType = 'create'
      result = await db.query(
        `INSERT INTO service_pricing
         (service_id, provider_cost, platform_price, provider_company_id, pricing_model, unit_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [serviceId, providerCost || 0, platformPrice || 0, providerCompanyId, pricingModel, unitType]
      )
    }

    const updatedPricing = result.rows[0]

    // Log to history
    await db.query(
      `INSERT INTO service_pricing_history
       (service_pricing_id, change_type, service_id,
        old_provider_cost, old_platform_price,
        new_provider_cost, new_platform_price,
        changed_by_user_id, changed_by_user_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        updatedPricing.id,
        changeType,
        serviceId,
        oldValues.providerCost,
        oldValues.platformPrice,
        providerCost || 0,
        platformPrice || 0,
        userId ? parseInt(userId) : null,
        userName,
        notes
      ]
    )

    return NextResponse.json({
      success: true,
      data: {
        id: updatedPricing.id,
        serviceId: updatedPricing.service_id,
        providerCost: parseFloat(updatedPricing.provider_cost),
        platformPrice: parseFloat(updatedPricing.platform_price),
        pricingModel: updatedPricing.pricing_model,
        unitType: updatedPricing.unit_type,
        isActive: updatedPricing.is_active
      },
      message: changeType === 'create' ? 'Precio creado exitosamente' : 'Precio actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Service Pricing API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar precio'
    }, { status: 500 })
  }
}

/**
 * PUT /api/service-pricing
 * Bulk update multiple service prices at once
 * Only SUPER_ADMIN can modify
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userId = cookieStore.get('user-id')?.value
    const userName = cookieStore.get('user-name')?.value || 'Sistema'

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Solo SUPER_ADMIN puede modificar precios de plataforma.'
      }, { status: 403 })
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
        const { serviceId, providerCost, platformPrice, pricingModel = 'fixed', unitType = null } = price

        if (!serviceId) {
          errors.push({ serviceId, error: 'ID de servicio requerido' })
          continue
        }

        // Check existing
        const existingQuery = await db.query(
          `SELECT id, provider_cost, platform_price FROM service_pricing WHERE service_id = $1 AND provider_company_id IS NULL`,
          [serviceId]
        )

        let result
        let changeType: 'create' | 'update'
        let oldValues = { providerCost: null as number | null, platformPrice: null as number | null }

        if (existingQuery.rows.length > 0) {
          const existing = existingQuery.rows[0]
          oldValues = {
            providerCost: parseFloat(existing.provider_cost),
            platformPrice: parseFloat(existing.platform_price)
          }
          changeType = 'update'

          result = await db.query(
            `UPDATE service_pricing
             SET provider_cost = $1, platform_price = $2, pricing_model = $3, unit_type = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [providerCost || 0, platformPrice || 0, pricingModel, unitType, existing.id]
          )
        } else {
          changeType = 'create'
          result = await db.query(
            `INSERT INTO service_pricing (service_id, provider_cost, platform_price, pricing_model, unit_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [serviceId, providerCost || 0, platformPrice || 0, pricingModel, unitType]
          )
        }

        const updated = result.rows[0]

        // Log to history
        await db.query(
          `INSERT INTO service_pricing_history
           (service_pricing_id, change_type, service_id, old_provider_cost, old_platform_price, new_provider_cost, new_platform_price, changed_by_user_id, changed_by_user_name, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [updated.id, changeType, serviceId, oldValues.providerCost, oldValues.platformPrice, providerCost || 0, platformPrice || 0, userId ? parseInt(userId) : null, userName, notes]
        )

        results.push({
          serviceId,
          success: true,
          action: changeType
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
    console.error('[Service Pricing API] PUT Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar precios'
    }, { status: 500 })
  }
}
