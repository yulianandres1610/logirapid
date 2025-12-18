import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { getUnivCellClient, UNIVCELL_RESULT_CODES } from '@/lib/univcell-client'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// Ensure recharge_transactions table exists
async function ensureTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS recharge_transactions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        user_id INTEGER REFERENCES users(id),

        -- Datos de la recarga
        univcell_order_id VARCHAR(100),
        local_reference VARCHAR(100) UNIQUE,
        product_id INTEGER,
        product_name VARCHAR(255),
        destination VARCHAR(50),
        amount DECIMAL(10,2),
        amount_cents INTEGER,
        service_type VARCHAR(20),

        -- Resultado
        status VARCHAR(20) DEFAULT 'pending',
        result_code INTEGER,
        result_message TEXT,
        confirmation_code VARCHAR(100),

        -- Cliente
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Create indexes if they don't exist
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_recharge_transactions_company ON recharge_transactions(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_recharge_transactions_reference ON recharge_transactions(local_reference)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_recharge_transactions_status ON recharge_transactions(status)
    `)
  } catch (error) {
    console.error('[Recargas] Error ensuring table:', error)
  }
}

// GET - Obtener todas las recargas
export async function GET(request: NextRequest) {
  try {
    await ensureTable()

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
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query with filters
    let query = `
      SELECT * FROM recharge_transactions
      WHERE 1=1
    `
    const params: (string | number)[] = []
    let paramIndex = 1

    // Filter by company for non-SUPER_ADMIN
    if (payload.role !== 'SUPER_ADMIN') {
      query += ` AND company_id = $${paramIndex}`
      params.push(payload.companyId)
      paramIndex++
    }

    if (service && service !== 'all') {
      query += ` AND service_type = $${paramIndex}`
      params.push(service)
      paramIndex++
    }

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)')
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get stats
    let statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_amount
      FROM recharge_transactions
      WHERE 1=1
    `
    const statsParams: (string | number)[] = []

    if (payload.role !== 'SUPER_ADMIN') {
      statsQuery += ` AND company_id = $1`
      statsParams.push(payload.companyId)
    }

    const statsResult = await db.query(statsQuery, statsParams)
    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        localReference: row.local_reference,
        univcellOrderId: row.univcell_order_id,
        productId: row.product_id,
        productName: row.product_name,
        service: row.service_type,
        phoneNumber: row.destination,
        amount: parseFloat(row.amount) || 0,
        status: row.status,
        resultCode: row.result_code,
        resultMessage: row.result_message,
        confirmationCode: row.confirmation_code,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        createdAt: row.created_at,
        completedAt: row.completed_at
      })),
      stats: {
        total: parseInt(stats.total) || 0,
        completed: parseInt(stats.completed) || 0,
        pending: parseInt(stats.pending) || 0,
        failed: parseInt(stats.failed) || 0,
        totalAmount: parseFloat(stats.total_amount) || 0
      },
      total,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('[Recargas] Error fetching:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener recargas' },
      { status: 500 }
    )
  }
}

