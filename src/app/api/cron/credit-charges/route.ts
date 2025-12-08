import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Configuration
const LATE_FEE_AMOUNT = 25.00 // Fixed late fee after 35 days
const INTEREST_RATE = 0.03 // 3% monthly interest
const LATE_FEE_DAYS = 35 // Days before late fee is applied
const INTEREST_START_DAYS = 65 // Days before interest starts (35 + 30)

/**
 * GET /api/cron/credit-charges
 * Vercel Cron job to process automatic credit charges
 *
 * This should be called daily via Vercel Cron:
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/credit-charges",
 *     "schedule": "0 6 * * *"
 *   }]
 * }
 *
 * Security: Verify CRON_SECRET header in production
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    // In production, require secret
    if (process.env.NODE_ENV === 'production' && expectedSecret) {
      if (cronSecret !== expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
        console.log('[Credit Charges Cron] Unauthorized request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('[Credit Charges Cron] Starting credit charges processing...')

    const now = new Date()
    const results = {
      processed: 0,
      lateFees: [] as { companyId: number, companyName: string, amount: number }[],
      interestCharges: [] as { companyId: number, companyName: string, amount: number, balance: number }[],
      errors: [] as string[]
    }

    // Find all companies with negative balance that have credit enabled
    const companiesResult = await db.query(`
      SELECT
        id,
        legalname,
        walletbalance,
        walletnumber,
        credit_limit,
        credit_enabled,
        negative_since,
        late_fee_charged_at,
        last_interest_charge_at
      FROM companies
      WHERE walletbalance < 0
        AND credit_enabled = true
        AND negative_since IS NOT NULL
      ORDER BY negative_since ASC
    `)

    console.log(`[Credit Charges Cron] Found ${companiesResult.rows.length} companies with negative balance`)

    for (const company of companiesResult.rows) {
      try {
        const balance = parseFloat(company.walletbalance)
        const negativeSince = new Date(company.negative_since)
        const daysInNegative = Math.floor((now.getTime() - negativeSince.getTime()) / (1000 * 60 * 60 * 24))

        console.log(`[Credit Charges Cron] Processing ${company.legalname}: balance=${balance}, days=${daysInNegative}`)

        // 1. Check for late fee (35+ days, not yet charged)
        if (daysInNegative >= LATE_FEE_DAYS && !company.late_fee_charged_at) {
          await processLateFee(company, balance, results)
        }

        // 2. Check for monthly interest (65+ days)
        if (daysInNegative >= INTEREST_START_DAYS) {
          await processInterestCharge(company, balance, now, results)
        }

        results.processed++
      } catch (error) {
        const errorMsg = `Error processing company ${company.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`[Credit Charges Cron] ${errorMsg}`)
        results.errors.push(errorMsg)
      }
    }

    console.log(`[Credit Charges Cron] Completed. Processed: ${results.processed}, Late fees: ${results.lateFees.length}, Interest: ${results.interestCharges.length}`)

    return NextResponse.json({
      success: true,
      message: 'Credit charges processed',
      data: {
        timestamp: now.toISOString(),
        companiesProcessed: results.processed,
        lateFees: {
          count: results.lateFees.length,
          total: results.lateFees.reduce((sum, f) => sum + f.amount, 0),
          details: results.lateFees
        },
        interestCharges: {
          count: results.interestCharges.length,
          total: results.interestCharges.reduce((sum, c) => sum + c.amount, 0),
          details: results.interestCharges
        },
        errors: results.errors
      }
    })

  } catch (error) {
    console.error('[Credit Charges Cron] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error processing credit charges'
    }, { status: 500 })
  }
}

/**
 * Process late fee for a company
 */
