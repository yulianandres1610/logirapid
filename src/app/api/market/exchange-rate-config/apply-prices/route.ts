import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload } catch { return null }
}

/**
 * POST /api/market/exchange-rate-config/apply-prices
 * Apply new commercial prices to all affected products
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { newRate, changes } = await request.json()

    if (!newRate || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
    }

    // Ensure selling_price supports enough decimals for exact CUP calculation
    try {
      await db.query(`ALTER TABLE market_products ALTER COLUMN selling_price TYPE DECIMAL(12,6)`)
    } catch { /* already upgraded */ }

    // Ensure history table exists
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_price_change_history (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL,
          exchange_rate DECIMAL(10,4) NOT NULL,
          previous_rate DECIMAL(10,4),
          products_affected INTEGER DEFAULT 0,
          changes JSONB,
          applied_by INTEGER,
          applied_by_email VARCHAR(255),
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `)
      await db.query(`ALTER TABLE market_exchange_rate_config ADD COLUMN IF NOT EXISTS last_price_update_at TIMESTAMP`)
    } catch { /* ignore */ }

    // Get current rate for history
    const configResult = await db.query(
      'SELECT manual_rate FROM market_exchange_rate_config WHERE company_id = $1',
      [payload.companyId]
    )
    const previousRate = configResult.rows[0]?.manual_rate ? parseFloat(configResult.rows[0].manual_rate) : 0

    // Apply price changes in transaction
    await db.query('BEGIN')

    try {
      let updatedCount = 0

      for (const change of changes) {
        if (change.productId && change.newUSD > 0) {
          await db.query(
            'UPDATE market_products SET selling_price = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
            [change.newUSD, change.productId, payload.companyId]
          )
          updatedCount++
        }
      }

      // Save new rate
      const existingConfig = await db.query(
        'SELECT id FROM market_exchange_rate_config WHERE company_id = $1',
        [payload.companyId]
      )

      if (existingConfig.rows.length > 0) {
        await db.query(
          'UPDATE market_exchange_rate_config SET manual_rate = $1, updated_by = $2, updated_by_email = $3, updated_at = NOW(), last_price_update_at = NOW() WHERE company_id = $4',
          [newRate, payload.userId, payload.email, payload.companyId]
        )
      } else {
        await db.query(
          'INSERT INTO market_exchange_rate_config (company_id, manual_rate, updated_by, updated_by_email, last_price_update_at) VALUES ($1, $2, $3, $4, NOW())',
          [payload.companyId, newRate, payload.userId, payload.email]
        )
      }

      // Record history
      await db.query(`
        INSERT INTO market_price_change_history (company_id, exchange_rate, previous_rate, products_affected, changes, applied_by, applied_by_email)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        payload.companyId, newRate, previousRate, updatedCount,
        JSON.stringify(changes.slice(0, 50).map((c: any) => ({ id: c.productId, name: c.name, oldUSD: c.currentUSD, newUSD: c.newUSD, oldCUP: c.currentCUP, newCUP: c.newCUP }))),
        payload.userId, payload.email
      ])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: { updatedCount, newRate },
        message: `${updatedCount} productos actualizados con tasa ${newRate} CUP/USD`
      })
    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }
  } catch (error) {
    console.error('[Exchange Rate Apply] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al aplicar precios' }, { status: 500 })
  }
}
