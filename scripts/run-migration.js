const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = "postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

async function runMigration(migrationFile) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`\n🚀 Running migration: ${migrationFile}\n`);

    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('\n✅ Migration completed successfully!\n');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2] || '09_delivery_orders_system.sql';
runMigration(migrationFile);
