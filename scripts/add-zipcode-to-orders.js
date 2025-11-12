const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = databaseUrlMatch ? databaseUrlMatch[1].trim() : null;

const pool = new Pool({ connectionString: DATABASE_URL });

async function addZipcodeColumn() {
  const client = await pool.connect();

  try {
    console.log('🔧 Agregando columna zipcode a package_orders...');

    // Agregar columna zipcode
    await client.query(`
      ALTER TABLE package_orders
      ADD COLUMN IF NOT EXISTS zipcode VARCHAR(10)
    `);

    console.log('✅ Columna zipcode agregada');

    // Intentar extraer zipcodes de las direcciones existentes
    console.log('🔄 Extrayendo zipcodes de direcciones existentes...');

    const orders = await client.query(`
      SELECT id, customeraddress, address
      FROM package_orders
      WHERE zipcode IS NULL
    `);

    let updated = 0;
    for (const order of orders.rows) {
      const addr = order.customeraddress || order.address || '';
      const zipcodeMatch = addr.match(/\b(\d{5}(?:-\d{4})?)\b/);

      if (zipcodeMatch) {
        const zipcode = zipcodeMatch[1].split('-')[0]; // Solo los primeros 5 dígitos
        await client.query(
          'UPDATE package_orders SET zipcode = $1 WHERE id = $2',
          [zipcode, order.id]
        );
        updated++;
      }
    }

    console.log(`✅ ${updated} órdenes actualizadas con zipcode extraído`);
    console.log(`⚠️  ${orders.rows.length - updated} órdenes sin zipcode en la dirección`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addZipcodeColumn()
  .then(() => {
    console.log('✅ Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  });
