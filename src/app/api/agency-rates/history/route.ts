import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency') || 'USD'
    const days = parseInt(searchParams.get('days') || '30', 10)

    // Calcular fecha de inicio
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Consultar historial de tasas
    const query = `
      SELECT
        currency,
        baserate,
        agencyrate,
        adjustmentpercentage,
        timestamp
      FROM agency_rates_history
      WHERE currency = $1
        AND timestamp >= $2
      ORDER BY timestamp ASC
    `

    const result = await db.query(query, [currency, startDate.toISOString()])

    if (result.rows.length === 0) {
      // Si no hay datos históricos, devolver datos vacíos
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No hay datos históricos disponibles para este período'
      })
    }

    return NextResponse.json({
      success: true,
      data: result.rows.map(row => ({
        timestamp: row.timestamp,
        currency: row.currency,
        baserate: parseFloat(row.baserate) || 0,
        agencyrate: parseFloat(row.agencyrate) || 0,
        adjustmentpercentage: parseFloat(row.adjustmentpercentage) || 0
      }))
    })

  } catch (error: any) {
    console.error('[AGENCY-RATES-HISTORY] Error:', error)

    // Si la tabla no existe, retornar array vacío
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Tabla de historial no disponible'
      })
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener historial' },
      { status: 500 }
    )
  }
}
