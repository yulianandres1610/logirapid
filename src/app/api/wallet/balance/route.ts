import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * Get wallet balance for company and user
 *
 * This endpoint returns wallet information for both:
 * - The user's company (from companies.walletNumber/walletBalance)
 * - The user themselves (from users.wallet_number/wallet_balance)
 */
export async function GET(request: NextRequest) {
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { userId, companyId } = payload

    // Get company wallet info
    let companyWallet = null
    if (companyId) {
      // Note: Use COALESCE to handle both camelCase and lowercase column names
      // walletBalance is varchar in camelCase, numeric in lowercase
      const companyResult = await db.query(`
        SELECT
          id,
          legalname as "legalName",
          COALESCE("walletNumber", walletnumber) as "walletNumber",
          COALESCE("walletBalance"::numeric, walletbalance, 0) as "walletBalance"
        FROM companies
        WHERE id = $1
      `, [companyId])

      if (companyResult.rows.length > 0) {
        companyWallet = {
          walletNumber: companyResult.rows[0].walletNumber,
          walletBalance: parseFloat(companyResult.rows[0].walletBalance || '0'),
          companyName: companyResult.rows[0].legalName
        }
      }
    }

    // Get user wallet info
    let userWallet = null
    if (userId) {
      const userResult = await db.query(`
        SELECT
          id,
          firstname,
          lastname,
          email,
          wallet_number as "walletNumber",
          wallet_balance as "walletBalance"
        FROM users
        WHERE id = $1
      `, [userId])

      if (userResult.rows.length > 0) {
        userWallet = {
          walletNumber: userResult.rows[0].walletNumber,
          walletBalance: parseFloat(userResult.rows[0].walletBalance || '0'),
          userName: `${userResult.rows[0].firstname} ${userResult.rows[0].lastname}`.trim()
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        company: companyWallet,
        user: userWallet
      }
    })

  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener saldo'
    }, { status: 500 })
  }
}
