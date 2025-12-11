import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { deleteConnectAccount } from '@/lib/stripe'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/stripe/connect/disconnect
 *
 * Disconnects a Stripe Connect account from a company or user.
 * This permanently deletes the account from Stripe.
 *
 * Body: { entityType: 'company' | 'user', entityId: number }
 *
 * Permissions:
 * - For company: ADMIN, SUPER_ADMIN of that company, or global SUPER_ADMIN
 * - For user: The user themselves, or SUPER_ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Decode JWT to get user info
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { userId, role, companyId } = payload

    // Get request body
    const body = await request.json()
    const { entityType, entityId } = body

    if (!entityType || !entityId) {
      return NextResponse.json({
        success: false,
        error: 'entityType y entityId son requeridos'
      }, { status: 400 })
    }

    if (entityType !== 'company' && entityType !== 'user') {
      return NextResponse.json({
        success: false,
        error: 'entityType debe ser "company" o "user"'
      }, { status: 400 })
    }

    // Check permissions
    const isSuperAdmin = role === 'SUPER_ADMIN'
    const isAdmin = role === 'ADMIN'

    if (entityType === 'company') {
      // Only ADMIN/SUPER_ADMIN of the company or global SUPER_ADMIN can disconnect
      if (!isSuperAdmin && !(isAdmin && companyId === entityId)) {
        return NextResponse.json({
          success: false,
          error: 'No tienes permisos para desconectar esta cuenta'
        }, { status: 403 })
      }
    } else if (entityType === 'user') {
      // Only the user themselves or SUPER_ADMIN can disconnect
      if (!isSuperAdmin && userId !== entityId) {
        return NextResponse.json({
          success: false,
          error: 'No tienes permisos para desconectar esta cuenta'
        }, { status: 403 })
      }
    }

    // Get the stripe_account_id from the database
    let stripeAccountId: string | null = null
    let entityName: string = ''

    if (entityType === 'company') {
      const result = await db.query(`
        SELECT stripe_account_id, legalname
        FROM companies
        WHERE id = $1
      `, [entityId])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada'
        }, { status: 404 })
      }

      stripeAccountId = result.rows[0].stripe_account_id
      entityName = result.rows[0].legalname
    } else {
      const result = await db.query(`
        SELECT stripe_account_id, firstname, lastname
        FROM users
        WHERE id = $1
      `, [entityId])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      stripeAccountId = result.rows[0].stripe_account_id
      entityName = `${result.rows[0].firstname} ${result.rows[0].lastname}`.trim()
    }

    if (!stripeAccountId) {
      return NextResponse.json({
        success: false,
        error: 'Esta cuenta no tiene una cuenta bancaria vinculada'
      }, { status: 400 })
    }

    // Check for pending cashouts before disconnecting
    const pendingCashouts = await db.query(`
      SELECT COUNT(*) as count
      FROM wallet_transactions
      WHERE (
        (source_type = $1 AND source_company_id = $2 AND $1 = 'company')
        OR (source_type = $1 AND source_user_id = $2 AND $1 = 'user')
      )
      AND type = 'cashout'
      AND status = 'pending'
    `, [entityType, entityId])

    if (parseInt(pendingCashouts.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No puedes desconectar la cuenta mientras tengas cashouts pendientes'
      }, { status: 400 })
    }

    // Delete from Stripe
    try {
      await deleteConnectAccount(stripeAccountId)
    } catch (stripeError: any) {
      // If account is already deleted or doesn't exist, continue
      if (stripeError.code !== 'resource_missing') {
        console.error('Error deleting Stripe account:', stripeError)
        return NextResponse.json({
          success: false,
          error: 'Error al eliminar la cuenta de Stripe: ' + stripeError.message
        }, { status: 500 })
      }
    }

    // Clear Stripe fields in database
    if (entityType === 'company') {
      await db.query(`
        UPDATE companies SET
          stripe_account_id = NULL,
          stripe_account_status = 'not_connected',
          stripe_payouts_enabled = false,
          stripe_charges_enabled = false,
          stripe_details_submitted = false,
          stripe_connected_at = NULL
        WHERE id = $1
      `, [entityId])
    } else {
      await db.query(`
        UPDATE users SET
          stripe_account_id = NULL,
          stripe_account_status = 'not_connected',
          stripe_payouts_enabled = false,
          stripe_charges_enabled = false,
          stripe_details_submitted = false,
          stripe_connected_at = NULL
        WHERE id = $1
      `, [entityId])
    }

    console.log(`[Stripe Connect] Account ${stripeAccountId} disconnected for ${entityType} ${entityId} (${entityName}) by user ${userId}`)

    return NextResponse.json({
      success: true,
      data: {
        message: 'Cuenta bancaria desconectada exitosamente',
        entityType,
        entityId,
        entityName
      }
    })

  } catch (error) {
    console.error('Error disconnecting Stripe account:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al desconectar cuenta'
    }, { status: 500 })
  }
}
