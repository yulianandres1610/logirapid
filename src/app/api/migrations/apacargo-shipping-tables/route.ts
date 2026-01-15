import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    // Crear tabla de productos de paquetería ApaCargo
    await db.query(`
      CREATE TABLE IF NOT EXISTS apacargo_shipping_products (
        id SERIAL PRIMARY KEY,

        -- ID del proveedor ApaCargo (CRITICO para crear ordenes)
        apacargo_product_id INTEGER NOT NULL,

        -- Informacion del producto original de ApaCargo
        original_name VARCHAR(255) NOT NULL,
        original_description TEXT,

        -- Informacion personalizada (lo que el usuario configura)
        custom_name VARCHAR(255) NOT NULL,
        custom_description TEXT,
        slug VARCHAR(100),

        -- Tipo de envio (configurado por usuario)
        supports_air BOOLEAN DEFAULT true,
        supports_sea BOOLEAN DEFAULT true,

        -- Precios configurados manualmente
        mi_costo DECIMAL(10,2) NOT NULL,
        precio_mayorista DECIMAL(10,2) NOT NULL,
        precio_publico DECIMAL(10,2),

        -- Estado
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Crear indice para busqueda por ID de ApaCargo
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_apacargo_product_id
        ON apacargo_shipping_products(apacargo_product_id)
      `)
    } catch {
      // Indice ya existe
    }

    // Crear indice para busqueda por slug
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_apacargo_product_slug
        ON apacargo_shipping_products(slug)
      `)
    } catch {
      // Indice ya existe
    }

    // Crear indice para filtros de tipo de envio
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_apacargo_product_shipping_type
        ON apacargo_shipping_products(supports_air, supports_sea)
      `)
    } catch {
      // Indice ya existe
    }

    return NextResponse.json({
      success: true,
      message: 'Tablas de productos ApaCargo creadas correctamente',
      tables: ['apacargo_shipping_products'],
      indexes: [
        'idx_apacargo_product_id',
        'idx_apacargo_product_slug',
        'idx_apacargo_product_shipping_type'
      ]
    })
  } catch (error) {
    console.error('Error creating ApaCargo shipping tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear tablas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
