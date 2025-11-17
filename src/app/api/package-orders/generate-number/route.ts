import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * API para generar números de orden secuenciales
 * PICKUP: PICKUP00001 a PICKUP99999 (5 dígitos)
 * SHIPPING: SHIPPING001 a SHIPPING999 (3 dígitos)
 * DELIVERY: DELIVERY001 a DELIVERY999 (3 dígitos)
 */
export async function POST(request: NextRequest) {
  try {
    const { orderType } = await request.json()

    if (!orderType || !['recogida', 'oficina', 'entrega'].includes(orderType)) {
      return NextResponse.json({
        success: false,
        error: 'orderType inválido. Debe ser "recogida", "oficina" o "entrega"'
      }, { status: 400 })
    }

    // Generar número para órdenes de RECOGIDA (PICKUP)
    if (orderType === 'recogida') {
      const result = await db.query(
        `SELECT ordernumber FROM package_orders
         WHERE order_type = 'recogida' AND ordernumber LIKE 'PICKUP%'
         ORDER BY id DESC LIMIT 1`
      )

      let nextNumber = 1
      if (result.rows.length > 0) {
        const lastNumber = result.rows[0].ordernumber.match(/\d+$/)?.[0] || '0'
        nextNumber = parseInt(lastNumber) + 1
      }

      // Validar que no exceda el límite de 99999
      if (nextNumber > 99999) {
        return NextResponse.json({
          success: false,
          error: 'Se ha alcanzado el límite de números PICKUP (99999)'
        }, { status: 400 })
      }

      const orderNumber = `PICKUP${nextNumber.toString().padStart(5, '0')}`

      return NextResponse.json({
        success: true,
        orderNumber
      })
    }

    // Generar número para órdenes de OFICINA (SHIPPING)
    if (orderType === 'oficina') {
      const result = await db.query(
        `SELECT ordernumber FROM package_orders
         WHERE order_type = 'oficina' AND ordernumber LIKE 'SHIPPING%'
         ORDER BY id DESC LIMIT 1`
      )

      let nextNumber = 1
      if (result.rows.length > 0) {
        const lastNumber = result.rows[0].ordernumber.match(/\d+$/)?.[0] || '0'
        nextNumber = parseInt(lastNumber) + 1
      }

      // Validar que no exceda el límite de 999
      if (nextNumber > 999) {
        return NextResponse.json({
          success: false,
          error: 'Se ha alcanzado el límite de números SHIPPING (999)'
        }, { status: 400 })
      }

      const orderNumber = `SHIPPING${nextNumber.toString().padStart(3, '0')}`

      return NextResponse.json({
        success: true,
        orderNumber
      })
    }

    // Generar número para órdenes de ENTREGA (DELIVERY)
    if (orderType === 'entrega') {
      const result = await db.query(
        `SELECT ordernumber FROM package_orders
         WHERE order_type = 'entrega' AND ordernumber LIKE 'DELIVERY%'
         ORDER BY id DESC LIMIT 1`
      )

      let nextNumber = 1
      if (result.rows.length > 0) {
        const lastNumber = result.rows[0].ordernumber.match(/\d+$/)?.[0] || '0'
        nextNumber = parseInt(lastNumber) + 1
      }

      // Validar que no exceda el límite de 999
      if (nextNumber > 999) {
        return NextResponse.json({
          success: false,
          error: 'Se ha alcanzado el límite de números DELIVERY (999)'
        }, { status: 400 })
      }

      const orderNumber = `DELIVERY${nextNumber.toString().padStart(3, '0')}`

      return NextResponse.json({
        success: true,
        orderNumber
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Tipo de orden no reconocido'
    }, { status: 400 })

  } catch (error) {
    console.error('Error generating order number:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    // En caso de error, generar un número basado en timestamp como fallback
    const fallbackNumber = `ERROR${Date.now().toString().slice(-5)}`

    return NextResponse.json({
      success: true,
      orderNumber: fallbackNumber,
      warning: 'Número generado con método alternativo debido a un error'
    })
  }
}
