import { NextResponse } from 'next/server'
import { createOdooClient } from '@/lib/odoo-client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, database, username, apiKey } = body

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL requerida'
      }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API Key requerida'
      }, { status: 400 })
    }

    if (!database) {
      return NextResponse.json({
        success: false,
        error: 'Nombre de base de datos requerido'
      }, { status: 400 })
    }

    console.log('[Odoo Test] Testing connection with:', { url, database, username: username || '(not provided)', apiKeyLength: apiKey?.length })

    const client = createOdooClient({
      url,
      database,
      apiKey,
      username: username || undefined
    })

    const result = await client.testConnection()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      version: result.version,
      details: result.details
    })
  } catch (error) {
    console.error('Error testing Odoo connection:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    }, { status: 500 })
  }
}
