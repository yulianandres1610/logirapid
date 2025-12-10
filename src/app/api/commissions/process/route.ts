import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/commissions/process
 *
 * Calculate and pay commission for a completed service.
 * This is an internal API called when a service is completed.
 *
 * Body:
 * {
 *   companyId: number,
 *   userId: number,        // Employee who performed the service
 *   userRole: string,
 *   serviceType: 'package_delivery' | 'recharge' | 'transfer' | etc.,
 *   serviceId: number,
 *   serviceReference: string,
 *   productId: number,
 *   productPrice: number
 * }
 *
 * Returns:
 * - commissionPaid: boolean
 * - amount: number (if paid)
 * - transactionId: number (if paid)
 * - transactionNumber: string (if paid)
 * - employeeNewBalance: number (if paid)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body
    const body = await request.json()
    const {
      companyId,
      userId,
      userRole,
      serviceType,
      serviceId,
      serviceReference,
      productId,
      productPrice
    } = body

    // Validate required fields
    if (!companyId || !userId || !userRole || !serviceType || !productId) {
      return NextResponse.json({
        success: false,
        error: 'Campos requeridos: companyId, userId, userRole, serviceType, productId'
      }, { status: 400 })
    }

    // Find commission configuration for this product/role
    // First try to find exact role match, then fall back to 'ALL'
    const configResult = await db.query(`
      SELECT
        ccc.*,
        pc.code as product_code,
        pc.name as product_name
      FROM company_commission_config ccc
      JOIN product_catalog pc ON ccc.product_id = pc.id
      WHERE ccc.company_id = $1
        AND ccc.product_id = $2
        AND (ccc.role = $3 OR ccc.role = 'ALL')
        AND ccc.is_active = true
      ORDER BY CASE WHEN ccc.role = $3 THEN 0 ELSE 1 END
      LIMIT 1
    `, [companyId, productId, userRole])

    // No commission configured for this product/role
    if (configResult.rows.length === 0) {
      console.log(`[Commission] No config found for company ${companyId}, product ${productId}, role ${userRole}`)
      return NextResponse.json({
        success: true,
        data: {
          commissionPaid: false,
          reason: 'No hay comision configurada para este producto/rol'
        }
      })
    }

    const config = configResult.rows[0]
    const price = productPrice || parseFloat(config.platform_price || 0)

    // Calculate commission amount
    let commissionAmount = 0
    if (config.commission_type === 'fixed') {
      commissionAmount = parseFloat(config.commission_value)
    } else { // percentage
      commissionAmount = price * (parseFloat(config.commission_value) / 100)

      // Apply min/max constraints
      if (config.min_amount && commissionAmount < parseFloat(config.min_amount)) {
        commissionAmount = parseFloat(config.min_amount)
      }
      if (config.max_amount && commissionAmount > parseFloat(config.max_amount)) {
        commissionAmount = parseFloat(config.max_amount)
      }
    }

    // Round to 2 decimals
    commissionAmount = Math.round(commissionAmount * 100) / 100

    // Don't process if commission is 0 or negative
    if (commissionAmount <= 0) {
      console.log(`[Commission] Calculated amount is ${commissionAmount}, skipping`)
      return NextResponse.json({
        success: true,
        data: {
          commissionPaid: false,
          reason: 'Monto de comision calculado es 0'
        }
      })
    }

    // Get user's current wallet balance and wallet number
    const userResult = await db.query(`
      SELECT id, firstname, lastname, email, wallet_number, wallet_balance
      FROM users
      WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    const user = userResult.rows[0]

    // Generate transaction number
    const txnNumber = `COM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Execute transaction using db.transaction()
    const result = await db.transaction(async (client) => {
      // 1. Create wallet transaction
      const txnResult = await client.query(`
        INSERT INTO wallet_transactions (
          transaction_number,
          type,
          source_type,
          source_company_id,
          target_type,
          target_user_id,
          target_wallet_number,
          amount,
          fee,
          total_amount,
          payment_method,
          status,
          description,
          notes,
          created_at,
          completed_at
        ) VALUES (
          $1, 'commission', 'company', $2, 'user', $3, $4, $5, 0, $5, 'wallet', 'completed',
          $6, $7, NOW(), NOW()
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

      // 2. Update user's wallet balance
      const newBalanceResult = await client.query(`
        UPDATE users
        SET wallet_balance = COALESCE(wallet_balance, 0) + $1
        WHERE id = $2
        RETURNING wallet_balance
      `, [commissionAmount, userId])

      const newBalance = parseFloat(newBalanceResult.rows[0].wallet_balance)

      // 3. Record in employee_commissions history
      await client.query(`
        INSERT INTO employee_commissions (
          company_id,
          user_id,
          user_role,
          service_type,
          service_id,
          service_reference,
          product_id,
          product_name,
          product_price,
          commission_config_id,
          commission_type,
          commission_rate,
          commission_amount,
          transaction_id,
          transaction_number,
          status,
          created_at,
          paid_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'paid', NOW(), NOW()
        )
      `, [
        companyId,
        userId,
        userRole,
        serviceType,
        serviceId,
        serviceReference,
        productId,
        config.product_name,
        price,
        config.id,
        config.commission_type,
        config.commission_value,
        commissionAmount,
        transaction.id,
        transaction.transaction_number
      ])

      return {
        transaction,
        newBalance
      }
    })

    console.log(`[Commission] Paid $${commissionAmount} to user ${userId} (${user.email}) for ${serviceType} ${serviceReference}`)

    return NextResponse.json({
      success: true,
      data: {
        commissionPaid: true,
        amount: commissionAmount,
        transactionId: result.transaction.id,
        transactionNumber: result.transaction.transaction_number,
        employeeNewBalance: result.newBalance,
        productName: config.product_name,
        commissionType: config.commission_type,
        commissionRate: parseFloat(config.commission_value)
      }
    })

  } catch (error) {
    console.error('Error in POST /api/commissions/process:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error procesando comision'
    }, { status: 500 })
  }
}

/**
 * GET /api/commissions/process
 *
 * Test/check endpoint for commission calculation (does not pay)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const productId = searchParams.get('productId')
    const userRole = searchParams.get('role')
    const price = searchParams.get('price')

    if (!companyId || !productId || !userRole) {
      return NextResponse.json({
        success: false,
        error: 'Parametros requeridos: companyId, productId, role'
      }, { status: 400 })
    }

    // Find commission configuration
    const configResult = await db.query(`
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
      return NextResponse.json({
        success: true,
        data: {
          hasCommission: false,
          message: 'No hay comision configurada para este producto/rol'
        }
      })
    }

    const config = configResult.rows[0]
    const productPrice = price ? parseFloat(price) : parseFloat(config.platform_price || 0)

    // Calculate commission
    let calculatedAmount = 0
    if (config.commission_type === 'fixed') {
      calculatedAmount = parseFloat(config.commission_value)
    } else {
      calculatedAmount = productPrice * (parseFloat(config.commission_value) / 100)
      if (config.min_amount && calculatedAmount < parseFloat(config.min_amount)) {
        calculatedAmount = parseFloat(config.min_amount)
      }
      if (config.max_amount && calculatedAmount > parseFloat(config.max_amount)) {
        calculatedAmount = parseFloat(config.max_amount)
      }
    }

    calculatedAmount = Math.round(calculatedAmount * 100) / 100

    return NextResponse.json({
      success: true,
      data: {
        hasCommission: true,
        configId: config.id,
        productName: config.product_name,
        productCode: config.product_code,
        role: config.role,
        commissionType: config.commission_type,
        commissionValue: parseFloat(config.commission_value),
        minAmount: config.min_amount ? parseFloat(config.min_amount) : null,
        maxAmount: config.max_amount ? parseFloat(config.max_amount) : null,
        productPrice,
        calculatedAmount,
        formula: config.commission_type === 'fixed'
          ? `Fixed: $${config.commission_value}`
          : `${config.commission_value}% of $${productPrice} = $${calculatedAmount}`
      }
    })

  } catch (error) {
    console.error('Error in GET /api/commissions/process:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error calculando comision'
    }, { status: 500 })
  }
}
