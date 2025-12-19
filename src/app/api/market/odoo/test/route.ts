import { NextResponse } from 'next/server'
import { createOdooClient } from '@/lib/odoo-client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, database, apiKey } = body

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

    const client = createOdooClient({
      url,
      database: database || '',
      apiKey
    })

    const result = await client.testConnection()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      version: result.version
    })
  } catch (error) {
    console.error('Error testing Odoo connection:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    }, { status: 500 })
  }
}
