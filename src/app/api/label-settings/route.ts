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
        name TEXT NOT NULL DEFAULT 'Configuración de Etiqueta',
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

    // Agregar columna name si no existe (migración)
    try {
      await db.query(`
        ALTER TABLE label_settings ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Configuración de Etiqueta'
      `)
    } catch (error) {
      // Columna ya existe
    }

    // Obtener todas las configuraciones
    const result = await db.query('SELECT * FROM label_settings ORDER BY id DESC')

    const labelSettings = result.rows.map(setting => ({
      id: setting.id,
      name: setting.name || `${setting.size} - ${setting.label_type}`,
      label_type: setting.label_type,
      size: setting.size,
      custom_width: parseFloat(setting.custom_width),
      custom_height: parseFloat(setting.custom_height),
      show_logo: setting.show_logo,
      show_barcode: setting.show_barcode,
      show_qr: setting.show_qr,
      font_size: setting.font_size,
      logo_position: setting.logo_position,
      logo_size: setting.logo_size
    }))

    return NextResponse.json({
      success: true,
      labelSettings: labelSettings
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
      name,
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
        name TEXT NOT NULL DEFAULT 'Configuración de Etiqueta',
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

    // Agregar columna name si no existe (migración)
    try {
      await db.query(`
        ALTER TABLE label_settings ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Configuración de Etiqueta'
      `)
    } catch (error) {
      // Columna ya existe
    }

    // Insertar nueva configuración
    const result = await db.query(`
      INSERT INTO label_settings (
        name, label_type, size, custom_width, custom_height, logo,
        show_logo, show_barcode, show_qr, font_size,
        logo_position, logo_size, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      name || `${size} - ${labelType}`,
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