// POST - Crear una nueva recarga (REAL con UnivCell)
export async function POST(request: NextRequest) {
  try {
    await ensureTable()

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
        error: 'Token invalido'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      productId,
      productName,
      service,
      phoneNumber,
      amount,
      sellingPrice,
      customerName,
      customerEmail
    } = body

    // Validacion de campos requeridos
    if (!productId || !phoneNumber || !amount) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos (productId, phoneNumber, amount)' },
        { status: 400 }
      )
    }

    // Buscar el producto en la base de datos para obtener el ID real de UnivCell
    // Para productos sincronizados, external_id es el ID de UnivCell
    // Para productos manuales, univcell_product_id es el ID asociado
    const productResult = await db.query(`
      SELECT id, external_id, univcell_product_id, name, country_code
      FROM external_recharge_products
      WHERE id = $1
    `, [productId])

    if (productResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const product = productResult.rows[0]
    // Usar univcell_product_id si existe (productos manuales), sino usar external_id (productos sincronizados)
    const univcellProductId = product.univcell_product_id || product.external_id

    if (!univcellProductId) {
      return NextResponse.json(
        { success: false, error: 'Producto no tiene ID de UnivCell configurado' },
        { status: 400 }
      )
    }

    // Generar referencia unica
    const localReference = uuidv4()

    // Convertir amount a centavos para UnivCell
    // El amount viene como dolares (ej: 20.00), UnivCell espera centavos (2000)
    const amountCents = Math.round(parseFloat(amount) * 100)

    // Formatear numero de telefono para UnivCell
    // UnivCell espera el numero CON codigo de pais pero SIN el simbolo +
    // Ej: 5356886845 (no +5356886845, no 56886845)
    let formattedDestination = phoneNumber
    if (phoneNumber.startsWith('+')) {
      formattedDestination = phoneNumber.replace(/^\+/, '')
    }

    console.log('[Recargas] Processing topup:', {
      localProductId: productId,
      univcellProductId,
      destination: formattedDestination,
      originalPhone: phoneNumber,
      amount,
      amountCents,
      localReference
    })

    // Crear registro pendiente en BD
    const insertResult = await db.query(`
      INSERT INTO recharge_transactions (
        company_id, user_id, local_reference, product_id, product_name,
        destination, amount, amount_cents, service_type, status,
        customer_name, customer_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
      RETURNING id
    `, [
      payload.companyId,
      payload.userId,
      localReference,
      productId,
      productName || 'Recarga',
      phoneNumber,
      sellingPrice || amount,
      amountCents,
      service || 'telefono',
      customerName || null,
      customerEmail || null
    ])

    const transactionId = insertResult.rows[0].id

    // Llamar a UnivCell API
    const univcellClient = getUnivCellClient()

    if (!univcellClient.isConfigured()) {
      console.error('[Recargas] UnivCell client not configured')

      // Update transaction as failed
      await db.query(`
        UPDATE recharge_transactions
        SET status = 'failed', result_message = 'Cliente UnivCell no configurado', updated_at = NOW()
        WHERE id = $1
      `, [transactionId])

      return NextResponse.json({
        success: false,
        error: 'Servicio de recargas no configurado'
      }, { status: 500 })
    }

    try {
      const topupResult = await univcellClient.executeTopUp({
        product_id: univcellProductId, // ID real de UnivCell, no el ID local
        destination: formattedDestination, // Sin +53 para Cuba
        amount: amountCents,
        local_reference: localReference,
        realtime: true,
        unlimited: false
      })

      console.log('[Recargas] UnivCell response:', topupResult)

      const resultCode = topupResult.data?.resultCode
      const resultMessage = topupResult.data?.resultMessage || UNIVCELL_RESULT_CODES[resultCode] || 'Unknown'
      const univcellOrderId = topupResult.data?.id
      const confirmationCode = topupResult.data?.confirmationCode
      const univcellStatus = topupResult.data?.status

      // Determinar estado basado en resultCode
      let finalStatus = 'failed'
      if (resultCode === 500) {
        finalStatus = 'completed'
      } else if (resultCode === 502) {
        finalStatus = 'pending' // Esperar webhook
      }

      // Actualizar transaccion
      await db.query(`
        UPDATE recharge_transactions
        SET
          univcell_order_id = $1,
          result_code = $2,
          result_message = $3,
          confirmation_code = $4,
          status = $5,
          completed_at = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        univcellOrderId,
        resultCode,
        resultMessage,
        confirmationCode,
        finalStatus,
        finalStatus === 'completed' ? new Date() : null,
        transactionId
      ])

      if (finalStatus === 'completed') {
        return NextResponse.json({
          success: true,
          data: {
            id: transactionId,
            localReference,
            univcellOrderId,
            confirmationCode,
            status: finalStatus,
            resultCode,
            resultMessage
          },
          message: 'Recarga procesada exitosamente'
        }, { status: 201 })
      } else if (finalStatus === 'pending') {
        return NextResponse.json({
          success: true,
          data: {
            id: transactionId,
            localReference,
            univcellOrderId,
            status: 'pending',
            resultCode,
            resultMessage
          },
          message: 'Recarga en proceso, esperando confirmacion'
        }, { status: 202 })
      } else {
        return NextResponse.json({
          success: false,
          error: resultMessage || 'Error al procesar recarga',
          data: {
            id: transactionId,
            localReference,
            resultCode,
            resultMessage
          }
        }, { status: 400 })
      }

    } catch (univcellError: unknown) {
      console.error('[Recargas] UnivCell API error:', univcellError)

      const errorMessage = univcellError instanceof Error ? univcellError.message : 'Error de conexion con UnivCell'

      // Actualizar como fallido
      await db.query(`
        UPDATE recharge_transactions
        SET status = 'failed', result_message = $1, updated_at = NOW()
        WHERE id = $2
      `, [errorMessage, transactionId])

      return NextResponse.json({
        success: false,
        error: errorMessage,
        data: {
          id: transactionId,
          localReference
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[Recargas] Error creating:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
