const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔍 Verificando esquema de tabla warehouses...\n');

    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'warehouses'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

    console.log('Columnas de la tabla warehouses:');
    console.log('─'.repeat(80));
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      console.log(`${row.column_name.padEnd(30)} ${(row.data_type + length).padEnd(20)} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
