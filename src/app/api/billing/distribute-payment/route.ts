import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateRuntimeCommissions } from '@/lib/commission-validation'

interface ServiceItem {
  productId?: number
  productCode?: string
  name: string
  quantity: number
  unitPrice: number
  costPrice?: number  // mi_costo - provider cost
  subtotal: number
  providerCompanyId?: number  // Product's provider
  // New fields for service-level tracking
  boxTrackingId?: number
  boxTrackingCode?: string
  serviceId?: number     // product_service.id
  serviceCode?: string   // Service code from product_services
  serviceName?: string   // Service name from product_services
}

interface CommissionBreakdownItem {
  userId: number
  userRole: string
  userName: string
  activityType: 'creation' | 'delivery' | 'packing'
  productId?: number
  productName?: string
  // New service-level fields
  serviceId?: number
  serviceCode?: string
  serviceName?: string
  amount: number
  transactionId?: number
  marginWarning?: string  // Warning if commission exceeds margin
}

interface ProviderPaymentItem {
  providerCompanyId: number
  providerName: string
  productId: number
  productName: string
  amount: number
  transactionId?: number
}

/**
 * POST /api/billing/distribute-payment
 *
 * Complete payment distribution for a delivered order:
 * 1. Debit company wallet for gross amount
 * 2. Pay commission to order CREATOR (activity_type='creation')
 * 3. Pay commission to order COMPLETER (activity_type='delivery')
 * 4. Pay provider their cost (mi_costo) for each product
 * 5. Keep platform fee (platform_fee_percentage from companies)
 * 6. Record everything in payment_distribution table
 *
 * Body:
 * {
 *   orderId: number,           // package_order.id
 *   companyId: number,
 *   completedByUserId: number, // User who completed/delivered
 *   completedByRole: string,
 *   chargeType: 'delivery' | 'pickup' | 'warehouse'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      orderId,
      companyId,
      completedByUserId,
      completedByRole,
      chargeType = 'delivery'
    } = body

    // Validate required fields
    if (!orderId || !companyId) {
      return NextResponse.json({
        success: false,
        error: 'Campos requeridos: orderId, companyId'
      }, { status: 400 })
    }

    const result = await db.transaction(async (client) => {
      // ========================================
      // STEP 1: Get order with participants info
      // ========================================
      const orderResult = await client.query(`
        SELECT
          po.id, po.services, po.totalamount, po.billing_status,
          po.company_id, po.recipientname, po.trackingnumber,
          po.created_by_user_id, po.completed_by_user_id,
          op.created_by_user_id as participant_creator_id,
          op.created_by_role as participant_creator_role,
          op.completed_by_user_id as participant_completer_id,
          op.completed_by_role as participant_completer_role
        FROM package_orders po
        LEFT JOIN order_participants op ON po.id = op.order_id
        WHERE po.id = $1
      `, [orderId])

      if (orderResult.rows.length === 0) {
        throw new Error('Orden no encontrada')
      }

      const order = orderResult.rows[0]

      // Check if already billed
      if (order.billing_status === 'charged') {
        return {
          success: false,
          reason: 'La orden ya fue facturada',
          alreadyBilled: true
        }
      }

      // Verify company matches
      if (order.company_id !== companyId) {
        throw new Error('La orden no pertenece a esta empresa')
      }

      const grossAmount = parseFloat(order.totalamount || 0)
      let services: ServiceItem[] = []

      try {
        services = typeof order.services === 'string'
          ? JSON.parse(order.services || '[]')
          : (order.services || [])
      } catch {
        services = []
      }

      // If no amount to charge, skip
      if (grossAmount <= 0) {
        await client.query(`
          UPDATE package_orders
          SET billing_status = 'charged', billed_at = NOW()
          WHERE id = $1
        `, [orderId])

        return {
          success: true,
          charged: true,
          grossAmount: 0,
          reason: 'Sin monto a cobrar',
          zeroAmount: true
        }
      }

      // ========================================
      // STEP 2: Get company and platform fee info
      // ========================================
      const companyResult = await client.query(`
        SELECT
          id, legalname,
          COALESCE(walletbalance, 0) as walletbalance,
          COALESCE(credit_limit, -200) as credit_limit,
          COALESCE(credit_enabled, false) as credit_enabled,
          COALESCE(platform_fee_percentage, 10.00) as platform_fee_percentage
        FROM companies WHERE id = $1
      `, [companyId])

      if (companyResult.rows.length === 0) {
        throw new Error('Empresa no encontrada')
      }

      const company = companyResult.rows[0]
      const currentBalance = parseFloat(company.walletbalance)
      const creditLimit = parseFloat(company.credit_limit)
      const creditEnabled = company.credit_enabled
      const platformFeePercentage = parseFloat(company.platform_fee_percentage)

      // ========================================
      // STEP 3: Check sufficient balance/credit
      // ========================================
      const newBalance = currentBalance - grossAmount

      if (!creditEnabled && newBalance < 0) {
        await client.query(`
          UPDATE package_orders SET billing_status = 'failed' WHERE id = $1
        `, [orderId])

        return {
          success: false,
          reason: 'Saldo insuficiente',
          currentBalance,
          required: grossAmount,
          insufficientFunds: true
        }
      }

      if (creditEnabled && newBalance < creditLimit) {
        await client.query(`
          UPDATE package_orders SET billing_status = 'failed' WHERE id = $1
        `, [orderId])

        return {
          success: false,
          reason: 'Excede limite de credito',
          currentBalance,
          creditLimit,
          required: grossAmount,
          exceedsCreditLimit: true
        }
      }

      // ========================================
      // STEP 4: Debit company wallet
      // ========================================
      await client.query(`
        UPDATE companies
        SET walletbalance = walletbalance - $1,
            negative_since = CASE
              WHEN walletbalance - $1 < 0 AND negative_since IS NULL
              THEN NOW() ELSE negative_since END
        WHERE id = $2
      `, [grossAmount, companyId])

      // Create debit transaction
      const txnNumber = `DIST-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const debitTxn = await client.query(`
        INSERT INTO wallet_transactions (
          transaction_number, type, source_type, source_company_id,
          target_type, amount, fee, total_amount, payment_method, status,
          description, notes, metadata, created_at, completed_at
        ) VALUES (
          $1, 'service_charge', 'company', $2, 'platform', $3, 0, $3,
          'wallet', 'completed', $4, $5, $6, NOW(), NOW()
        )
        RETURNING id, transaction_number
      `, [
        txnNumber,
        companyId,
        grossAmount,
        `Distribución de pago - Orden #${orderId}`,
        `Tracking: ${order.trackingnumber || 'N/A'} | Tipo: ${chargeType}`,
        JSON.stringify({
          orderId,
          chargeType,
          services,
          completedByUserId,
          completedByRole,
          distributionType: 'multi-user'
        })
      ])

      const debitTransaction = debitTxn.rows[0]

      // ========================================
      // STEP 5: Identify participants
      // ========================================
      // Creator: from order_participants or package_orders.created_by_user_id
      const creatorUserId = order.participant_creator_id || order.created_by_user_id
      const creatorRole = order.participant_creator_role || 'USER'

      // Completer: from params or order_participants
      const completerUserId = completedByUserId || order.participant_completer_id || order.completed_by_user_id
      const completerRole = completedByRole || order.participant_completer_role || 'DRIVER'

      // ========================================
      // STEP 6: Enrich services with provider info
      // ========================================
      let totalProviderCost = 0
      const enrichedServices: ServiceItem[] = []

      for (const service of services) {
        const enriched = { ...service }

        if (service.productId) {
          // Get provider info from product_catalog
          const productResult = await client.query(`
            SELECT
              pc.id, pc.name, pc.platform_price, pc.provider_company_id,
              prov.legalname as provider_name
            FROM product_catalog pc
            LEFT JOIN companies prov ON pc.provider_company_id = prov.id
            WHERE pc.id = $1
          `, [service.productId])

          if (productResult.rows.length > 0) {
            const product = productResult.rows[0]
            enriched.providerCompanyId = product.provider_company_id

            // costPrice = mi_costo (provider cost)
            if (service.costPrice) {
              totalProviderCost += service.costPrice * (service.quantity || 1)
            }
          }
        }

        enrichedServices.push(enriched)
      }

      // ========================================
      // STEP 7: Calculate distribution amounts
      // ========================================
      const platformFee = Math.round(grossAmount * (platformFeePercentage / 100) * 100) / 100

      // Company profit = gross - provider cost - platform fee - commissions (calculated next)
      let totalCommissions = 0
      const commissionBreakdown: CommissionBreakdownItem[] = []
      const providerPayments: ProviderPaymentItem[] = []

      // ========================================
      // STEP 8: Process CREATION commissions (to creator)
      // ========================================
      if (creatorUserId) {
        for (const service of enrichedServices) {
          if (service.productId) {
            const commResult = await processActivityCommission(client, {
              companyId,
              userId: creatorUserId,
              userRole: creatorRole,
              activityType: 'creation',
              productId: service.productId,
              productPrice: service.subtotal,
              orderId,
              orderReference: order.trackingnumber
            })

            if (commResult.paid) {
              totalCommissions += commResult.amount
              commissionBreakdown.push({
                userId: creatorUserId,
                userRole: creatorRole,
                userName: commResult.userName || '',
                activityType: 'creation',
                productId: service.productId,
                productName: service.name,
                amount: commResult.amount,
                transactionId: commResult.transactionId
              })
            }
          }
        }
      }

      // ========================================
      // STEP 9: Process DELIVERY commissions (to completer)
      // ========================================
      if (completerUserId && completerUserId !== creatorUserId) {
        // Only process if completer is different from creator
        for (const service of enrichedServices) {
          if (service.productId) {
            const commResult = await processActivityCommission(client, {
              companyId,
              userId: completerUserId,
              userRole: completerRole,
              activityType: 'delivery',
              productId: service.productId,
              productPrice: service.subtotal,
              orderId,
              orderReference: order.trackingnumber
            })

            if (commResult.paid) {
              totalCommissions += commResult.amount
              commissionBreakdown.push({
                userId: completerUserId,
                userRole: completerRole,
                userName: commResult.userName || '',
                activityType: 'delivery',
                productId: service.productId,
                productName: service.name,
                amount: commResult.amount,
                transactionId: commResult.transactionId
              })
            }
          }
        }
      } else if (completerUserId && completerUserId === creatorUserId) {
        // Same user created and completed - pay both commission types
        for (const service of enrichedServices) {
          if (service.productId) {
            const commResult = await processActivityCommission(client, {
              companyId,
              userId: completerUserId,
              userRole: completerRole,
              activityType: 'delivery',
              productId: service.productId,
              productPrice: service.subtotal,
              orderId,
              orderReference: order.trackingnumber
            })

            if (commResult.paid) {
              totalCommissions += commResult.amount
              commissionBreakdown.push({
                userId: completerUserId,
                userRole: completerRole,
                userName: commResult.userName || '',
                activityType: 'delivery',
                productId: service.productId,
                productName: service.name,
                amount: commResult.amount,
                transactionId: commResult.transactionId
              })
            }
          }
        }
      }

      // ========================================
      // STEP 9.5: Process SERVICE-LEVEL commissions from service_sales
      // For composite products with box tracking (paquetería)
      // ========================================
      const serviceSalesResult = await client.query(`
        SELECT DISTINCT ss.*, bt.tracking_code
        FROM service_sales ss
        JOIN box_tracking bt ON ss.box_tracking_id = bt.id
        WHERE ss.package_order_id = $1 AND ss.status IN ('paid', 'completed')
      `, [orderId])

      if (serviceSalesResult.rows.length > 0) {
        // Process packing/confección commissions
        for (const sale of serviceSalesResult.rows) {
          if (sale.service_code === 'confeccion' || sale.service_code === 'packing') {
            // Pay commission for packing activity
            const packingCommResult = await processActivityCommission(client, {
              companyId,
              userId: sale.sold_by_user_id || completerUserId || creatorUserId,
              userRole: 'USER',
              activityType: 'packing',
              productId: sale.product_service_id ? undefined : null,
              productPrice: parseFloat(sale.total) || 0,
              orderId,
              orderReference: order.trackingnumber,
              serviceId: sale.product_service_id,
              serviceCode: sale.service_code
            })

            if (packingCommResult.paid) {
              totalCommissions += packingCommResult.amount
              commissionBreakdown.push({
                userId: sale.sold_by_user_id || completerUserId || creatorUserId,
                userRole: 'USER',
                userName: packingCommResult.userName || sale.sold_by_user_name || '',
                activityType: 'packing',
                serviceId: sale.product_service_id,
                serviceCode: sale.service_code,
                serviceName: sale.service_name,
                amount: packingCommResult.amount,
                transactionId: packingCommResult.transactionId
              })
            }
          }
        }
      }

      // ========================================
      // STEP 9.6: Runtime margin validation
      // Warn but don't block if commissions exceed margin
      // ========================================
      let marginWarnings: string[] = []
      const productIdsWithCommissions = new Set<number>(
        enrichedServices.filter(s => s.productId).map(s => s.productId as number)
      )

      for (const productId of productIdsWithCommissions) {
        try {
          const validation = await validateRuntimeCommissions(companyId, productId, totalCommissions)
          if (!validation.isWithinMargin && validation.warning) {
            marginWarnings.push(validation.warning)
            console.warn(`[Distribute-Payment] ${validation.warning}`)
          }
        } catch (e) {
          // Skip validation if it fails
        }
      }

      // ========================================
      // STEP 10: Pay providers (mi_costo)
      // ========================================
      const providerMap = new Map<number, { name: string; total: number; products: any[] }>()

      for (const service of enrichedServices) {
        if (service.providerCompanyId && service.costPrice && service.costPrice > 0) {
          const providerCost = service.costPrice * (service.quantity || 1)

          if (!providerMap.has(service.providerCompanyId)) {
            // Get provider name
            const provResult = await client.query(`
              SELECT legalname FROM companies WHERE id = $1
            `, [service.providerCompanyId])

            providerMap.set(service.providerCompanyId, {
              name: provResult.rows[0]?.legalname || 'Unknown Provider',
              total: 0,
              products: []
            })
          }

          const providerData = providerMap.get(service.providerCompanyId)!
          providerData.total += providerCost
          providerData.products.push({
            productId: service.productId,
            productName: service.name,
            quantity: service.quantity,
            costPrice: service.costPrice,
            subtotal: providerCost
          })
        }
      }

      // Execute provider payments
      for (const [providerCompanyId, providerData] of providerMap) {
        if (providerData.total > 0) {
          const provPayResult = await payProvider(client, {
            fromCompanyId: companyId,
            toCompanyId: providerCompanyId,
            amount: providerData.total,
            orderId,
            orderReference: order.trackingnumber,
            products: providerData.products
          })

          if (provPayResult.paid) {
            for (const prod of providerData.products) {
              providerPayments.push({
                providerCompanyId,
                providerName: providerData.name,
                productId: prod.productId,
                productName: prod.productName,
                amount: prod.subtotal,
                transactionId: provPayResult.transactionId
              })
            }
          }
        }
      }

      // ========================================
      // STEP 11: Calculate final company profit
      // ========================================
      const companyProfit = grossAmount - totalProviderCost - platformFee - totalCommissions

      // ========================================
      // STEP 12: Update order and participants
      // ========================================
      await client.query(`
        UPDATE package_orders
        SET billing_status = 'charged',
            billed_at = NOW(),
            billing_transaction_id = $1,
            completed_by_user_id = $2
        WHERE id = $3
      `, [debitTransaction.id, completerUserId, orderId])

      // Update order_participants with completer info
      await client.query(`
        UPDATE order_participants
        SET completed_by_user_id = $1,
            completed_by_role = $2,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE order_id = $3
      `, [completerUserId, completerRole, orderId])

      // ========================================
      // STEP 13: Create billing log
      // ========================================
      const billingLogResult = await client.query(`
        INSERT INTO service_billing_log (
          company_id, order_id, service_type,
          gross_amount, platform_cost, company_margin, commission_paid,
          debit_transaction_id, processed_by, processed_by_role,
          products, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
        )
        RETURNING id
      `, [
        companyId, orderId, chargeType,
        grossAmount, totalProviderCost, companyProfit, totalCommissions,
        debitTransaction.id, completerUserId, completerRole,
        JSON.stringify(enrichedServices)
      ])

      // ========================================
      // STEP 14: Create payment_distribution record
      // ========================================
      await client.query(`
        INSERT INTO payment_distribution (
          order_id, company_id, billing_log_id,
          gross_amount, provider_cost, platform_fee, company_profit, total_commissions,
          status, products, commission_breakdown, provider_payments,
          processed_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'processed', $9, $10, $11, NOW(), NOW()
        )
      `, [
        orderId, companyId, billingLogResult.rows[0].id,
        grossAmount, totalProviderCost, platformFee, companyProfit, totalCommissions,
        JSON.stringify(enrichedServices),
        JSON.stringify(commissionBreakdown),
        JSON.stringify(providerPayments)
      ])

      // ========================================
      // STEP 15: Log activity
      // ========================================
      if (completerUserId) {
        await client.query(`
          INSERT INTO order_activity_log (
            order_id, company_id, user_id, user_role, activity_type,
            previous_status, new_status, metadata, source
          ) VALUES ($1, $2, $3, $4, 'payment_distributed', 'delivered', 'completed', $5, 'system')
        `, [
          orderId, companyId, completerUserId, completerRole,
          JSON.stringify({
            grossAmount,
            providerCost: totalProviderCost,
            platformFee,
            totalCommissions,
            companyProfit,
            commissionBreakdown: commissionBreakdown.length,
            providerPayments: providerPayments.length
          })
        ])
      }

      // Get updated company balance
      const updatedCompany = await client.query(`
        SELECT walletbalance FROM companies WHERE id = $1
      `, [companyId])

      return {
        success: true,
        charged: true,
        distribution: {
          grossAmount,
          providerCost: totalProviderCost,
          platformFee,
          platformFeePercentage,
          totalCommissions,
          companyProfit
        },
        debitTransactionId: debitTransaction.id,
        debitTransactionNumber: debitTransaction.transaction_number,
        companyNewBalance: parseFloat(updatedCompany.rows[0]?.walletbalance || 0),
        commissions: {
          total: totalCommissions,
          breakdown: commissionBreakdown
        },
        providerPayments: {
          total: totalProviderCost,
          payments: providerPayments
        },
        participants: {
          creator: creatorUserId ? { userId: creatorUserId, role: creatorRole } : null,
          completer: completerUserId ? { userId: completerUserId, role: completerRole } : null
        }
      }
    })

    console.log(`[Distribute-Payment] Order ${orderId}: ${result.success ? 'distributed' : 'failed'} - ${result.reason || `$${result.distribution?.grossAmount}`}`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in POST /api/billing/distribute-payment:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error procesando distribución de pago'
    }, { status: 500 })
  }
}

/**
 * Process commission for a specific activity type (creation, delivery, or packing)
 * Supports both product-level and service-level commissions
 */
