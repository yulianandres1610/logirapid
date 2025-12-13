import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/brokers/locations
 * Returns provinces and municipalities where there are active brokers
 * Used by the wizard to populate location dropdowns
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')
    const currency = searchParams.get('currency')

    // Build query to get brokers with their locations
    let query = `
      SELECT
        c.id,
        c.legalname,
        c.broker_province,
        c.broker_municipality,
        c.broker_coverage_area,
        c.broker_delivery_hours,
        c.broker_is_active,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'currency', bwb.currency,
            'available', bwb.available_balance
          ))
          FROM broker_wallet_balances bwb
          WHERE bwb.company_id = c.id
          ), '[]'
        ) as wallet_balances
      FROM companies c
      WHERE c.companytype = 'broker'
        AND c.broker_is_active = true
        AND c.broker_province IS NOT NULL
        AND c.broker_municipality IS NOT NULL
    `
    const params: any[] = []

    if (province) {
      params.push(province)
      query += ` AND c.broker_province = $${params.length}`
    }

    query += ` ORDER BY c.broker_province, c.broker_municipality, c.legalname`

    const result = await db.query(query, params)

    // Group by province and municipality
    const provincesMap: Record<string, {
      name: string
      municipalities: Record<string, {
        name: string
        brokerCount: number
        brokers: any[]
        currencies: string[]
      }>
    }> = {}

    for (const row of result.rows) {
      const prov = row.broker_province
      const muni = row.broker_municipality

      if (!provincesMap[prov]) {
        provincesMap[prov] = {
          name: prov,
          municipalities: {}
        }
      }

      if (!provincesMap[prov].municipalities[muni]) {
        provincesMap[prov].municipalities[muni] = {
          name: muni,
          brokerCount: 0,
          brokers: [],
          currencies: []
        }
      }

      provincesMap[prov].municipalities[muni].brokerCount++

      // Parse wallet balances
      const walletBalances = row.wallet_balances || []
      const currencies = walletBalances.map((w: any) => w.currency).filter(Boolean)

      // Add unique currencies
      for (const curr of currencies) {
        if (!provincesMap[prov].municipalities[muni].currencies.includes(curr)) {
          provincesMap[prov].municipalities[muni].currencies.push(curr)
        }
      }

      // Add broker info (without sensitive data)
      provincesMap[prov].municipalities[muni].brokers.push({
        id: row.id,
        name: row.legalname,
        deliveryHours: row.broker_delivery_hours,
        currencies
      })
    }

    // Convert to array format
    const provinces = Object.values(provincesMap).map(prov => ({
      name: prov.name,
      municipalities: Object.values(prov.municipalities).map(muni => ({
        name: muni.name,
        brokerCount: muni.brokerCount,
        currencies: muni.currencies.sort()
      }))
    })).sort((a, b) => a.name.localeCompare(b.name))

    // If currency filter is provided, filter municipalities that have brokers with that currency
    let filteredProvinces = provinces
    if (currency) {
      filteredProvinces = provinces.map(prov => ({
        ...prov,
        municipalities: prov.municipalities.filter(muni =>
          muni.currencies.includes(currency)
        )
      })).filter(prov => prov.municipalities.length > 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        provinces: filteredProvinces,
        totalBrokers: result.rows.length,
        availableCurrencies: [...new Set(result.rows.flatMap(r =>
          (r.wallet_balances || []).map((w: any) => w.currency).filter(Boolean)
        ))].sort()
      }
    })

  } catch (error) {
    console.error('[Brokers Locations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener ubicaciones'
    }, { status: 500 })
  }
}