async function processLateFee(
  company: any,
  currentBalance: number,
  results: { lateFees: { companyId: number, companyName: string, amount: number }[], errors: string[] }
) {
  console.log(`[Credit Charges Cron] Charging late fee to ${company.legalname}`)

  await db.transaction(async (client) => {
    // Deduct late fee from balance
    await client.query(`
      UPDATE companies
      SET walletbalance = walletbalance - $1,
          late_fee_charged_at = NOW()
      WHERE id = $2
    `, [LATE_FEE_AMOUNT, company.id])

    // Create transaction record
    await client.query(`
      INSERT INTO wallet_transactions (
        type,
        source_type,
        target_type,
        target_company_id,
        target_wallet_number,
        amount,
        fee,
        net_amount,
        currency,
        payment_method,
        status,
        description,
        created_by,
        created_by_name,
        completed_at
      ) VALUES (
        'credit_charge',
        'system',
        'company',
        $1,
        $2,
        $3,
        0,
        $3,
        'USD',
        'credit_charge',
        'completed',
        $4,
        0,
        'Sistema',
        NOW()
      )
    `, [
      company.id,
      company.walletnumber,
      LATE_FEE_AMOUNT,
      `Cargo por mora - ${LATE_FEE_DAYS} días en balance negativo`
    ])

    // Create credit charge record for tracking
    await client.query(`
      INSERT INTO credit_charges (
        company_id,
        charge_type,
        amount,
        balance_before,
        balance_after,
        days_in_negative,
        description
      ) VALUES (
        $1,
        'late_fee',
        $2,
        $3,
        $4,
        $5,
        $6
      )
    `, [
      company.id,
      LATE_FEE_AMOUNT,
      currentBalance,
      currentBalance - LATE_FEE_AMOUNT,
      LATE_FEE_DAYS,
      `Cargo por mora después de ${LATE_FEE_DAYS} días`
    ])
  })

  results.lateFees.push({
    companyId: company.id,
    companyName: company.legalname,
    amount: LATE_FEE_AMOUNT
  })

  console.log(`[Credit Charges Cron] Late fee charged: $${LATE_FEE_AMOUNT} to ${company.legalname}`)
}

/**
 * Process monthly interest charge for a company
 */
async function processInterestCharge(
  company: any,
  currentBalance: number,
  now: Date,
  results: { interestCharges: { companyId: number, companyName: string, amount: number, balance: number }[], errors: string[] }
) {
  // Check if interest was already charged this month
  if (company.last_interest_charge_at) {
    const lastCharge = new Date(company.last_interest_charge_at)
    const sameMonth = lastCharge.getMonth() === now.getMonth() &&
                      lastCharge.getFullYear() === now.getFullYear()

    if (sameMonth) {
      console.log(`[Credit Charges Cron] Interest already charged this month for ${company.legalname}`)
      return
    }
  }

  // Calculate 3% interest on the negative balance (absolute value)
  const interestAmount = Math.abs(currentBalance) * INTEREST_RATE
  const roundedInterest = Math.round(interestAmount * 100) / 100 // Round to 2 decimals

  if (roundedInterest < 0.01) {
    console.log(`[Credit Charges Cron] Interest too small to charge for ${company.legalname}`)
    return
  }

  console.log(`[Credit Charges Cron] Charging interest to ${company.legalname}: ${INTEREST_RATE * 100}% of $${Math.abs(currentBalance)} = $${roundedInterest}`)

  await db.transaction(async (client) => {
    // Deduct interest from balance
    await client.query(`
      UPDATE companies
      SET walletbalance = walletbalance - $1,
          last_interest_charge_at = NOW()
      WHERE id = $2
    `, [roundedInterest, company.id])

    // Create transaction record
    await client.query(`
      INSERT INTO wallet_transactions (
        type,
        source_type,
        target_type,
        target_company_id,
        target_wallet_number,
        amount,
        fee,
        net_amount,
        currency,
        payment_method,
        status,
        description,
        created_by,
        created_by_name,
        completed_at
      ) VALUES (
        'credit_charge',
        'system',
        'company',
        $1,
        $2,
        $3,
        0,
        $3,
        'USD',
        'credit_charge',
        'completed',
        $4,
        0,
        'Sistema',
        NOW()
      )
    `, [
      company.id,
      company.walletnumber,
      roundedInterest,
      `Interés mensual (${INTEREST_RATE * 100}%) sobre balance negativo de $${Math.abs(currentBalance).toFixed(2)}`
    ])

    // Create credit charge record for tracking
    await client.query(`
      INSERT INTO credit_charges (
        company_id,
        charge_type,
        amount,
        balance_before,
        balance_after,
        interest_rate,
        description
      ) VALUES (
        $1,
        'interest',
        $2,
        $3,
        $4,
        $5,
        $6
      )
    `, [
      company.id,
      roundedInterest,
      currentBalance,
      currentBalance - roundedInterest,
      INTEREST_RATE,
      `Interés mensual ${INTEREST_RATE * 100}%`
    ])
  })

  results.interestCharges.push({
    companyId: company.id,
    companyName: company.legalname,
    amount: roundedInterest,
    balance: currentBalance
  })

  console.log(`[Credit Charges Cron] Interest charged: $${roundedInterest} to ${company.legalname}`)
}
