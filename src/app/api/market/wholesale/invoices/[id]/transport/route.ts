import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params

    // Auto-create table if not exists
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS market_invoice_transports (
        id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL, company_id INTEGER NOT NULL,
        transport_number VARCHAR(50), driver_name VARCHAR(255) NOT NULL, driver_lastname VARCHAR(255) NOT NULL,
        driver_id_card VARCHAR(20) NOT NULL, vehicle_brand VARCHAR(100), vehicle_plate VARCHAR(20) NOT NULL,
        amount DECIMAL(12,4) DEFAULT 0, currency VARCHAR(10) DEFAULT 'CUP', exchange_rate DECIMAL(12,4) DEFAULT 0,
        notes TEXT, status VARCHAR(20) DEFAULT 'active', created_by INTEGER, created_at TIMESTAMP DEFAULT NOW()
      )`)
    } catch {}

    const result = await db.query(`
      SELECT t.*, u.email as created_by_email
      FROM market_invoice_transports t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.invoice_id = $1 AND t.company_id = $2
      ORDER BY t.created_at DESC
    `, [parseInt(id), payload.companyId])

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('[Transport GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener transportes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const invoiceId = parseInt(id)

    // Verify invoice exists and belongs to company
    const invoiceCheck = await db.query(
      'SELECT id, invoice_number FROM market_invoices WHERE id = $1 AND company_id = $2',
      [invoiceId, payload.companyId]
    )
    if (invoiceCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { driverName, driverLastname, driverIdCard, vehicleBrand, vehiclePlate, amount, exchangeRate, notes } = body

    if (!driverName || !driverLastname || !driverIdCard || !vehiclePlate) {
      return NextResponse.json({ success: false, error: 'Nombre, apellidos, carnet y placa son requeridos' }, { status: 400 })
    }

    // Generate transport number
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM market_invoice_transports WHERE company_id = $1',
      [payload.companyId]
    )
    const num = (parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0')
    const transportNumber = `TR-2026-${num}`

    const result = await db.query(`
      INSERT INTO market_invoice_transports (
        invoice_id, company_id, transport_number,
        driver_name, driver_lastname, driver_id_card,
        vehicle_brand, vehicle_plate,
        amount, currency, exchange_rate, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CUP', $10, $11, $12)
      RETURNING *
    `, [
      invoiceId, payload.companyId, transportNumber,
      driverName.trim(), driverLastname.trim(), driverIdCard.trim(),
      vehicleBrand?.trim() || null, vehiclePlate.trim().toUpperCase(),
      parseFloat(amount) || 0, parseFloat(exchangeRate) || 0,
      notes?.trim() || null, payload.userId
    ])

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[Transport POST]', error)
    return NextResponse.json({ success: false, error: 'Error al crear transporte' }, { status: 500 })
  }
}
