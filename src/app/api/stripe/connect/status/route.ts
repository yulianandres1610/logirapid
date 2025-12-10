import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { getConnectAccount } from '@/lib/stripe'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/stripe/connect/status
 *
 * Get the Stripe Connect account status for a company or driver
 *
 * Query params:
 * - entityType: 'company' | 'user'
 * - entityId: number
 *
 * Returns:
 * - connected: boolean (true if account is fully set up)
 * - status: 'not_connected' | 'pending' | 'active' | 'restricted'
 * - payoutsEnabled: boolean
 * - chargesEnabled: boolean
 * - detailsSubmitted: boolean
 * - canCashout: boolean (shorthand for payouts + balance check)
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    // Validate required fields
    if (!entityType || !entityId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan parámetros: entityType, entityId'
      }, { status: 400 })
    }

    if (!['company', 'user'].includes(entityType)) {
      return NextResponse.json({
        success: false,
        error: 'entityType debe ser "company" o "user"'
      }, { status: 400 })
    }

    const entityIdNum = parseInt(entityId)

    // Verify permissions
    if (entityType === 'company') {
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== entityIdNum) {
        return NextResponse.json({
          success: false,
          error: 'No autorizado para ver esta empresa'
        }, { status: 403 })
      }
    } else {
      if (payload.role !== 'SUPER_ADMIN' && payload.userId !== entityIdNum) {
        return NextResponse.json({
          success: false,
          error: 'No autorizado para ver este usuario'
        }, { status: 403 })
      }
    }

    let stripeAccountId: string | null = null
    let localStatus: string = 'not_connected'
    let localPayoutsEnabled: boolean = false
    let localChargesEnabled: boolean = false
    let localDetailsSubmitted: boolean = false
    let connectedAt: string | null = null
    let walletBalance: number = 0
    let walletNumber: string | null = null
    let entityName: string = ''

    if (entityType === 'company') {
      const result = await db.query(`
        SELECT
          legalname,
          stripe_account_id,
          stripe_account_status,
          stripe_payouts_enabled,
          stripe_charges_enabled,
          stripe_details_submitted,
          stripe_connected_at,
          COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
          COALESCE("walletNumber", walletnumber) as wallet_number
        FROM companies
        WHERE id = $1
      `, [entityIdNum])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada'
        }, { status: 404 })
      }

      const company = result.rows[0]
      entityName = company.legalname
      stripeAccountId = company.stripe_account_id
      localStatus = company.stripe_account_status || 'not_connected'
      localPayoutsEnabled = company.stripe_payouts_enabled || false
      localChargesEnabled = company.stripe_charges_enabled || false
      localDetailsSubmitted = company.stripe_details_submitted || false
      connectedAt = company.stripe_connected_at
      walletBalance = parseFloat(company.wallet_balance) || 0
      walletNumber = company.wallet_number

    } else {
      const result = await db.query(`
        SELECT
          firstname,
          lastname,
          stripe_account_id,
          stripe_account_status,
          stripe_payouts_enabled,
          stripe_charges_enabled,
          stripe_details_submitted,
          stripe_connected_at,
          COALESCE(wallet_balance, 0) as wallet_balance,
          wallet_number
        FROM users
        WHERE id = $1
      `, [entityIdNum])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      const user = result.rows[0]
      entityName = `${user.firstname} ${user.lastname}`.trim()
      stripeAccountId = user.stripe_account_id
      localStatus = user.stripe_account_status || 'not_connected'
      localPayoutsEnabled = user.stripe_payouts_enabled || false
      localChargesEnabled = user.stripe_charges_enabled || false
      localDetailsSubmitted = user.stripe_details_submitted || false
      connectedAt = user.stripe_connected_at
      walletBalance = parseFloat(user.wallet_balance) || 0
      walletNumber = user.wallet_number
    }

    // If no Stripe account, return local status only
    if (!stripeAccountId) {
      return NextResponse.json({
        success: true,
        data: {
          entityType,
          entityId: entityIdNum,
          entityName,
          connected: false,
          status: 'not_connected',
          payoutsEnabled: false,
          chargesEnabled: false,
          detailsSubmitted: false,
          canCashout: false,
          stripeAccountId: null,
          walletBalance,
          walletNumber,
          connectedAt: null,
          requirements: null
        }
      })
    }

    // Fetch live status from Stripe
    try {
      const account = await getConnectAccount(stripeAccountId)

      // Determine status
      let status: 'pending' | 'active' | 'restricted' = 'pending'
      if (account.details_submitted && account.payouts_enabled) {
        status = 'active'
      } else if (account.requirements?.disabled_reason) {
        status = 'restricted'
      }

      const payoutsEnabled = account.payouts_enabled || false
      const chargesEnabled = account.charges_enabled || false
      const detailsSubmitted = account.details_submitted || false

      // Update local database with latest status
      if (entityType === 'company') {
        await db.query(`
          UPDATE companies
          SET
            stripe_account_status = $1,
            stripe_payouts_enabled = $2,
            stripe_charges_enabled = $3,
            stripe_details_submitted = $4,
            stripe_connected_at = CASE
              WHEN stripe_connected_at IS NULL AND $2 = true THEN CURRENT_TIMESTAMP
              ELSE stripe_connected_at
            END
          WHERE id = $5
        `, [status, payoutsEnabled, chargesEnabled, detailsSubmitted, entityIdNum])
      } else {
        await db.query(`
          UPDATE users
          SET
            stripe_account_status = $1,
            stripe_payouts_enabled = $2,
            stripe_charges_enabled = $3,
            stripe_details_submitted = $4,
            stripe_connected_at = CASE
              WHEN stripe_connected_at IS NULL AND $2 = true THEN CURRENT_TIMESTAMP
              ELSE stripe_connected_at
            END
          WHERE id = $5
        `, [status, payoutsEnabled, chargesEnabled, detailsSubmitted, entityIdNum])
      }

      // Check if they can cashout
      const canCashout = payoutsEnabled && walletBalance > 0

      // Get requirements if any
      const requirements = account.requirements ? {
        currentlyDue: account.requirements.currently_due || [],
        eventuallyDue: account.requirements.eventually_due || [],
        pastDue: account.requirements.past_due || [],
        disabledReason: account.requirements.disabled_reason || null
      } : null

      return NextResponse.json({
        success: true,
        data: {
          entityType,
          entityId: entityIdNum,
          entityName,
          connected: status === 'active',
          status,
          payoutsEnabled,
          chargesEnabled,
          detailsSubmitted,
          canCashout,
          stripeAccountId,
          walletBalance,
          walletNumber,
          connectedAt: account.created ? new Date(account.created * 1000).toISOString() : null,
          requirements,
          // Additional info
          businessType: account.business_type,
          country: account.country,
          defaultCurrency: account.default_currency,
          externalAccounts: account.external_accounts?.data?.map((ea: any) => ({
            id: ea.id,
            type: ea.object,
            last4: ea.last4,
            bankName: ea.bank_name,
            currency: ea.currency,
            default: ea.default_for_currency
          })) || []
        }
      })

    } catch (stripeError: any) {
      // If Stripe account doesn't exist or is deleted
      if (stripeError.code === 'account_invalid' || stripeError.type === 'StripeInvalidRequestError') {
        // Clear the stripe account from database
        if (entityType === 'company') {
          await db.query(`
            UPDATE companies
            SET
              stripe_account_id = NULL,
              stripe_account_status = 'not_connected',
              stripe_payouts_enabled = false,
              stripe_charges_enabled = false,
              stripe_details_submitted = false,
              stripe_connected_at = NULL
            WHERE id = $1
          `, [entityIdNum])
        } else {
          await db.query(`
            UPDATE users
            SET
              stripe_account_id = NULL,
              stripe_account_status = 'not_connected',
              stripe_payouts_enabled = false,
              stripe_charges_enabled = false,
              stripe_details_submitted = false,
              stripe_connected_at = NULL
            WHERE id = $1
          `, [entityIdNum])
        }

        return NextResponse.json({
          success: true,
          data: {
            entityType,
            entityId: entityIdNum,
            entityName,
            connected: false,
            status: 'not_connected',
            payoutsEnabled: false,
            chargesEnabled: false,
            detailsSubmitted: false,
            canCashout: false,
            stripeAccountId: null,
            walletBalance,
            walletNumber,
            connectedAt: null,
            requirements: null,
            note: 'Cuenta Stripe no válida o eliminada. Por favor, inicie el proceso de conexión nuevamente.'
          }
        })
      }

      // Re-throw other errors
      throw stripeError
    }

  } catch (error) {
    console.error('Error getting Connect status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener estado de la cuenta'
    }, { status: 500 })
  }
}
