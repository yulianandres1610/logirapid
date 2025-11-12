const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = databaseUrlMatch ? databaseUrlMatch[1].trim() : null;

const pool = new Pool({ connectionString: DATABASE_URL });

async function fixZipcodes() {
  const client = await pool.connect();

  try {
    console.log('🔧 Corrigiendo zipcodes en package_orders...');

    const orders = await client.query(`
      SELECT id, customeraddress, address, zipcode
      FROM package_orders
    `);

    let updated = 0;
    let failed = 0;

    for (const order of orders.rows) {
      const addr = order.customeraddress || order.address || '';

      // Regex mejorado: buscar patrón STATE zipcode
      // Ejemplos: "FL 33186", "FL 33186," , "FL 33013, us"
      const zipcodeMatch = addr.match(/\b[A-Z]{2}\s+(\d{5})(?:-\d{4})?\b/);

      if (zipcodeMatch) {
        const zipcode = zipcodeMatch[1]; // Solo los primeros 5 dígitos
        await client.query(
          'UPDATE package_orders SET zipcode = $1 WHERE id = $2',
          [zipcode, order.id]
        );
        console.log(`✅ Orden ${order.id}: "${order.zipcode}" → "${zipcode}"`);
        updated++;
      } else {
        console.log(`⚠️  Orden ${order.id}: No se pudo extraer zipcode de "${addr}"`);
        failed++;
      }
    }

    console.log(`\n✅ ${updated} órdenes actualizadas con zipcode correcto`);
    console.log(`⚠️  ${failed} órdenes sin zipcode válido`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixZipcodes()
  .then(() => {
    console.log('✅ Corrección completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en corrección:', error);
    process.exit(1);
  });
