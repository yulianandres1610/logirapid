import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// GET - Obtener configuración de etiquetas
export async function GET(request: NextRequest) {
  try {
    // Crear tabla si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS label_settings (
        id SERIAL PRIMARY KEY,
        label_type TEXT NOT NULL DEFAULT 'shipping',
        size TEXT NOT NULL DEFAULT '4x6',
        custom_width DECIMAL(5,2) DEFAULT 4,
        custom_height DECIMAL(5,2) DEFAULT 6,
        logo TEXT,
        show_logo BOOLEAN DEFAULT true,
        show_barcode BOOLEAN DEFAULT true,
        show_qr BOOLEAN DEFAULT false,
        font_size TEXT DEFAULT 'medium',
        logo_position TEXT DEFAULT 'top',
        logo_size TEXT DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Obtener la configuración actual
    const result = await db.query('SELECT * FROM label_settings ORDER BY id DESC LIMIT 1')

    if (result.rows.length === 0) {
      // Si no hay configuración, devolver valores por defecto
      return NextResponse.json({
        success: true,
        data: {
          labelType: 'shipping',
          size: '4x6',
          customWidth: 4,
          customHeight: 6,
          logo: '',
          showLogo: true,
          showBarcode: true,
          showQR: false,
          fontSize: 'medium',
          logoPosition: 'top',
          logoSize: 'medium'
        }
      })
    }

    const settings = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        labelType: settings.label_type,
        size: settings.size,
        customWidth: parseFloat(settings.custom_width),
        customHeight: parseFloat(settings.custom_height),
        logo: settings.logo || '',
        showLogo: settings.show_logo,
        showBarcode: settings.show_barcode,
        showQR: settings.show_qr,
        fontSize: settings.font_size,
        logoPosition: settings.logo_position,
        logoSize: settings.logo_size
      }
    })
  } catch (error) {
    console.error('Error fetching label settings:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuración de etiquetas' },
      { status: 500 }
    )
  }
}

// POST - Guardar configuración de etiquetas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      labelType,
      size,
      customWidth,
      customHeight,
      logo,
      showLogo,
      showBarcode,
      showQR,
      fontSize,
      logoPosition,
      logoSize
    } = body

    // Crear tabla si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS label_settings (
        id SERIAL PRIMARY KEY,
        label_type TEXT NOT NULL DEFAULT 'shipping',
        size TEXT NOT NULL DEFAULT '4x6',
        custom_width DECIMAL(5,2) DEFAULT 4,
        custom_height DECIMAL(5,2) DEFAULT 6,
        logo TEXT,
        show_logo BOOLEAN DEFAULT true,
        show_barcode BOOLEAN DEFAULT true,
        show_qr BOOLEAN DEFAULT false,
        font_size TEXT DEFAULT 'medium',
        logo_position TEXT DEFAULT 'top',
        logo_size TEXT DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Insertar nueva configuración
    const result = await db.query(`
      INSERT INTO label_settings (
        label_type, size, custom_width, custom_height, logo,
        show_logo, show_barcode, show_qr, font_size,
        logo_position, logo_size, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      labelType,
      size,
      customWidth,
      customHeight,
      logo || null,
      showLogo,
      showBarcode,
      showQR,
      fontSize,
      logoPosition,
      logoSize
    ])

    return NextResponse.json({
      success: true,
      message: 'Configuración guardada exitosamente',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error saving label settings:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar configuración de etiquetas' },
      { status: 500 }
    )
  }
}
