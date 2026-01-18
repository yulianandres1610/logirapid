import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/whatsapp-recharge
 *
 * Endpoint de diagnóstico para verificar la configuración de recargas para WhatsApp
 * SOLO para desarrollo - eliminar en producción
 */
export async function GET() {
  try {
    const companyName = process.env.WHATSAPP_AGENT_COMPANY_NAME || 'NO CONFIGURADO'

    // 1. Buscar la empresa
    const companyResult = await db.query(
      `SELECT id, legalname FROM companies WHERE legalname ILIKE $1 LIMIT 1`,
      [`%${companyName}%`]
    )

    const company = companyResult.rows[0]

    if (!company) {
      // Listar todas las empresas para ayudar
      const allCompanies = await db.query(`SELECT id, legalname FROM companies ORDER BY id LIMIT 10`)

      return NextResponse.json({
        success: false,
        error: `Empresa "${companyName}" no encontrada`,
        config: {
          WHATSAPP_AGENT_COMPANY_NAME: companyName
        },
        availableCompanies: allCompanies.rows
      })
    }

    // 2. Verificar productos de recarga activos
    const productsResult = await db.query(`
      SELECT id, name, custom_name, manual_selling_price, is_active
      FROM external_recharge_products
      WHERE is_active = true
      ORDER BY name
    `)

    // 3. Verificar pricing configurado para esta empresa
    const pricingResult = await db.query(`
      SELECT
        rpp.id,
        rpp.external_product_id,
        rpp.selling_price,
        rpp.margin_type,
        rpp.margin_value,
        rpp.is_enabled,
        erp.name as product_name,
        erp.custom_name,
        erp.manual_selling_price as mi_costo
      FROM recharge_product_pricing rpp
      JOIN external_recharge_products erp ON erp.id = rpp.external_product_id
      WHERE rpp.company_id = $1
      ORDER BY erp.name
    `, [company.id])

    // 4. Query final que usa WhatsApp (para comparar)
    const whatsappQuery = await db.query(`
      SELECT
        erp.id,
        erp.name,
        erp.custom_name,
        erp.manual_selling_price,
        rpp.selling_price,
        rpp.margin_type,
        rpp.margin_value,
        rpp.is_enabled
      FROM external_recharge_products erp
      INNER JOIN recharge_product_pricing rpp
        ON rpp.external_product_id = erp.id
        AND rpp.company_id = $1
        AND rpp.is_enabled = true
      WHERE erp.is_active = true
        AND (rpp.selling_price IS NOT NULL OR (rpp.margin_type IS NOT NULL AND rpp.margin_value IS NOT NULL))
      ORDER BY rpp.selling_price ASC NULLS LAST, erp.name ASC
    `, [company.id])

    // Calcular precios como lo hace WhatsApp
    const calculatedProducts = whatsappQuery.rows.map(row => {
      const miCosto = row.manual_selling_price ? parseFloat(row.manual_selling_price) : 0
      let customerPrice = 0

      if (row.selling_price) {
        customerPrice = parseFloat(row.selling_price)
      } else if (row.margin_type === 'percentage' && row.margin_value) {
        customerPrice = miCosto * (1 + parseFloat(row.margin_value) / 100)
      } else if (row.margin_type === 'fixed' && row.margin_value) {
        customerPrice = miCosto + parseFloat(row.margin_value)
      }

      return {
        id: row.id,
        name: row.custom_name || row.name,
        miCosto,
        customerPrice,
        selling_price: row.selling_price,
        margin_type: row.margin_type,
        margin_value: row.margin_value
      }
    })

    return NextResponse.json({
      success: true,
      config: {
        WHATSAPP_AGENT_COMPANY_NAME: companyName
      },
      company: {
        id: company.id,
        name: company.legalname
      },
      summary: {
        totalActiveProducts: productsResult.rows.length,
        productsWithPricingForCompany: pricingResult.rows.length,
        productsReadyForWhatsApp: whatsappQuery.rows.length
      },
      activeProducts: productsResult.rows,
      companyPricing: pricingResult.rows,
      whatsappReadyProducts: calculatedProducts,
      diagnostic: {
        issue: whatsappQuery.rows.length === 0
          ? 'NO HAY PRODUCTOS LISTOS PARA WHATSAPP'
          : 'OK',
        possibleCauses: whatsappQuery.rows.length === 0 ? [
          'La empresa no tiene registros en recharge_product_pricing',
          'Los registros no tienen selling_price ni margen configurado',
          'Los registros tienen is_enabled = false'
        ] : []
      }
    })

  } catch (error) {
    console.error('[Debug WhatsApp Recharge] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