async function processActivityCommission(
  client: any,
  params: {
    companyId: number
    userId: number
    userRole: string
    activityType: 'creation' | 'delivery' | 'packing'
    productId?: number | null
    productPrice: number
    orderId: number
    orderReference?: string
    // New service-level params
    serviceId?: number
    serviceCode?: string
  }
): Promise<{ paid: boolean; amount: number; transactionId?: number; userName?: string }> {
  try {
    const { companyId, userId, userRole, activityType, productId, productPrice, orderId, orderReference, serviceId, serviceCode } = params

    // If no productId and no serviceId, can't calculate commission
    if (!productId && !serviceId) {
      return { paid: false, amount: 0 }
    }

    let effectiveProductId = productId
    let servicePriceInfo: { serviceName: string; basePrice: number } | null = null

    // If we have a serviceId but no productId, look up the product from product_services
    if (serviceId && !productId) {
      const serviceResult = await client.query(`
        SELECT ps.*, pc.id as catalog_product_id, pc.name as catalog_product_name
        FROM product_services ps
        LEFT JOIN product_catalog pc ON ps.product_id = pc.id
        WHERE ps.id = $1
      `, [serviceId])

      if (serviceResult.rows.length > 0) {
        const serviceRow = serviceResult.rows[0]
        // Try to use the catalog product, otherwise use the product_services.product_id
        effectiveProductId = serviceRow.catalog_product_id || serviceRow.product_id
        servicePriceInfo = {
          serviceName: serviceRow.service_name,
          basePrice: parseFloat(serviceRow.base_price) || 0
        }
      }
    }

    // If still no productId, we can't find commission config
    if (!effectiveProductId) {
      console.warn(`[Activity Commission] No effective productId found for serviceId=${serviceId}`)
      return { paid: false, amount: 0 }
    }

    // Find commission configuration for this activity type
    // First try to find by service-specific config, then fall back to product-level
    let configResult = await client.query(`
      SELECT
        ccc.*,
        pc.code as product_code,
        pc.name as product_name,
        pc.platform_price,
        ps.service_name,
        ps.base_price as service_base_price
      FROM company_commission_config ccc
      JOIN product_catalog pc ON ccc.product_id = pc.id
      LEFT JOIN product_services ps ON ccc.product_service_id = ps.id
      WHERE ccc.company_id = $1
        AND ccc.product_id = $2
        AND (ccc.role = $3 OR ccc.role = 'ALL')
        AND ccc.activity_type = $4
        AND ccc.is_active = true
        AND (
          (ccc.product_service_id IS NOT NULL AND ccc.product_service_id = $5)
          OR (ccc.product_service_id IS NULL AND $5 IS NULL)
        )
      ORDER BY
        CASE WHEN ccc.product_service_id = $5 THEN 0 ELSE 1 END,
        CASE WHEN ccc.role = $3 THEN 0 ELSE 1 END
      LIMIT 1
    `, [companyId, effectiveProductId, userRole, activityType, serviceId || null])

    // If no service-specific config found, try product-level config
    if (configResult.rows.length === 0 && serviceId) {
      configResult = await client.query(`
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
          AND ccc.activity_type = $4
          AND ccc.is_active = true
          AND ccc.product_service_id IS NULL
        ORDER BY CASE WHEN ccc.role = $3 THEN 0 ELSE 1 END
        LIMIT 1
      `, [companyId, effectiveProductId, userRole, activityType])
    }

    if (configResult.rows.length === 0) {
      // No commission config for this activity type, try default 'delivery'
      if (activityType !== 'delivery') {
        return { paid: false, amount: 0 }
      }

      // Fallback: Check for configs without activity_type specified
      const fallbackConfig = await client.query(`
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
          AND (ccc.activity_type IS NULL OR ccc.activity_type = 'delivery')
          AND ccc.is_active = true
        ORDER BY CASE WHEN ccc.role = $3 THEN 0 ELSE 1 END
        LIMIT 1
      `, [companyId, effectiveProductId, userRole])

      if (fallbackConfig.rows.length === 0) {
        return { paid: false, amount: 0 }
      }

      configResult.rows = fallbackConfig.rows
    }

    const config = configResult.rows[0]
    // Use service base price if available, then productPrice, then platform_price
    const price = productPrice || (servicePriceInfo?.basePrice) || parseFloat(config.platform_price || 0)

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
      SELECT id, firstname, lastname, email, wallet_number, wallet_balance
      FROM users WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return { paid: false, amount: 0 }
    }

    const user = userResult.rows[0]
    const userName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email

    // Generate transaction number
    const txnNumber = `COM-${activityType.toUpperCase().substring(0, 3)}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Determine the display name for the commission
    const activityLabel = activityType === 'creation' ? 'por creación' :
                          activityType === 'packing' ? 'por confección' : 'por entrega'
    const itemName = servicePriceInfo?.serviceName || config.service_name || config.product_name

    // Create commission transaction
    const txnResult = await client.query(`
      INSERT INTO wallet_transactions (
        transaction_number, type, source_type, source_company_id,
        target_type, target_user_id, target_wallet_number,
        amount, fee, total_amount, payment_method, status,
        description, notes, metadata, created_at, completed_at
      ) VALUES (
        $1, 'commission', 'company', $2, 'user', $3, $4, $5, 0, $5,
        'wallet', 'completed', $6, $7, $8, NOW(), NOW()
      )
      RETURNING id, transaction_number
    `, [
      txnNumber,
      companyId,
      userId,
      user.wallet_number,
      commissionAmount,
      `Comision ${activityLabel} - ${itemName}`,
      `Orden: ${orderReference || orderId}${serviceCode ? ` | Servicio: ${serviceCode}` : ''}`,
      JSON.stringify({
        orderId,
        activityType,
        productId: effectiveProductId,
        serviceId: serviceId || null,
        serviceCode: serviceCode || null,
        configId: config.id
      })
    ])

    const transaction = txnResult.rows[0]

    // Update user balance
    await client.query(`
      UPDATE users
      SET wallet_balance = COALESCE(wallet_balance, 0) + $1
      WHERE id = $2
    `, [commissionAmount, userId])

    // Record in employee_commissions
    await client.query(`
      INSERT INTO employee_commissions (
        company_id, user_id, user_role, service_type, service_id,
        service_reference, product_id, product_name, product_price,
        product_service_id, product_service_code, product_service_name,
        commission_config_id, commission_type, commission_rate, commission_amount,
        transaction_id, transaction_number, status, created_at, paid_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, 'paid', NOW(), NOW()
      )
    `, [
      companyId, userId, userRole, activityType, orderId,
      orderReference, effectiveProductId, config.product_name, price,
      serviceId || null, serviceCode || null, servicePriceInfo?.serviceName || config.service_name || null,
      config.id, config.commission_type, config.commission_value, commissionAmount,
      transaction.id, transaction.transaction_number
    ])

    return {
      paid: true,
      amount: commissionAmount,
      transactionId: transaction.id,
      userName
    }
  } catch (error) {
    console.error('[Activity Commission] Error:', error)
    return { paid: false, amount: 0 }
  }
}

/**
 * Pay provider company for their product cost (mi_costo)
 */
async function payProvider(
  client: any,
  params: {
    fromCompanyId: number
    toCompanyId: number
    amount: number
    orderId: number
    orderReference?: string
    products: any[]
  }
): Promise<{ paid: boolean; transactionId?: number }> {
  try {
    const { fromCompanyId, toCompanyId, amount, orderId, orderReference, products } = params

    if (amount <= 0) {
      return { paid: false }
    }

    // Get provider info
    const providerResult = await client.query(`
      SELECT id, legalname, walletnumber, walletbalance
      FROM companies WHERE id = $1
    `, [toCompanyId])

    if (providerResult.rows.length === 0) {
      console.error(`[Provider Payment] Provider company ${toCompanyId} not found`)
      return { paid: false }
    }

    const provider = providerResult.rows[0]

    // Generate transaction number
    const txnNumber = `PROV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create provider payment transaction
    const txnResult = await client.query(`
      INSERT INTO wallet_transactions (
        transaction_number, type, source_type, source_company_id,
        target_type, target_company_id, target_wallet_number,
        amount, fee, total_amount, payment_method, status,
        description, notes, metadata, created_at, completed_at
      ) VALUES (
        $1, 'provider_payment', 'platform', $2, 'company', $3, $4, $5, 0, $5,
        'wallet', 'completed', $6, $7, $8, NOW(), NOW()
      )
      RETURNING id, transaction_number
    `, [
      txnNumber,
      fromCompanyId,
      toCompanyId,
      provider.walletnumber,
      amount,
      `Pago a proveedor - ${provider.legalname}`,
      `Orden: ${orderReference || orderId}`,
      JSON.stringify({
        orderId,
        products,
        fromCompanyId,
        toCompanyId
      })
    ])

    const transaction = txnResult.rows[0]

    // Credit provider wallet
    await client.query(`
      UPDATE companies
      SET walletbalance = COALESCE(walletbalance, 0) + $1
      WHERE id = $2
    `, [amount, toCompanyId])

    return {
      paid: true,
      transactionId: transaction.id
    }
  } catch (error) {
    console.error('[Provider Payment] Error:', error)
    return { paid: false }
  }
}

