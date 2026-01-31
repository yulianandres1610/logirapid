import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    console.log('[Migration] Starting production tables migration...')

    // 1. Create market_bill_of_materials table (Recetas/Fórmulas)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_bill_of_materials (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Producto que se fabrica
        product_id INTEGER REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),

        bom_code VARCHAR(50),              -- BOM-2025-0001
        bom_name VARCHAR(255),             -- "Empaque Frijoles 3kg"

        -- Rendimiento
        output_quantity DECIMAL(15,3),     -- Cantidad producida (ej: 16 bolsas)
        output_unit VARCHAR(20) DEFAULT 'unidad',           -- 'unidad', 'kg', etc

        -- Merma esperada
        expected_waste_percent DECIMAL(5,2) DEFAULT 0,  -- % de merma (ej: 4% = 2kg de 50kg)

        -- Estado
        is_active BOOLEAN DEFAULT true,
        notes TEXT,

        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, bom_code)
      )
    `)
    console.log('[Migration] Created market_bill_of_materials table')

    // Create indexes for BOM
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bom_company ON market_bill_of_materials(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bom_product ON market_bill_of_materials(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bom_active ON market_bill_of_materials(company_id, is_active)
    `)

    // 2. Create market_bom_lines table (Componentes/Materias Primas)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_bom_lines (
        id SERIAL PRIMARY KEY,
        bom_id INTEGER NOT NULL REFERENCES market_bill_of_materials(id) ON DELETE CASCADE,

        -- Materia prima
        product_id INTEGER REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),

        -- Cantidad requerida
        quantity_required DECIMAL(15,3),   -- Ej: 1 saco, o 50 kg
        unit VARCHAR(20) DEFAULT 'unidad',                  -- 'unidad', 'kg', etc

        -- Para calcular costo
        is_primary BOOLEAN DEFAULT true,   -- Componente principal (para cálculo de costo)

        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_bom_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bom_lines_bom ON market_bom_lines(bom_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bom_lines_product ON market_bom_lines(product_id)
    `)

    // 3. Create market_production_orders table (Órdenes de Producción)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_orders (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        production_number VARCHAR(50),     -- PRD-2025-0001
        bom_id INTEGER REFERENCES market_bill_of_materials(id),

        -- Almacén donde se produce
        warehouse_id INTEGER REFERENCES market_warehouses(id),

        -- Cantidades
        quantity_to_produce DECIMAL(15,3), -- Cuántas unidades fabricar (ej: 16 bolsas)
        quantity_produced DECIMAL(15,3) DEFAULT 0,  -- Realmente producidas

        -- Costos calculados
        total_material_cost DECIMAL(12,4), -- Costo total materias primas
        unit_cost DECIMAL(12,4),           -- Costo por unidad producida

        -- Estado del flujo
        status VARCHAR(50) DEFAULT 'draft',
        -- draft → confirmed → materials_out → in_production → completed → cancelled

        -- Operaciones de almacén vinculadas
        material_out_operation_id INTEGER REFERENCES market_warehouse_operations(id),
        product_in_operation_id INTEGER REFERENCES market_warehouse_operations(id),

        -- Fechas
        scheduled_date DATE,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,

        notes TEXT,

        created_by INTEGER REFERENCES users(id),
        confirmed_by INTEGER REFERENCES users(id),
        completed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, production_number)
      )
    `)
    console.log('[Migration] Created market_production_orders table')

    // Create indexes for production orders
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_company ON market_production_orders(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_status ON market_production_orders(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_bom ON market_production_orders(bom_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_warehouse ON market_production_orders(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_date ON market_production_orders(scheduled_date)
    `)

    // 4. Create market_production_order_lines table (Consumo de Materiales)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_order_lines (
        id SERIAL PRIMARY KEY,
        production_order_id INTEGER NOT NULL REFERENCES market_production_orders(id) ON DELETE CASCADE,

        -- Material
        product_id INTEGER REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),

        -- Cantidades
        quantity_planned DECIMAL(15,3),    -- Según BOM
        quantity_consumed DECIMAL(15,3) DEFAULT 0,  -- Realmente consumido

        -- Costo al momento del consumo
        unit_cost DECIMAL(12,4),           -- Costo unitario del material
        total_cost DECIMAL(12,4),          -- quantity_consumed * unit_cost

        -- Estado
        line_status VARCHAR(50) DEFAULT 'pending',  -- pending, delivered, consumed

        delivered_at TIMESTAMP,
        delivered_by INTEGER REFERENCES users(id),

        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_production_order_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lines_order ON market_production_order_lines(production_order_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lines_product ON market_production_order_lines(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lines_status ON market_production_order_lines(line_status)
    `)

    // Get table stats
    const tables = [
      'market_bill_of_materials',
      'market_bom_lines',
      'market_production_orders',
      'market_production_order_lines'
    ]
    const tableStats = []

    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        tableStats.push({ table, count: result.rows[0].count })
      } catch (e) {
        tableStats.push({ table, count: 0, error: 'Table not found' })
      }
    }

    console.log('[Migration] Production tables migration completed')

    return NextResponse.json({
      success: true,
      message: 'Production tables migration completed successfully',
      tables: tableStats
    })

  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current state of production tables
    const tables = [
      'market_bill_of_materials',
      'market_bom_lines',
      'market_production_orders',
      'market_production_order_lines'
    ]
    const tableStatus = []

    for (const table of tables) {
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        ) as exists
      `, [table])

      let count = 0
      if (exists.rows[0].exists) {
        const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        count = parseInt(countResult.rows[0].count)
      }

      tableStatus.push({
        table,
        exists: exists.rows[0].exists,
        count
      })
    }

    const needsMigration = tableStatus.some(t => !t.exists)

    return NextResponse.json({
      success: true,
      needsMigration,
      tables: tableStatus
    })

  } catch (error: any) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
