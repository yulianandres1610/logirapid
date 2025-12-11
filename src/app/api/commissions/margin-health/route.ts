import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/commissions/margin-health
 * Calculate margin health for all products, comparing gross margin vs total configured commissions
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId, isSuperAdmin } = getCompanyFilter(request)

    if (!companyId && !isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Get all products with their pricing
    const productsQuery = `
      SELECT
        pc.id,
        pc.code,
        pc.name,
        pc.service_category,
        pc.mi_costo,
        pc.precio_mayorista,
        pc.precio_publico,
        pc.is_composite,
        pc.has_box_tracking,
        pc.is_active,
        cpp.mi_costo as company_mi_costo,
        cpp.precio_venta as company_precio_venta,
        cpp.margen as company_margen
      FROM product_catalog pc
      LEFT JOIN company_product_pricing cpp ON pc.id = cpp.product_id
        ${!isSuperAdmin && companyId ? 'AND cpp.company_id = $1' : ''}
      WHERE pc.is_active = true
      ORDER BY pc.service_category, pc.name
    `

    const productsResult = await db.query(
      productsQuery,
      !isSuperAdmin && companyId ? [companyId] : []
    )

    // For each product, get configured commissions
    const marginHealthData = await Promise.all(
      productsResult.rows.map(async (product) => {
        // Get effective pricing
        const miCosto = product.company_mi_costo
          ? parseFloat(product.company_mi_costo)
          : parseFloat(product.mi_costo) || 0

        const precioVenta = product.company_precio_venta
          ? parseFloat(product.company_precio_venta)
          : parseFloat(product.precio_publico) || 0

        // Calculate gross margin
        const margenBruto = precioVenta - miCosto

        // Get all commission configs for this product
        let commissionsQuery = `
          SELECT
            ccc.activity_type,
            ccc.role,
            ccc.commission_type,
            ccc.commission_value,
            ccc.product_service_id,
            ps.service_name
          FROM company_commission_config ccc
          LEFT JOIN product_services ps ON ccc.product_service_id = ps.id
          WHERE ccc.product_id = $1
            AND ccc.is_active = true
        `
        const commissionParams: any[] = [product.id]

        if (!isSuperAdmin && companyId) {
          commissionsQuery += ' AND ccc.company_id = $2'
          commissionParams.push(companyId)
        }

        const commissionsResult = await db.query(commissionsQuery, commissionParams)

        // Calculate total commissions for a single sale
        // Group by activity type to avoid duplicates (same activity, different roles)
        const activityCommissions = new Map<string, number>()

        for (const config of commissionsResult.rows) {
          const activityKey = config.activity_type + (config.product_service_id || '')
          let commissionAmount = 0

          if (config.commission_type === 'fixed') {
            commissionAmount = parseFloat(config.commission_value) || 0
          } else if (config.commission_type === 'percentage') {
            commissionAmount = (precioVenta * (parseFloat(config.commission_value) || 0)) / 100
          }

          // Take the max commission for each activity type (worst case scenario)
          const currentMax = activityCommissions.get(activityKey) || 0
          if (commissionAmount > currentMax) {
            activityCommissions.set(activityKey, commissionAmount)
          }
        }

        // Sum all activity commissions
        let totalComisiones = 0
        activityCommissions.forEach(amount => {
          totalComisiones += amount
        })

        // Calculate net margin
        const margenNeto = margenBruto - totalComisiones

        // Calculate margin percentage
        const margenPorcentaje = precioVenta > 0 ? (margenNeto / precioVenta) * 100 : 0

        // Determine health status
        let status: 'healthy' | 'warning' | 'critical'
        if (margenNeto <= 0) {
          status = 'critical'
        } else if (margenPorcentaje < 10) {
          status = 'warning'
        } else {
          status = 'healthy'
        }

        // Get configured commissions for display
        const configuredCommissions = commissionsResult.rows.map(row => ({
          activityType: row.activity_type,
          role: row.role,
          value: parseFloat(row.commission_value) || 0,
          type: row.commission_type,
          serviceName: row.service_name || null
        }))

        return {
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          category: product.service_category,
          isComposite: product.is_composite,
          hasBoxTracking: product.has_box_tracking,
          miCosto,
          precioVenta,
          margenBruto,
          totalComisiones,
          margenNeto,
          margenPorcentaje,
          status,
          configuredCommissions
        }
      })
    )

    // Summary stats
    const summary = {
      total: marginHealthData.length,
      healthy: marginHealthData.filter(m => m.status === 'healthy').length,
      warning: marginHealthData.filter(m => m.status === 'warning').length,
      critical: marginHealthData.filter(m => m.status === 'critical').length,
      avgMarginPercentage: marginHealthData.length > 0
        ? marginHealthData.reduce((sum, m) => sum + m.margenPorcentaje, 0) / marginHealthData.length
        : 0
    }

    return NextResponse.json({
      success: true,
      data: marginHealthData,
      summary
    })

  } catch (error) {
    console.error('Error fetching margin health:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al calcular salud del margen',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
