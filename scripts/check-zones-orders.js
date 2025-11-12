const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = databaseUrlMatch ? databaseUrlMatch[1].trim() : null;

const pool = new Pool({ connectionString: DATABASE_URL });

async function check() {
  // Verificar zonas
  const zonesResult = await pool.query('SELECT * FROM zones WHERE status = $1', ['active']);
  console.log('=== ZONAS ACTIVAS ===');
  zonesResult.rows.forEach(z => {
    console.log(`Zona: ${z.name}, ZipCodes: ${z.zipcodes}`);
  });

  console.log('\n=== ÓRDENES PENDIENTES ===');
  const ordersResult = await pool.query(`
    SELECT id, ordernumber, customername, customeraddress, address, status
    FROM package_orders
    WHERE status IN ('pending', 'reprogrammed')
    ORDER BY id
    LIMIT 10
  `);

  ordersResult.rows.forEach(o => {
    const addr = o.customeraddress || o.address || 'N/A';
    console.log(`Orden ${o.id}: ${o.ordernumber} - ${o.customername}`);
    console.log(`  Dirección: ${typeof addr === 'string' ? addr : JSON.stringify(addr)}`);
    console.log(`  Status: ${o.status}`);
  });

  await pool.end();
}

check().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
