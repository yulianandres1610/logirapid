const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Aplicando migración de service_fees...\n');

    const migrationPath = path.join(__dirname, '../migrations/19_add_service_fees_to_companies.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Ejecutando SQL...');
    await pool.query(migrationSQL);

    console.log('✅ Migración aplicada exitosamente!\n');

    // Verificar que la columna existe
    const checkResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'service_fees'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✓ Columna service_fees creada correctamente');
      console.log(`  Tipo: ${checkResult.rows[0].data_type}`);
    }

  } catch (error) {
    console.error('❌ Error aplicando migración:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
