import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tamano = searchParams.get('tamano')
    const tipo = searchParams.get('tipo')
    const codigo = searchParams.get('codigo')
    const disponibilidad = searchParams.get('disponibilidad') || 'disponible'

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    let query = 'SELECT * FROM empaques WHERE 1=1'
    const params: any[] = []

    if (tamano) {
      query += ' AND tamano = ?'
      params.push(tamano)
    }

    if (tipo) {
      query += ' AND tipo = ?'
      params.push(tipo)
    }

    if (codigo) {
      query += ' AND codigo = ?'
      params.push(codigo)
    }

    if (disponibilidad) {
      query += ' AND estado = ?'
      params.push(disponibilidad)
    }

    query += ' ORDER BY codigo ASC'

    const empaques = await db.all(query, params)
    await db.close()

    return NextResponse.json({
      success: true,
      data: empaques
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