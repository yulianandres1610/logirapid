import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as any

    // Ensure table exists
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_price_change_history (
          id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, exchange_rate DECIMAL(10,4) NOT NULL,
          previous_rate DECIMAL(10,4), products_affected INTEGER DEFAULT 0, changes JSONB,
          applied_by INTEGER, applied_by_email VARCHAR(255), applied_at TIMESTAMP DEFAULT NOW()
        )
      `)
    } catch { /* ignore */ }

    const result = await db.query(`
      SELECT * FROM market_price_change_history
      WHERE company_id = $1
      ORDER BY applied_at DESC
      LIMIT 20
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map((r: any) => ({
        id: r.id,
        exchangeRate: parseFloat(r.exchange_rate),
        previousRate: parseFloat(r.previous_rate) || 0,
        productsAffected: r.products_affected,
        appliedByEmail: r.applied_by_email || 'Sistema',
        appliedAt: r.applied_at
      }))
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Error' }, { status: 500 })
  }
}
