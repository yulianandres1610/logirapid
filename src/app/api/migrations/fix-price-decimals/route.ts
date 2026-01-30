import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    const results: string[] = []

    // Actualizar columnas de precios a DECIMAL(10,2)
    const priceColumnUpdates = [
      { table: 'market_products', column: 'cost_price' },
      { table: 'market_products', column: 'selling_price' },
      { table: 'market_product_variants', column: 'cost_price' },
      { table: 'market_product_variants', column: 'selling_price' }
    ]

    for (const { table, column } of priceColumnUpdates) {
      try {
        // Primero verificamos el tipo actual
        const checkResult = await db.query(`
          SELECT data_type, numeric_precision, numeric_scale
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column])

        const current = checkResult.rows[0]
        results.push(`${table}.${column}: Antes = ${current?.data_type}(${current?.numeric_precision},${current?.numeric_scale})`)

        // Primero redondear los valores existentes a 2 decimales
        const countResult = await db.query(`
          SELECT COUNT(*) as count FROM ${table} WHERE ${column} IS NOT NULL
        `)
        results.push(`${table}.${column}: Redondeando ${countResult.rows[0].count} registros a 2 decimales`)

        await db.query(`
          UPDATE ${table}
          SET ${column} = ROUND(${column}::numeric, 2)
          WHERE ${column} IS NOT NULL
        `)
        results.push(`${table}.${column}: Valores redondeados a 2 decimales`)

        // Ejecutar ALTER TABLE para cambiar el tipo de columna
        await db.query(`
          ALTER TABLE ${table}
          ALTER COLUMN ${column} TYPE DECIMAL(10,2)
        `)
        results.push(`${table}.${column}: Actualizado a DECIMAL(10,2)`)

        // Verificar después
        const afterResult = await db.query(`
          SELECT data_type, numeric_precision, numeric_scale
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column])

        const after = afterResult.rows[0]
        results.push(`${table}.${column}: Despues = ${after?.data_type}(${after?.numeric_precision},${after?.numeric_scale})`)

      } catch (e: any) {
        results.push(`${table}.${column}: Error - ${e.message}`)
      }
    }

    // Obtener productos de ejemplo para verificar
    const sampleResult = await db.query(`
      SELECT id, name, cost_price, selling_price
      FROM market_products
      LIMIT 5
    `)

    return NextResponse.json({
      success: true,
      message: 'Migracion de decimales completada - todos los precios ahora tienen 2 decimales',
      results,
      sampleProducts: sampleResult.rows
    })

  } catch (error) {
    console.error('Error fixing price decimals:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Solo verificar el estado actual
    const checkResults = await db.query(`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name IN ('market_products', 'market_product_variants')
      AND column_name IN ('cost_price', 'selling_price')
      ORDER BY table_name, column_name
    `)

    const sampleResult = await db.query(`
      SELECT id, name, cost_price, selling_price
      FROM market_products
      LIMIT 3
    `)

    return NextResponse.json({
      success: true,
      columns: checkResults.rows,
      sampleProducts: sampleResult.rows
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
