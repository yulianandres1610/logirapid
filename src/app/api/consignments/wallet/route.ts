import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/wallet
 * Get wallet status for the current company
 *
 * Query params:
 * - role: 'provider' (I'm the provider, they owe me) | 'receiver' (I'm the receiver, I owe them)
 * - partnerId: Filter by specific partner company
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'provider'
    const partnerId = searchParams.get('partnerId')

    let wallets
    if (role === 'provider') {
      // I'm the provider - get all receivers who owe me money
      const query = partnerId
        ? `
          SELECT
            cw.*,
            r.name as partner_name,
            r.phone as partner_phone,
            r.logo_url as partner_logo
          FROM consignment_wallets cw
          LEFT JOIN companies r ON r.id = cw.receiver_company_id
          WHERE cw.provider_company_id = $1 AND cw.receiver_company_id = $2
        `
        : `
          SELECT
            cw.*,
            r.name as partner_name,
            r.phone as partner_phone,
            r.logo_url as partner_logo
          FROM consignment_wallets cw
          LEFT JOIN companies r ON r.id = cw.receiver_company_id
          WHERE cw.provider_company_id = $1
          ORDER BY cw.balance DESC
        `
      const params = partnerId ? [currentCompanyId, partnerId] : [currentCompanyId]
      wallets = await db.query(query, params)
    } else {
      // I'm the receiver - get all providers I owe money to
      const query = partnerId
        ? `
          SELECT
            cw.*,
            p.name as partner_name,
            p.phone as partner_phone,
            p.logo_url as partner_logo
          FROM consignment_wallets cw
          LEFT JOIN companies p ON p.id = cw.provider_company_id
          WHERE cw.receiver_company_id = $1 AND cw.provider_company_id = $2
        `
        : `
          SELECT
            cw.*,
            p.name as partner_name,
            p.phone as partner_phone,
            p.logo_url as partner_logo
          FROM consignment_wallets cw
          LEFT JOIN companies p ON p.id = cw.provider_company_id
          WHERE cw.receiver_company_id = $1
          ORDER BY cw.balance DESC
        `
      const params = partnerId ? [currentCompanyId, partnerId] : [currentCompanyId]
      wallets = await db.query(query, params)
    }

    // Calculate totals
    let totalBalance = 0
    let totalSales = 0
    let totalPaid = 0
    for (const wallet of wallets.rows) {
      totalBalance += parseFloat(wallet.balance) || 0
      totalSales += parseFloat(wallet.total_sales) || 0
      totalPaid += parseFloat(wallet.total_paid) || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        wallets: wallets.rows.map(w => ({
          id: w.id,
          providerCompanyId: w.provider_company_id,
          receiverCompanyId: w.receiver_company_id,
          partner: {
            id: role === 'provider' ? w.receiver_company_id : w.provider_company_id,
            name: w.partner_name,
            phone: w.partner_phone,
            logoUrl: w.partner_logo
          },
          balance: parseFloat(w.balance) || 0,
          totalSales: parseFloat(w.total_sales) || 0,
          totalPaid: parseFloat(w.total_paid) || 0,
          totalReturned: parseFloat(w.total_returned) || 0,
          lastSaleAt: w.last_sale_at,
          lastPaymentAt: w.last_payment_at
        })),
        summary: {
          totalBalance,
          totalSales,
          totalPaid,
          walletsCount: wallets.rows.length
        }
      }
    })

  } catch (error) {
    console.error('[Consignment Wallet] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener wallets'
    }, { status: 500 })
  }
}
