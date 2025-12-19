import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    // Check if table exists first
    try {
      const result = await db.query(`
        SELECT
          id,
          sync_type as "syncType",
          direction,
          products_imported as "productsImported",
          products_exported as "productsExported",
          products_updated as "productsUpdated",
          errors,
          started_at as "startedAt",
          completed_at as "completedAt",
          status,
          triggered_by as "triggeredBy"
        FROM odoo_sync_logs
        WHERE company_id = $1
        ORDER BY started_at DESC
        LIMIT 20
      `, [parseInt(companyId)])

      return NextResponse.json({
        success: true,
        data: result.rows
      })
    } catch {
      // Table doesn't exist yet
      return NextResponse.json({
        success: true,
        data: []
      })
    }
  } catch (error) {
    console.error('Error getting Odoo logs:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener historial'
    }, { status: 500 })
  }
}
