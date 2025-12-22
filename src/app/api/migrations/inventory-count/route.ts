import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/inventory-count
 * Crea las tablas necesarias para el módulo de conteo de inventario
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Migration] Iniciando migración de tablas de conteo de inventario...')

    // Crear tabla principal de conteos
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_inventory_counts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        session_id INTEGER REFERENCES market_pos_sessions(id),
        warehouse_id INTEGER REFERENCES market_warehouses(id),
        count_number VARCHAR(50),
        status VARCHAR(20) DEFAULT 'in_progress',
        counted_by INTEGER,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        adjustment_operation_id INTEGER,
        total_products INTEGER DEFAULT 0,
        products_with_differences INTEGER DEFAULT 0,
        total_difference_value DECIMAL(12,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Tabla market_inventory_counts creada')

    // Crear índices para la tabla de conteos
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_counts_company
      ON market_inventory_counts(company_id)
    `).catch(() => {})

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_counts_session
      ON market_inventory_counts(session_id)
    `).catch(() => {})

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_counts_warehouse
      ON market_inventory_counts(warehouse_id)
    `).catch(() => {})

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_counts_status
      ON market_inventory_counts(status)
    `).catch(() => {})

    // Crear tabla de líneas de conteo
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_inventory_count_lines (
        id SERIAL PRIMARY KEY,
        count_id INTEGER REFERENCES market_inventory_counts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        product_name VARCHAR(255),
        product_sku VARCHAR(100),
        product_barcode VARCHAR(100),
        unit_price DECIMAL(12,2) DEFAULT 0,
        expected_quantity DECIMAL(12,2) DEFAULT 0,
        counted_quantity DECIMAL(12,2) DEFAULT 0,
        difference DECIMAL(12,2) DEFAULT 0,
        difference_value DECIMAL(12,2) DEFAULT 0,
        sold_today DECIMAL(12,2) DEFAULT 0,
        scanned_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `)
    console.log('[Migration] Tabla market_inventory_count_lines creada')

    // Crear índices para la tabla de líneas
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_count
      ON market_inventory_count_lines(count_id)
    `).catch(() => {})

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_product
      ON market_inventory_count_lines(product_id)
    `).catch(() => {})

    // Crear secuencia para números de conteo si no existe
    await db.query(`
      CREATE SEQUENCE IF NOT EXISTS inventory_count_seq START 1
    `).catch(() => {})

    // Función para generar número de conteo
    await db.query(`
      CREATE OR REPLACE FUNCTION generate_count_number(p_company_id INTEGER)
      RETURNS VARCHAR(50) AS $$
      DECLARE
        v_year VARCHAR(4);
        v_seq INTEGER;
        v_count_number VARCHAR(50);
      BEGIN
        v_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;

        SELECT COALESCE(MAX(
          CAST(SUBSTRING(count_number FROM 'CNT-[0-9]{4}-([0-9]+)') AS INTEGER)
        ), 0) + 1
        INTO v_seq
        FROM market_inventory_counts
        WHERE company_id = p_company_id
        AND count_number LIKE 'CNT-' || v_year || '-%';

        v_count_number := 'CNT-' || v_year || '-' || LPAD(v_seq::VARCHAR, 4, '0');

        RETURN v_count_number;
      END;
      $$ LANGUAGE plpgsql;
    `).catch(e => console.log('[Migration] Función generate_count_number ya existe o error:', e.message))

    console.log('[Migration] Migración de conteo de inventario completada exitosamente')

    return NextResponse.json({
      success: true,
      message: 'Migración de tablas de conteo de inventario completada',
      tables: [
        'market_inventory_counts',
        'market_inventory_count_lines'
      ]
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}