/**
 * GET /api/billing/distribute-payment
 *
 * Get payment distribution details for an order
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

    // Get distribution info
    const distResult = await db.query(`
      SELECT
        pd.*,
        po.trackingnumber,
        po.totalamount,
        po.billing_status,
        c.legalname as company_name
      FROM payment_distribution pd
      JOIN package_orders po ON pd.order_id = po.id
      JOIN companies c ON pd.company_id = c.id
      WHERE pd.order_id = $1
      ORDER BY pd.created_at DESC
      LIMIT 1
    `, [orderId])

    if (distResult.rows.length === 0) {
      // Check if order exists
      const orderCheck = await db.query(`
        SELECT id, billing_status FROM package_orders WHERE id = $1
      `, [orderId])

      if (orderCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden no encontrada'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId: parseInt(orderId),
          distributed: false,
          billingStatus: orderCheck.rows[0].billing_status
        }
      })
    }

    const dist = distResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orderId: dist.order_id,
        distributed: true,
        trackingNumber: dist.trackingnumber,
        companyName: dist.company_name,
        status: dist.status,
        distribution: {
          grossAmount: parseFloat(dist.gross_amount),
          providerCost: parseFloat(dist.provider_cost || 0),
          platformFee: parseFloat(dist.platform_fee || 0),
          companyProfit: parseFloat(dist.company_profit || 0),
          totalCommissions: parseFloat(dist.total_commissions || 0)
        },
        commissionBreakdown: dist.commission_breakdown || [],
        providerPayments: dist.provider_payments || [],
        processedAt: dist.processed_at,
        createdAt: dist.created_at
      }
    })

  } catch (error) {
    console.error('Error in GET /api/billing/distribute-payment:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo distribución'
    }, { status: 500 })
  }
}
