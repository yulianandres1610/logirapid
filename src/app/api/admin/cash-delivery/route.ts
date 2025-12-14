import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// Bill denominations by currency
const BILL_DENOMINATIONS: { [key: string]: number[] } = {
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  CUP: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  MLC: [100, 50, 20, 10, 5, 1]
}

// Calculate total from bill denominations
function calculateTotalFromDenominations(denominations: { [key: string]: number }): { totalAmount: number, totalBills: number } {
  let totalAmount = 0
  let totalBills = 0

  for (const [denomination, quantity] of Object.entries(denominations)) {
    const denominationValue = parseInt(denomination)
    const billCount = Number(quantity) || 0
    totalAmount += denominationValue * billCount
    totalBills += billCount
  }

  return { totalAmount, totalBills }
}

// Generate order number
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CDO-${year}-`

  const result = await db.query(`
    SELECT order_number FROM cash_delivery_orders
    WHERE order_number LIKE $1
    ORDER BY order_number DESC
    LIMIT 1
  `, [`${prefix}%`])

  let nextNum = 1
  if (result.rows.length > 0) {
    const lastNum = parseInt(result.rows[0].order_number.split('-')[2]) || 0
    nextNum = lastNum + 1
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

// GET - List all cash delivery orders
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const brokerId = searchParams.get('brokerId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (status) {
      whereClause += ` AND cdo.status = $${paramIndex++}`
      params.push(status)
    }

    if (brokerId) {
      whereClause += ` AND cdo.broker_company_id = $${paramIndex++}`
      params.push(parseInt(brokerId))
    }

    // Get orders with pagination
    const ordersResult = await db.query(`
      SELECT
        cdo.*,
        bc.name as broker_name,
        bc.broker_province,
        bc.broker_municipality,
        du.name as delivery_user_display_name,
        cu.name as created_by_name
      FROM cash_delivery_orders cdo
      LEFT JOIN companies bc ON cdo.broker_company_id = bc.id
      LEFT JOIN users du ON cdo.delivery_user_id = du.id
      LEFT JOIN users cu ON cdo.created_by_user_id = cu.id
      ${whereClause}
      ORDER BY cdo.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset])

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) FROM cash_delivery_orders cdo ${whereClause}
    `, params)

    const totalCount = parseInt(countResult.rows[0].count)
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersResult.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages
        }
      }
    })

  } catch (error: any) {
    console.error('[Cash Delivery API] Error fetching orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener las órdenes de entrega'
    }, { status: 500 })
  }
}

// POST - Create new cash delivery order
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const userId = cookieStore.get('user-id')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const {
      brokerCompanyId,
      deliveryUserId,
      currency = 'USD',
      billDenominations,
      deadlineDate,
      notes
    } = body

    // Validate required fields
    if (!brokerCompanyId || !deliveryUserId || !billDenominations || !deadlineDate) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: brokerCompanyId, deliveryUserId, billDenominations, deadlineDate'
      }, { status: 400 })
    }

    // Validate currency
    if (!BILL_DENOMINATIONS[currency]) {
      return NextResponse.json({
        success: false,
        error: `Moneda no soportada: ${currency}. Monedas válidas: ${Object.keys(BILL_DENOMINATIONS).join(', ')}`
      }, { status: 400 })
    }

    // Validate denominations
    const validDenominations = BILL_DENOMINATIONS[currency]
    for (const denom of Object.keys(billDenominations)) {
      if (!validDenominations.includes(parseInt(denom))) {
        return NextResponse.json({
          success: false,
          error: `Denominación inválida: ${denom}. Denominaciones válidas para ${currency}: ${validDenominations.join(', ')}`
        }, { status: 400 })
      }
    }

    // Calculate totals
    const { totalAmount, totalBills } = calculateTotalFromDenominations(billDenominations)

    if (totalAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto total debe ser mayor a 0'
      }, { status: 400 })
    }

    // Get broker info
    const brokerResult = await db.query(`
      SELECT id, name, broker_province, broker_municipality, broker_contact_phone
      FROM companies
      WHERE id = $1 AND companytype = 'broker'
    `, [brokerCompanyId])

    if (brokerResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Broker no encontrado'
      }, { status: 404 })
    }

    const broker = brokerResult.rows[0]

    // Get delivery user info
    const userResult = await db.query(`
      SELECT id, name, phone
      FROM users
      WHERE id = $1
    `, [deliveryUserId])

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario repartidor no encontrado'
      }, { status: 404 })
    }

    const deliveryUser = userResult.rows[0]

    if (!deliveryUser.phone) {
      return NextResponse.json({
        success: false,
        error: 'El repartidor no tiene teléfono configurado. Es necesario para recibir el OTP.'
      }, { status: 400 })
    }

    // Generate order number
    const orderNumber = await generateOrderNumber()

    // Create the order
    const insertResult = await db.query(`
      INSERT INTO cash_delivery_orders (
        order_number,
        broker_company_id,
        broker_company_name,
        delivery_user_id,
        delivery_user_name,
        delivery_user_phone,
        currency,
        total_amount,
        bill_denominations,
        total_bills,
        deadline_date,
        notes,
        created_by_user_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
      RETURNING *
    `, [
      orderNumber,
      brokerCompanyId,
      broker.name,
      deliveryUserId,
      deliveryUser.name,
      deliveryUser.phone,
      currency,
      totalAmount,
      JSON.stringify(billDenominations),
      totalBills,
      deadlineDate,
      notes || null,
      userId ? parseInt(userId) : null
    ])

    const newOrder = insertResult.rows[0]

    // TODO: Send SMS notifications to delivery user and broker
    // This would be done here if SMS is configured

    return NextResponse.json({
      success: true,
      data: {
        id: newOrder.id,
        orderNumber: newOrder.order_number,
        totalAmount: parseFloat(newOrder.total_amount),
        totalBills: newOrder.total_bills,
        currency: newOrder.currency,
        status: newOrder.status,
        brokerName: broker.name,
        deliveryUserName: deliveryUser.name,
        deadlineDate: newOrder.deadline_date
      }
    })

  } catch (error: any) {
    console.error('[Cash Delivery API] Error creating order:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear la orden de entrega'
    }, { status: 500 })
  }
}
