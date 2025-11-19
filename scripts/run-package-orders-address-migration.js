const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
  ssl: {
    rejectUnauthorized: false
  }
})

async function runMigration() {
  const client = await pool.connect()

  try {
    console.log('📦 Starting package_orders address fields migration...')

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '10_add_address_fields_to_package_orders.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Execute the migration
    await client.query(migrationSQL)

    console.log('✅ Migration completed successfully!')
    console.log('   - city column added/verified')
    console.log('   - state column added/verified')
    console.log('   - country column added/verified')
    console.log('   - Indexes created')

  } catch (error) {
    console.error('❌ Error running migration:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
