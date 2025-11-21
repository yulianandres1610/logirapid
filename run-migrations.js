const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration(filename) {
  const filepath = path.join(__dirname, 'migrations', filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`\n📄 Running migration: ${filename}`);

  try {
    await pool.query(sql);
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Error running migration ${filename}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting migrations...\n');

    // Run migrations in order
    await runMigration('19_add_service_fees_to_companies.sql');
    await runMigration('19_add_customer_service_phone.sql');
    await runMigration('21_add_branding_fields_to_companies.sql');
    await runMigration('23_add_company_id_to_customers.sql');
    await runMigration('24_add_company_id_to_routes.sql');

    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
