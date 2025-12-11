import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createConnectAccount, createAccountLink } from '@/lib/stripe'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/stripe/connect/onboard
 *
 * Initiate Stripe Connect onboarding for a company or driver
 *
 * Body: {
 *   entityType: 'company' | 'user'
 *   entityId: number
 * }
 *
 * Returns:
 * - onboardingUrl: URL to redirect user to Stripe onboarding
 * - accountId: The Stripe Connect account ID
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const { entityType, entityId } = body

    // Validate required fields
    if (!entityType || !entityId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: entityType, entityId'
      }, { status: 400 })
    }

    if (!['company', 'user'].includes(entityType)) {
      return NextResponse.json({
        success: false,
        error: 'entityType debe ser "company" o "user"'
      }, { status: 400 })
    }

    // Get base URL for redirects
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    let email: string
    let name: string
    let existingAccountId: string | null = null
    let walletNumber: string

    if (entityType === 'company') {
      // Verify permissions: SUPER_ADMIN or ADMIN of the company
      if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'No autorizado. Solo ADMIN puede configurar la cuenta Connect de la empresa.'
        }, { status: 403 })
      }

      // Non-SUPER_ADMIN can only configure their own company
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== entityId) {
        return NextResponse.json({
          success: false,
          error: 'No autorizado para configurar esta empresa'
        }, { status: 403 })
      }

      // Get company details
      const companyResult = await db.query(`
        SELECT
          id,
          legalname,
          email,
          stripe_account_id,
          COALESCE("walletNumber", walletnumber) as wallet_number
        FROM companies
        WHERE id = $1
      `, [entityId])

      if (companyResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada'
        }, { status: 404 })
      }

      const company = companyResult.rows[0]
      // Use company email, fallback to logged-in user's email if company email is null
      email = company.email || payload.email
      name = company.legalname
      existingAccountId = company.stripe_account_id
      walletNumber = company.wallet_number

      // Validate email
      if (!email || !email.includes('@')) {
        return NextResponse.json({
          success: false,
          error: 'La empresa no tiene un email valido configurado. Por favor, configure un email en la configuracion de la empresa.'
        }, { status: 400 })
      }

    } else {
      // entityType === 'user' (for drivers)

      // Verify permissions: SUPER_ADMIN, or the user themselves
      if (payload.role !== 'SUPER_ADMIN' && payload.userId !== entityId) {
        return NextResponse.json({
          success: false,
          error: 'No autorizado. Solo puedes configurar tu propia cuenta Connect.'
        }, { status: 403 })
      }

      // Get user details
      const userResult = await db.query(`
        SELECT
          id,
          email,
          firstname,
          lastname,
          role,
          stripe_account_id,
          wallet_number
        FROM users
        WHERE id = $1
      `, [entityId])

      if (userResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      const user = userResult.rows[0]

      email = user.email
      name = `${user.firstname} ${user.lastname}`.trim()
      existingAccountId = user.stripe_account_id
      walletNumber = user.wallet_number
    }

    let stripeAccountId = existingAccountId

    // Create Stripe Connect account if not exists
    if (!stripeAccountId) {
      const account = await createConnectAccount({
        email,
        companyName: name,
        country: 'US'
      })

      stripeAccountId = account.id

      // Save the account ID to database
      if (entityType === 'company') {
        await db.query(`
          UPDATE companies
          SET
            stripe_account_id = $1,
            stripe_account_status = 'pending'
          WHERE id = $2
        `, [stripeAccountId, entityId])
      } else {
        await db.query(`
          UPDATE users
          SET
            stripe_account_id = $1,
            stripe_account_status = 'pending'
          WHERE id = $2
        `, [stripeAccountId, entityId])
      }
    }

    // Create Account Link for onboarding
    const returnUrl = `${origin}/dashboard/${payload.role === 'DRIVER' ? 'driver' : 'admin'}/wallet?connect_return=true&entity=${entityType}&id=${entityId}`
    const refreshUrl = `${origin}/api/stripe/connect/refresh?entity=${entityType}&id=${entityId}`

    const accountLink = await createAccountLink({
      accountId: stripeAccountId,
      returnUrl,
      refreshUrl
    })

    return NextResponse.json({
      success: true,
      data: {
        onboardingUrl: accountLink.url,
        accountId: stripeAccountId,
        expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
        entityType,
        entityId,
        entityName: name,
        walletNumber
      }
    })

  } catch (error) {
    console.error('Error initiating Connect onboarding:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al iniciar el proceso de onboarding'
    }, { status: 500 })
  }
}
