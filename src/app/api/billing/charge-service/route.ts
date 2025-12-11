import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

interface ServiceItem {
  productId?: number
  productCode?: string
  name: string
  quantity: number
  unitPrice: number
  costPrice?: number
  subtotal: number
}

/**
 * POST /api/billing/charge-service
 *
 * Charge a company for completed services.
 * Called when a delivery/service is completed.
 *
 * Body:
 * {
 *   orderId: number,          // package_order.id
 *   companyId: number,
 *   employeeId: number,       // User who completed the service
 *   employeeRole: string,
 *   chargeType: 'delivery' | 'pickup' | 'warehouse' | 'service'
 * }
 *
 * Returns:
 * - charged: boolean
 * - debitAmount: number
 * - debitTransactionId: number
 * - commissionPaid: boolean
 * - commissionAmount: number
 * - companyNewBalance: number
 * - employeeNewBalance: number (if commission paid)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body
    const body = await request.json()
    const {
      orderId,
      companyId,
      employeeId,
      employeeRole,
      chargeType = 'delivery'
    } = body

    // Validate required fields
    if (!orderId || !companyId) {
      return NextResponse.json({
        success: false,
        error: 'Campos requeridos: orderId, companyId'
      }, { status: 400 })
    }

    // Execute billing within transaction
    const result = await db.transaction(async (client) => {
      // 1. Get order and services
      const orderResult = await client.query(`
        SELECT
          id, services, totalamount, billing_status,
          company_id, recipientname, trackingnumber
        FROM package_orders WHERE id = $1
      `, [orderId])

      if (orderResult.rows.length === 0) {
        throw new Error('Orden no encontrada')
      }

      const order = orderResult.rows[0]

      // Check if already billed
      if (order.billing_status === 'charged') {
        return {
          charged: false,
          reason: 'La orden ya fue facturada',
          alreadyBilled: true
        }
      }

      // Verify company matches
      if (order.company_id !== companyId) {
        throw new Error('La orden no pertenece a esta empresa')
      }

      const totalAmount = parseFloat(order.totalamount || 0)
      let services: ServiceItem[] = []

      try {
        services = typeof order.services === 'string'
          ? JSON.parse(order.services || '[]')
          : (order.services || [])
      } catch {
        services = []
      }

      // If no amount to charge, skip
      if (totalAmount <= 0) {
        // Mark as charged anyway (nothing to charge)
        await client.query(`
          UPDATE package_orders
          SET billing_status = 'charged',
              billed_at = NOW()
          WHERE id = $1
        `, [orderId])

        return {
          charged: true,
          debitAmount: 0,
          reason: 'Sin monto a cobrar',
          zeroAmount: true
        }
      }

      // 2. Get company wallet info
      const companyResult = await client.query(`
        SELECT
          id, legalname,
          COALESCE(walletbalance, 0) as walletbalance,
          COALESCE(credit_limit, -200) as credit_limit,
          COALESCE(credit_enabled, false) as credit_enabled
        FROM companies WHERE id = $1
      `, [companyId])

      if (companyResult.rows.length === 0) {
        throw new Error('Empresa no encontrada')
      }

      const company = companyResult.rows[0]
      const currentBalance = parseFloat(company.walletbalance)
      const creditLimit = parseFloat(company.credit_limit)
      const creditEnabled = company.credit_enabled

      // 3. Check if company has sufficient balance/credit
      const newBalance = currentBalance - totalAmount

      if (!creditEnabled && newBalance < 0) {
        // Update billing status to failed
        await client.query(`
          UPDATE package_orders
          SET billing_status = 'failed'
          WHERE id = $1
        `, [orderId])

        return {
          charged: false,
          reason: 'Saldo insuficiente',
          currentBalance,
          required: totalAmount,
          insufficientFunds: true
        }
      }

      if (creditEnabled && newBalance < creditLimit) {
        // Update billing status to failed
        await client.query(`
          UPDATE package_orders
          SET billing_status = 'failed'
          WHERE id = $1
        `, [orderId])

        return {
          charged: false,
          reason: 'Excede limite de credito',
          currentBalance,
          creditLimit,
          required: totalAmount,
          exceedsCreditLimit: true
        }
      }

      // 4. Debit company wallet
      await client.query(`
        UPDATE companies
        SET walletbalance = walletbalance - $1,
            negative_since = CASE
              WHEN walletbalance - $1 < 0 AND negative_since IS NULL
              THEN NOW() ELSE negative_since END
        WHERE id = $2
      `, [totalAmount, companyId])

      // 5. Create debit transaction
      const txnNumber = `SVC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const debitTxn = await client.query(`
        INSERT INTO wallet_transactions (
          transaction_number,
          type,
          source_type,
          source_company_id,
          target_type,
          amount,
          fee,
          total_amount,
          payment_method,
          status,
          description,
          notes,
          metadata,
          created_at,
          completed_at
        ) VALUES (
          $1, 'service_charge', 'company', $2, 'platform', $3, 0, $3,
          'wallet', 'completed', $4, $5, $6, NOW(), NOW()
        )
        RETURNING id, transaction_number
      `, [
        txnNumber,
        companyId,
        totalAmount,
        `Cargo por servicio - Orden #${orderId}`,
        `Tracking: ${order.trackingnumber || 'N/A'} | Tipo: ${chargeType}`,
        JSON.stringify({
          orderId,
          chargeType,
          services,
          employeeId,
          employeeRole
        })
      ])

      const debitTransaction = debitTxn.rows[0]

      // 6. Mark order as billed
      await client.query(`
        UPDATE package_orders
        SET billing_status = 'charged',
            billed_at = NOW(),
            billing_transaction_id = $1
        WHERE id = $2
      `, [debitTransaction.id, orderId])

      // 7. Calculate platform cost and margin for billing log
      let platformCost = 0
      let companyMargin = 0

      for (const service of services) {
        if (service.costPrice) {
          platformCost += service.costPrice * (service.quantity || 1)
        }
        if (service.unitPrice && service.costPrice) {
          companyMargin += (service.unitPrice - service.costPrice) * (service.quantity || 1)
        }
      }

      // 8. Process commissions for each product with productId
      let totalCommission = 0
      let commissionTransactionId: number | null = null
      let employeeNewBalance: number | null = null

      if (employeeId && employeeRole) {
        for (const service of services) {
          if (service.productId) {
            // Call commission processing internally
            const commissionResult = await processCommissionInternal(client, {
              companyId,
              userId: employeeId,
              userRole: employeeRole,
              serviceType: chargeType,
              serviceId: orderId,
              serviceReference: order.trackingnumber,
              productId: service.productId,
              productPrice: service.subtotal
            })

            if (commissionResult.paid) {
              totalCommission += commissionResult.amount
              commissionTransactionId = commissionResult.transactionId
              employeeNewBalance = commissionResult.newBalance
            }
          }
        }
      }

      // 9. Create billing log entry
      await client.query(`
        INSERT INTO service_billing_log (
          company_id,
          order_id,
          service_type,
          gross_amount,
          platform_cost,
          company_margin,
          commission_paid,
          debit_transaction_id,
          commission_transaction_id,
          processed_by,
          processed_by_role,
          products,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
      `, [
        companyId,
        orderId,
        chargeType,
        totalAmount,
        platformCost,
        companyMargin,
        totalCommission,
        debitTransaction.id,
        commissionTransactionId,
        employeeId,
        employeeRole,
        JSON.stringify(services)
      ])

      // Get updated company balance
      const updatedCompany = await client.query(`
        SELECT walletbalance FROM companies WHERE id = $1
      `, [companyId])

      return {
        charged: true,
        debitAmount: totalAmount,
        debitTransactionId: debitTransaction.id,
        debitTransactionNumber: debitTransaction.transaction_number,
        companyNewBalance: parseFloat(updatedCompany.rows[0]?.walletbalance || 0),
        commissionPaid: totalCommission > 0,
        commissionAmount: totalCommission,
        commissionTransactionId,
        employeeNewBalance,
        services: services.length,
        platformCost,
        companyMargin
      }
    })

    console.log(`[Billing] Order ${orderId}: ${result.charged ? 'charged' : 'not charged'} - ${result.reason || `$${result.debitAmount}`}`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in POST /api/billing/charge-service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error procesando facturacion'
    }, { status: 500 })
  }
}

/**
 * Internal function to process commission within the same transaction
 */
