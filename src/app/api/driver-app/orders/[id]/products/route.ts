import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

async function getUserFromToken() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) return null

    const secret = process.env.JWT_SECRET || 'secret-key-for-development'
    const decoded = jwt.verify(token, secret) as any

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      companyId: decoded.companyId
    }
  } catch (error) {
    return null
  }
}

// Ensure order_products table exists
async function ensureOrderProductsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_products (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES package_orders(id),
        product_id INTEGER,
        product_code VARCHAR(50),
        product_name VARCHAR(200),
        quantity INTEGER DEFAULT 1,
        weight_lbs DECIMAL(10,2),
        unit_price DECIMAL(10,2),
        subtotal DECIMAL(10,2),
        empaque_code VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Add shipping_type column to package_orders if not exists
    await db.query(`
      ALTER TABLE package_orders ADD COLUMN IF NOT EXISTS shipping_type VARCHAR(20) DEFAULT 'air'
    `)
  } catch (error) {
    console.error('Error ensuring order_products table:', error)
  }
}

// GET: Get products for an order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden invalido'
      }, { status: 400 })
    }

    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    await ensureOrderProductsTable()

    // Get order info to verify access and get shipping type
    const orderResult = await db.query(`
      SELECT id, shipping_type as "shippingType", company_id
      FROM package_orders
      WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check company access
    if (order.company_id !== user.companyId && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a esta orden'
      }, { status: 403 })
    }

    // Get products
    const productsResult = await db.query(`
      SELECT
        id,
        product_id as "productId",
        product_code as "productCode",
        product_name as "productName",
        quantity,
        weight_lbs as "weightLbs",
        unit_price as "unitPrice",
        subtotal,
        empaque_code as "empaqueCode"
      FROM order_products
      WHERE order_id = $1
      ORDER BY id
    `, [orderId])

    // Get empaque code (from first product or order)
    const empaqueCode = productsResult.rows[0]?.empaqueCode || null

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        shippingType: order.shippingType || 'air',
        products: productsResult.rows,
        empaqueCode,
        totalAmount: productsResult.rows.reduce((sum: number, p: any) => sum + parseFloat(p.subtotal || 0), 0)
      }
    })

  } catch (error) {
    console.error('Error fetching order products:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener productos'
    }, { status: 500 })
  }
}

// POST: Add/update products for an order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden invalido'
      }, { status: 400 })
    }

    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    await ensureOrderProductsTable()

    const body = await request.json()
    const { shippingType, products, empaqueCode, totalAmount } = body

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere lista de productos'
      }, { status: 400 })
    }

    // Verify order exists and user has access
    const orderResult = await db.query(`
      SELECT id, company_id, payment_status
      FROM package_orders
      WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (order.company_id !== user.companyId && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a esta orden'
      }, { status: 403 })
    }

    // Check if order is already paid
    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        error: 'No se pueden modificar productos de una orden pagada'
      }, { status: 400 })
    }

    // Use transaction to update products
    await db.transaction(async (client) => {
      // 1. Delete existing products
      await client.query(`
        DELETE FROM order_products WHERE order_id = $1
      `, [orderId])

      // 2. Insert new products
      for (const product of products) {
        await client.query(`
          INSERT INTO order_products (
            order_id, product_id, product_code, product_name,
            quantity, weight_lbs, unit_price, subtotal, empaque_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          orderId,
          product.productId,
          product.productCode,
          product.productName,
          product.quantity,
          product.weightLbs || 0,
          product.unitPrice,
          product.subtotal,
          empaqueCode || null
        ])
      }

      // 3. Update order shipping type and total
      await client.query(`
        UPDATE package_orders
        SET
          shipping_type = $1,
          totalamount = $2,
          updatedat = NOW()
        WHERE id = $3
      `, [shippingType || 'air', totalAmount || 0, orderId])
    })

    return NextResponse.json({
      success: true,
      message: 'Productos actualizados exitosamente',
      data: {
        orderId,
        productCount: products.length,
        totalAmount,
        shippingType,
        empaqueCode
      }
    })

  } catch (error) {
    console.error('Error updating order products:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar productos'
    }, { status: 500 })
  }
}
