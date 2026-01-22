/**
 * Script para corregir la orden PUR-2026-0010
 * Ejecutar con: npx tsx scripts/fix-pur-2026-0010.ts
 */

import { readFileSync } from 'fs'
import { Pool } from 'pg'

// Load environment variables from .env manually
try {
  const envFile = readFileSync('.env', 'utf-8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=["']?([^"'\n]*)["']?$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  })
} catch {
  console.log('Warning: Could not load .env')
}

async function fixPurchaseOrder() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  const client = await pool.connect()

  try {
    console.log('🔍 Buscando orden PUR-2026-0010...')

    // Find the purchase order
    const purchaseResult = await client.query(`
      SELECT mp.id, mp.purchase_number, mp.status, mp.company_id,
             mpl.id as line_id, mpl.quantity, mpl.quantity_received, mpl.unit_price
      FROM market_purchases mp
      JOIN market_purchase_lines mpl ON mpl.purchase_id = mp.id
      WHERE mp.purchase_number = 'PUR-2026-0010'
    `)

    if (purchaseResult.rows.length === 0) {
      console.log('❌ Orden PUR-2026-0010 no encontrada')
      return
    }

    const purchase = purchaseResult.rows[0]
    console.log(`✅ Encontrada orden: ${purchase.purchase_number}`)
    console.log(`   Status actual: ${purchase.status}`)
    console.log(`   Cantidad actual: ${purchase.quantity}`)
    console.log(`   Cantidad recibida: ${purchase.quantity_received}`)

    // Start transaction
    await client.query('BEGIN')

    // Update line quantity to 37.40 and reset quantity_received
    const newQuantity = 37.40
    const unitPrice = parseFloat(purchase.unit_price) || 0
    const totalPrice = newQuantity * unitPrice

    await client.query(`
      UPDATE market_purchase_lines
      SET quantity = $1,
          quantity_received = 0,
          total_price = $2
      WHERE purchase_id = $3
    `, [newQuantity, totalPrice, purchase.id])

    console.log(`📝 Cantidad actualizada a: ${newQuantity}`)
    console.log(`   Total: $${totalPrice.toFixed(2)}`)

    // Update purchase totals and status
    await client.query(`
      UPDATE market_purchases
      SET subtotal = $1,
          total_amount = $1,
          status = 'comprada',
          received_by = NULL,
          received_date = NULL,
          updated_at = NOW()
      WHERE id = $2
    `, [totalPrice, purchase.id])

    console.log(`✅ Status actualizado a: comprada`)
    console.log(`✅ Cantidad recibida reseteada a: 0`)

    await client.query('COMMIT')

    console.log('\n🎉 Orden PUR-2026-0010 corregida exitosamente!')
    console.log('   Ahora puedes recibirla desde la UI de operaciones de almacén.')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixPurchaseOrder().catch(console.error)
