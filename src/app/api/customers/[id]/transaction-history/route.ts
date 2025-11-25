import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/customers/[id]/transaction-history
 * Obtiene el historial completo de transacciones/servicios de un cliente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customerId = parseInt(id)
    const companyId = request.headers.get('x-company-id')

    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'ID de cliente inválido' },
        { status: 400 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID requerido en headers' },
        { status: 400 }
      )
    }

    // Verificar que el cliente existe y pertenece a la empresa
    const customerQuery = `
      SELECT id, firstname, lastname, phone, email
      FROM customers
      WHERE id = $1 AND company_id = $2
    `
    const customerResult = await db.query(customerQuery, [customerId, companyId])

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    const customer = customerResult.rows[0]

    // Obtener historial de órdenes de paquetes
    const packagesQuery = `
      SELECT
        id,
        order_number as "orderNumber",
        order_type as "orderType",
        status,
        created_at as "createdAt",
        pickup_date as "pickupDate",
        delivery_date as "deliveryDate",
        total_amount as "totalAmount",
        pickup_address as "pickupAddress",
        delivery_address as "deliveryAddress",
        services,
        boxes_delivered as "boxesDelivered",
        boxes_returned as "boxesReturned",
        parent_order_id as "parentOrderId"
      FROM package_orders
      WHERE
        sender_customer_id = $1
        AND company_id = $2
        AND status IN ('completed', 'delivered', 'in_transit', 'pending')
      ORDER BY created_at DESC
    `
    const packagesResult = await db.query(packagesQuery, [customerId, companyId])

    // Obtener transacciones del historial (si existen)
    const transactionsQuery = `
      SELECT
        id,
        transaction_type as "transactionType",
        order_number as "orderNumber",
        service_name as "serviceName",
        amount,
        status,
        transaction_date as "transactionDate",
        completed_at as "completedAt",
        details
      FROM customer_transactions
      WHERE
        customer_id = $1
        AND company_id = $2
      ORDER BY transaction_date DESC
    `
    const transactionsResult = await db.query(transactionsQuery, [customerId, companyId])

    // Agrupar por tipo de servicio
    const groupedTransactions = {
      packages: packagesResult.rows.filter(p => ['recogida', 'oficina'].includes(p.orderType)),
      boxDeliveries: packagesResult.rows.filter(p => p.orderType === 'entrega_cajas_vacias'),
      returns: packagesResult.rows.filter(p => p.orderType === 'retorno'),
      other: transactionsResult.rows
    }

    // Calcular estadísticas
    const stats = {
      totalOrders: packagesResult.rows.length,
      completedOrders: packagesResult.rows.filter(p => p.status === 'completed').length,
      totalSpent: packagesResult.rows.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0),
      boxesDelivered: packagesResult.rows.reduce((sum, p) => sum + (p.boxesDelivered || 0), 0),
      boxesReturned: packagesResult.rows.reduce((sum, p) => sum + (p.boxesReturned || 0), 0),
      activeReturns: packagesResult.rows.filter(p =>
        p.orderType === 'entrega_cajas_vacias' &&
        (p.boxesDelivered || 0) > (p.boxesReturned || 0)
      ).length
    }

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          firstName: customer.firstname,
          lastName: customer.lastname,
          phone: customer.phone,
          email: customer.email
        },
        transactions: groupedTransactions,
        stats
      }
    })

  } catch (error) {
    console.error('Error in GET /api/customers/[id]/transaction-history:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
