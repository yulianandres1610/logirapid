/**
 * Script to run database migrations directly
 * Usage: node scripts/run-migrations.js
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
    }
  })
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function runMigrations() {
  const client = await pool.connect()

  try {
    console.log('Starting migrations...\n')

    // Add new columns to external_recharge_products
    const newColumns = [
      { name: 'custom_name', definition: 'VARCHAR(255)' },
      { name: 'custom_description', definition: 'TEXT' },
      { name: 'manual_cost_price', definition: 'DECIMAL(10,2)' },
      { name: 'manual_selling_price', definition: 'DECIMAL(10,2)' },
      { name: 'is_promotion', definition: 'BOOLEAN DEFAULT false' },
      { name: 'promotion_id', definition: 'VARCHAR(100)' },
      { name: 'provider_amount', definition: 'DECIMAL(10,2)' },
      { name: 'univcell_product_id', definition: 'INTEGER' },
      { name: 'phone_mask', definition: 'VARCHAR(100)' },
      { name: 'valid_from', definition: 'TIMESTAMP' },
      { name: 'valid_to', definition: 'TIMESTAMP' },
    ]

    for (const column of newColumns) {
      try {
        await client.query(`
          ALTER TABLE external_recharge_products
          ADD COLUMN IF NOT EXISTS ${column.name} ${column.definition}
        `)
        console.log(`✓ Added column: external_recharge_products.${column.name}`)
      } catch (error) {
        if (error.code === '42701') {
          console.log(`- Column ${column.name} already exists`)
        } else if (error.code === '42P01') {
          console.log(`! Table external_recharge_products does not exist yet`)
          break
        } else {
          console.log(`✗ Error adding column ${column.name}: ${error.message}`)
        }
      }
    }

    console.log('\n✓ Migrations completed successfully!')

  } catch (error) {
    console.error('Migration error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().catch(console.error)
