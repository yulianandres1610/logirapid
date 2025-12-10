import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { createAccountLink } from '@/lib/stripe'

/**
 * GET /api/stripe/connect/refresh
 *
 * Regenerate Account Link when it expires during onboarding
 * Called by Stripe when user returns with expired link
 *
 * Query params:
 * - entity: 'company' | 'user'
 * - id: number
 *
 * Redirects to new onboarding URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity')
    const entityId = searchParams.get('id')

    if (!entityType || !entityId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan parámetros: entity, id'
      }, { status: 400 })
    }

    if (!['company', 'user'].includes(entityType)) {
      return NextResponse.json({
        success: false,
        error: 'entity debe ser "company" o "user"'
      }, { status: 400 })
    }

    const entityIdNum = parseInt(entityId)

    let stripeAccountId: string | null = null

    // Get the Stripe account ID from database
    if (entityType === 'company') {
      const result = await db.query(`
        SELECT stripe_account_id
        FROM companies
        WHERE id = $1
      `, [entityIdNum])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada'
        }, { status: 404 })
      }

      stripeAccountId = result.rows[0].stripe_account_id
    } else {
      const result = await db.query(`
        SELECT stripe_account_id
        FROM users
        WHERE id = $1
      `, [entityIdNum])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      stripeAccountId = result.rows[0].stripe_account_id
    }

    if (!stripeAccountId) {
      // No account exists, redirect to wallet page with error
      const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${origin}/dashboard/admin/wallet?connect_error=no_account`)
    }

    // Generate new Account Link
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const returnUrl = `${origin}/dashboard/admin/wallet?connect_return=true&entity=${entityType}&id=${entityId}`
    const refreshUrl = `${origin}/api/stripe/connect/refresh?entity=${entityType}&id=${entityId}`

    const accountLink = await createAccountLink({
      accountId: stripeAccountId,
      returnUrl,
      refreshUrl
    })

    // Redirect to new onboarding URL
    return NextResponse.redirect(accountLink.url)

  } catch (error) {
    console.error('Error refreshing Connect link:', error)

    // On error, redirect to wallet with error param
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${origin}/dashboard/admin/wallet?connect_error=refresh_failed`)
  }
}
