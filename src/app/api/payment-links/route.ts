import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Lista payment links (GET) o crea uno nuevo (POST)
 */

// GET /api/payment-links - Lista payment links con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const orderType = searchParams.get('order_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construir query con filtros
    let query = `
      SELECT
        id,
        link_code,
        order_type,
        order_id,
        order_number,
        amount,
        currency,
        status,
        customer_phone,
        customer_name,
        customer_email,
        description,
        expires_at,
        paid_at,
        created_at,
        updated_at
      FROM payment_links
      WHERE 1=1
    `
    const params: unknown[] = []
    let paramIndex = 1

    if (status) {
      query += ` AND status = $${paramIndex++}`
      params.push(status)
    }

    if (orderType) {
      query += ` AND order_type = $${paramIndex++}`
      params.push(orderType)
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Obtener total
    let countQuery = `SELECT COUNT(*) FROM payment_links WHERE 1=1`
    const countParams: unknown[] = []
    let countIndex = 1

    if (status) {
      countQuery += ` AND status = $${countIndex++}`
      countParams.push(status)
    }

    if (orderType) {
      countQuery += ` AND order_type = $${countIndex++}`
      countParams.push(orderType)
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].count)

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('[Payment Links API] Error listing:', error)
    return NextResponse.json(
      { success: false, error: 'Error obteniendo links de pago' },
      { status: 500 }
    )
  }
}

// POST /api/payment-links - Crear nuevo payment link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      orderType,
      orderId,
      orderNumber,
      amount,
      currency = 'USD',
      customerPhone,
      customerName,
      customerEmail,
      description,
      expiresInHours = 24
    } = body

    // Validaciones
    if (!orderType || !orderId || !amount) {
      return NextResponse.json(
        { success: false, error: 'orderType, orderId y amount son requeridos' },
        { status: 400 }
      )
    }

    // Generar codigo unico
    const linkCode = generateLinkCode()

    // Calcular expiracion
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)

    // Insertar
    const result = await db.query(`
      INSERT INTO payment_links (
        link_code,
        order_type,
        order_id,
        order_number,
        amount,
        currency,
        status,
        customer_phone,
        customer_name,
        customer_email,
        description,
        expires_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      linkCode,
      orderType,
      orderId,
      orderNumber,
      amount,
      currency,
      customerPhone,
      customerName,
      customerEmail,
      description,
      expiresAt
    ])

    const paymentLink = result.rows[0]

    // Construir URL
    const baseUrl = process.env.NEXT_PUBLIC_PAY_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pagos.logirapid.com'
    const paymentUrl = `${baseUrl}/pay/${linkCode}`

    return NextResponse.json({
      success: true,
      data: {
        ...paymentLink,
        url: paymentUrl
      }
    })

  } catch (error) {
    console.error('[Payment Links API] Error creating:', error)
    return NextResponse.json(
      { success: false, error: 'Error creando link de pago' },
      { status: 500 }
    )
  }
}

/**
 * Genera un codigo de link unico (8 caracteres alfanumericos)
 */
function generateLinkCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
