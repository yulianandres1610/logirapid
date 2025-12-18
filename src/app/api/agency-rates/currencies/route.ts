import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// GET: Obtener monedas disponibles del historial
export async function GET(request: NextRequest) {
  try {
    // Obtener monedas únicas del historial
    const query = `
      SELECT DISTINCT currency
      FROM agency_rates_history
      ORDER BY currency ASC
    `

    const result = await db.query(query)

    if (result.rows.length === 0) {
      // Si no hay historial, devolver monedas por defecto
      return NextResponse.json({
        success: true,
        data: ['USD', 'EUR', 'MLC'],
        source: 'default'
      })
    }

    const currencies = result.rows.map((row: any) => row.currency)

    return NextResponse.json({
      success: true,
      data: currencies,
      source: 'database'
    })

  } catch (error: any) {
    console.error('[AGENCY-RATES-CURRENCIES] Error:', error)

    // Si la tabla no existe, retornar monedas por defecto
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        data: ['USD', 'EUR', 'MLC'],
        source: 'default'
      })
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener monedas' },
      { status: 500 }
    )
  }
}
