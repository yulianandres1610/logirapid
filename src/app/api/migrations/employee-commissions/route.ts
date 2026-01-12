import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    // Crear tabla de comisiones de empleados
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_employee_commissions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        employee_id INTEGER NOT NULL REFERENCES market_employees(id),
        pos_order_id INTEGER REFERENCES market_pos_orders(id),
        pos_order_line_id INTEGER,

        -- Datos del producto
        product_id INTEGER REFERENCES market_products(id),
        product_name VARCHAR(255),
        quantity DECIMAL(12,3),

        -- Precios para cálculo
        unit_price DECIMAL(12,2),
        cost_price DECIMAL(12,2),
        margin_amount DECIMAL(12,2),

        -- Comisión
        commission_rate DECIMAL(5,2),
        commission_amount DECIMAL(12,2),

        -- Estado
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        paid_in_payroll_id INTEGER,

        -- Auditoría
        created_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `)

    // Crear índices para mejor rendimiento
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_commissions_employee
      ON market_employee_commissions(employee_id)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_commissions_status
      ON market_employee_commissions(status)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_commissions_order
      ON market_employee_commissions(pos_order_id)
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_commissions_company
      ON market_employee_commissions(company_id)
    `)

    // Agregar campo commission_balance a market_employees si no existe
    try {
      await db.query(`
        ALTER TABLE market_employees
        ADD COLUMN IF NOT EXISTS commission_balance DECIMAL(12,2) DEFAULT 0
      `)
    } catch {
      // Column might already exist
    }

    return NextResponse.json({
      success: true,
      message: 'Migración de comisiones de empleados completada exitosamente'
    })

  } catch (error) {
    console.error('Error en migración de comisiones:', error)
    return NextResponse.json(
      { success: false, error: 'Error al ejecutar migración de comisiones' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Verificar estado de la tabla
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'market_employee_commissions'
      ) as exists
    `)

    const columnCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'market_employees'
        AND column_name = 'commission_balance'
      ) as exists
    `)

    return NextResponse.json({
      success: true,
      data: {
        commissionsTableExists: tableCheck.rows[0]?.exists || false,
        balanceColumnExists: columnCheck.rows[0]?.exists || false
      }
    })

  } catch (error) {
    console.error('Error verificando migración:', error)
    return NextResponse.json(
      { success: false, error: 'Error al verificar estado de migración' },
      { status: 500 }
    )
  }
}
