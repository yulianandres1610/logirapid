const { Pool } = require('pg');

// Cargar DATABASE_URL desde .env.local manualmente
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = databaseUrlMatch ? databaseUrlMatch[1].trim() : null;

if (!DATABASE_URL) {
  console.error('❌ No se encontró DATABASE_URL en .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function fixVehicleIdType() {
  const client = await pool.connect();

  try {
    console.log('🔧 Cambiando tipo de columna vehicleid en tabla routes...');

    // Cambiar vehicleid de INTEGER a VARCHAR
    await client.query(`
      ALTER TABLE routes
      ALTER COLUMN vehicleid TYPE VARCHAR(255) USING vehicleid::VARCHAR;
    `);

    console.log('✅ Columna vehicleid cambiada exitosamente a VARCHAR(255)');

    // Verificar el cambio
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'routes' AND column_name = 'vehicleid';
    `);

    console.log('✅ Verificación:', result.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixVehicleIdType()
  .then(() => {
    console.log('✅ Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  });
