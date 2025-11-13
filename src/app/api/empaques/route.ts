import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tamano = searchParams.get('tamano')
    const tipo = searchParams.get('tipo')
    const codigo = searchParams.get('codigo')
    const disponibilidad = searchParams.get('disponibilidad') || 'disponible'

    let query = 'SELECT * FROM empaques WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (tamano) {
      query += ` AND tamano = $${paramIndex++}`
      params.push(tamano)
    }

    if (tipo) {
      query += ` AND tipo = $${paramIndex++}`
      params.push(tipo)
    }

    if (codigo) {
      query += ` AND codigo = $${paramIndex++}`
      params.push(codigo)
    }

    if (disponibilidad) {
      query += ` AND estado = $${paramIndex++}`
      params.push(disponibilidad)
    }

    query += ' ORDER BY codigo ASC'

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error al buscar empaques:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al buscar empaques',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}