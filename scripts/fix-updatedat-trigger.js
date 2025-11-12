const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Cargar DATABASE_URL desde .env.local manualmente
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

async function fixUpdatedAtTrigger() {
  const client = await pool.connect();

  try {
    console.log('🔧 Modificando función update_updated_at_column() para soportar updatedat...');

    // Reemplazar la función existente para que soporte ambos nombres de columna
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Intentar actualizar updatedat (sin guión bajo)
        IF TG_TABLE_NAME = 'package_orders' THEN
          NEW.updatedat = CURRENT_TIMESTAMP;
        ELSE
          -- Para otras tablas, usar updated_at (con guión bajo)
          NEW.updated_at = CURRENT_TIMESTAMP;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Función update_updated_at_column() modificada para soportar ambos formatos');

    // Verificar
    const result = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'package_orders';
    `);

    console.log('✅ Triggers en package_orders:', result.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixUpdatedAtTrigger()
  .then(() => {
    console.log('✅ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en corrección:', error);
    process.exit(1);
  });
