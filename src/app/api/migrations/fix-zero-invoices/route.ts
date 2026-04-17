import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Fix all invoices with total_amount = 0 that are still pending
    const result = await db.query(`
      UPDATE market_invoices
      SET payment_status = 'paid',
          amount_due = 0,
          amount_paid = 0,
          status = CASE WHEN status = 'draft' THEN 'confirmed' ELSE status END,
          paid_at = COALESCE(paid_at, NOW()),
          confirmed_at = COALESCE(confirmed_at, NOW())
      WHERE total_amount <= 0 AND payment_status != 'paid'
      RETURNING id, invoice_number, total_amount, payment_status, status
    `)

    return NextResponse.json({
      success: true,
      message: `${result.rows.length} facturas con total $0 marcadas como pagadas`,
      data: result.rows
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
