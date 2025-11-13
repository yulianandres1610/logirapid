const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Ejecutando migración de tablas de rutas de almacenes...\n');

    const migrationPath = path.join(__dirname, '..', 'migrations', 'create_warehouse_routes_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);

    console.log('✅ Migración completada exitosamente!\n');
    console.log('Tablas creadas:');
    console.log('  - warehouse_routes');
    console.log('  - warehouse_route_stops');
    console.log('  - warehouse_stop_scans');
    console.log('\nTriggers creados:');
    console.log('  - update_stop_scanned_packages()');
    console.log('  - update_route_totals()');

    // Verificar las tablas
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'warehouse%'
      ORDER BY table_name
    `);

    console.log('\n📋 Tablas warehouse encontradas:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
