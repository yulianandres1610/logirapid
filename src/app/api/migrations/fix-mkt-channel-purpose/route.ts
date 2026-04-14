import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Normalize purpose values: investigation → research, general → all
    const result = await db.query(`
      UPDATE mkt_channels
      SET purpose = CASE
        WHEN purpose = 'investigation' THEN 'research'
        WHEN purpose = 'general' THEN 'all'
        ELSE purpose
      END
      WHERE purpose IN ('investigation', 'general')
      RETURNING id, name, purpose
    `)

    return NextResponse.json({
      success: true,
      message: `Updated ${result.rows.length} channels`,
      updated: result.rows
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