async function processCommissionInternal(
  client: any,
  params: {
    companyId: number
    userId: number
    userRole: string
    serviceType: string
    serviceId: number
    serviceReference?: string
    productId: number
    productPrice: number
  }
): Promise<{ paid: boolean; amount: number; transactionId?: number; newBalance?: number }> {
  try {
    const { companyId, userId, userRole, serviceType, serviceId, serviceReference, productId, productPrice } = params

    // Find commission configuration
    const configResult = await client.query(`
      SELECT
        ccc.*,
        pc.code as product_code,
        pc.name as product_name,
        pc.platform_price
      FROM company_commission_config ccc
      JOIN product_catalog pc ON ccc.product_id = pc.id
      WHERE ccc.company_id = $1
        AND ccc.product_id = $2
        AND (ccc.role = $3 OR ccc.role = 'ALL')
        AND ccc.is_active = true
      ORDER BY CASE WHEN ccc.role = $3 THEN 0 ELSE 1 END
      LIMIT 1
    `, [companyId, productId, userRole])

    if (configResult.rows.length === 0) {
      return { paid: false, amount: 0 }
    }

    const config = configResult.rows[0]
    const price = productPrice || parseFloat(config.platform_price || 0)

    // Calculate commission
    let commissionAmount = 0
    if (config.commission_type === 'fixed') {
      commissionAmount = parseFloat(config.commission_value)
    } else {
      commissionAmount = price * (parseFloat(config.commission_value) / 100)
      if (config.min_amount && commissionAmount < parseFloat(config.min_amount)) {
        commissionAmount = parseFloat(config.min_amount)
      }
      if (config.max_amount && commissionAmount > parseFloat(config.max_amount)) {
        commissionAmount = parseFloat(config.max_amount)
      }
    }

    commissionAmount = Math.round(commissionAmount * 100) / 100

    if (commissionAmount <= 0) {
      return { paid: false, amount: 0 }
    }

    // Get user info
    const userResult = await client.query(`
      SELECT id, firstname, lastname, wallet_number, wallet_balance
      FROM users WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return { paid: false, amount: 0 }
    }

    const user = userResult.rows[0]

    // Generate transaction number
    const txnNumber = `COM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create commission transaction
    const txnResult = await client.query(`
      INSERT INTO wallet_transactions (
        transaction_number, type, source_type, source_company_id,
        target_type, target_user_id, target_wallet_number,
        amount, fee, total_amount, payment_method, status,
        description, notes, created_at, completed_at
      ) VALUES (
        $1, 'commission', 'company', $2, 'user', $3, $4, $5, 0, $5,
        'wallet', 'completed', $6, $7, NOW(), NOW()
      )
      RETURNING id, transaction_number
    `, [
      txnNumber,
      companyId,
      userId,
      user.wallet_number,
      commissionAmount,
      `Comision por ${serviceType} - ${config.product_name}`,
      `Servicio: ${serviceReference || serviceId}`
    ])

    const transaction = txnResult.rows[0]

    // Update user balance
    const newBalanceResult = await client.query(`
      UPDATE users
      SET wallet_balance = COALESCE(wallet_balance, 0) + $1
      WHERE id = $2
      RETURNING wallet_balance
    `, [commissionAmount, userId])

    const newBalance = parseFloat(newBalanceResult.rows[0].wallet_balance)

    // Record in employee_commissions
    await client.query(`
      INSERT INTO employee_commissions (
        company_id, user_id, user_role, service_type, service_id,
        service_reference, product_id, product_name, product_price,
        commission_config_id, commission_type, commission_rate, commission_amount,
        transaction_id, transaction_number, status, created_at, paid_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        'paid', NOW(), NOW()
      )
    `, [
      companyId, userId, userRole, serviceType, serviceId,
      serviceReference, productId, config.product_name, price,
      config.id, config.commission_type, config.commission_value, commissionAmount,
      transaction.id, transaction.transaction_number
    ])

    return {
      paid: true,
      amount: commissionAmount,
      transactionId: transaction.id,
      newBalance
    }
  } catch (error) {
    console.error('[Commission] Error processing:', error)
    return { paid: false, amount: 0 }
  }
}

/**
 * GET /api/billing/charge-service
 *
 * Check billing status for an order
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere orderId'
      }, { status: 400 })
    }

    // Get order billing info
    const orderResult = await db.query(`
      SELECT
        po.id,
        po.trackingnumber,
        po.totalamount,
        po.billing_status,
        po.billed_at,
        po.billing_transaction_id,
        wt.transaction_number as billing_transaction_number,
        c.legalname as company_name
      FROM package_orders po
      LEFT JOIN wallet_transactions wt ON po.billing_transaction_id = wt.id
      LEFT JOIN companies c ON po.company_id = c.id
      WHERE po.id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get billing log if exists
    const logResult = await db.query(`
      SELECT
        id, service_type, gross_amount, platform_cost, company_margin,
        commission_paid, created_at, processed_by_role
      FROM service_billing_log
      WHERE order_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [orderId])

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        trackingNumber: order.trackingnumber,
        totalAmount: parseFloat(order.totalamount || 0),
        billingStatus: order.billing_status || 'pending',
        billedAt: order.billed_at,
        billingTransactionId: order.billing_transaction_id,
        billingTransactionNumber: order.billing_transaction_number,
        companyName: order.company_name,
        billingLog: logResult.rows[0] ? {
          serviceType: logResult.rows[0].service_type,
          grossAmount: parseFloat(logResult.rows[0].gross_amount),
          platformCost: parseFloat(logResult.rows[0].platform_cost || 0),
          companyMargin: parseFloat(logResult.rows[0].company_margin || 0),
          commissionPaid: parseFloat(logResult.rows[0].commission_paid || 0),
          processedAt: logResult.rows[0].created_at,
          processedByRole: logResult.rows[0].processed_by_role
        } : null
      }
    })

  } catch (error) {
    console.error('Error in GET /api/billing/charge-service:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo estado de facturacion'
    }, { status: 500 })
  }
}
