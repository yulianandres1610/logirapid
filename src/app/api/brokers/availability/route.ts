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
 * GET /api/brokers/availability
 * Check broker availability for a specific location, currency, and amount
 * Returns estimated delivery time based on available funds
 *
 * Query params:
 * - province: Province in Cuba (required)
 * - municipality: Municipality (required)
 * - currency: Currency needed (default: USD)
 * - amount: Amount needed (required)
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

    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')
    const municipality = searchParams.get('municipality')
    const currency = searchParams.get('currency') || 'USD'
    const amountStr = searchParams.get('amount')

    if (!province || !municipality) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere provincia y municipio'
      }, { status: 400 })
    }

    if (!amountStr) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere el monto'
      }, { status: 400 })
    }

    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser un número positivo'
      }, { status: 400 })
    }

    // Get brokers in this location with their wallet balances
    // Use ILIKE for case-insensitive matching since frontend sends formatted names
    const result = await db.query(`
      SELECT
        c.id,
        c.legalname as name,
        c.broker_delivery_hours,
        c.broker_contact_phone,
        c.broker_coverage_area,
        bwb.currency,
        bwb.available_balance,
        bwb.reserved_balance,
        bwb.total_balance
      FROM companies c
      LEFT JOIN broker_wallet_balances bwb
        ON bwb.company_id = c.id AND bwb.currency = $3
      WHERE c.companytype = 'broker'
        AND c.broker_is_active = true
        AND LOWER(c.broker_province) = LOWER($1)
        AND (LOWER(c.broker_municipality) = LOWER($2)
          OR c.broker_coverage_area::jsonb ? $2)
      ORDER BY COALESCE(bwb.available_balance, 0) DESC
    `, [province, municipality, currency])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasAvailability: false,
          hasBrokers: false,
          estimatedDelivery: '1-3 días',
          message: 'No hay brokers disponibles en esta zona',
          brokers: [],
          totalAvailable: 0,
          requestedAmount: amount,
          currency
        }
      })
    }

    // Calculate totals
    const brokers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      deliveryHours: row.broker_delivery_hours,
      availableBalance: parseFloat(row.available_balance) || 0,
      currency: row.currency || currency,
      canFulfill: (parseFloat(row.available_balance) || 0) >= amount
    }))

    const totalAvailable = brokers.reduce((sum, b) => sum + b.availableBalance, 0)
    const canFulfillBrokers = brokers.filter(b => b.canFulfill)
    const hasAvailability = totalAvailable >= amount

    // Determine estimated delivery based on availability
    // - 1-24 horas: When there's enough balance to fulfill the order
    // - 1-3 días: When there's no balance or insufficient funds
    let estimatedDelivery: string
    let deliveryMessage: string

    if (canFulfillBrokers.length > 0) {
      // At least one broker can fulfill completely with available balance
      estimatedDelivery = '1-24 horas'
      deliveryMessage = 'Entrega rápida disponible'
    } else {
      // No broker has enough funds, will need to wait for deposits
      estimatedDelivery = '1-3 días'
      deliveryMessage = 'Fondos insuficientes - se procesará cuando haya disponibilidad'
    }

    // Find best broker (with most funds that can fulfill)
    const bestBroker = canFulfillBrokers.length > 0
      ? canFulfillBrokers[0]
      : brokers.find(b => b.availableBalance > 0) || brokers[0]

    return NextResponse.json({
      success: true,
      data: {
        hasAvailability,
        hasBrokers: true,
        estimatedDelivery,
        message: deliveryMessage,
        brokers: brokers.map(b => ({
          id: b.id,
          name: b.name,
          availableBalance: b.availableBalance,
          currency: b.currency,
          canFulfill: b.canFulfill,
          deliveryHours: b.deliveryHours
        })),
        bestBrokerId: bestBroker?.id,
        totalAvailable,
        requestedAmount: amount,
        currency,
        province,
        municipality
      }
    })

  } catch (error) {
    console.error('[Brokers Availability API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar disponibilidad'
    }, { status: 500 })
  }
}
