const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = databaseUrlMatch ? databaseUrlMatch[1].trim() : null;

const pool = new Pool({ connectionString: DATABASE_URL });

async function check() {
  try {
    // Check zones
    console.log('=== ZONES ===');
    const zonesResult = await pool.query('SELECT id, name, zipcodes FROM zones WHERE status = $1', ['active']);
    zonesResult.rows.forEach(z => {
      console.log(`\nZone ID ${z.id}: ${z.name}`);
      console.log(`  Raw zipcodes: ${z.zipcodes}`);
      console.log(`  Type: ${typeof z.zipcodes}`);
      const parsed = typeof z.zipcodes === 'string' ? JSON.parse(z.zipcodes) : z.zipcodes;
      console.log(`  Parsed: ${JSON.stringify(parsed)}`);
      console.log(`  First zipcode type: ${typeof parsed[0]}`);
    });

    // Check orders
    console.log('\n\n=== ORDERS (first 5) ===');
    const ordersResult = await pool.query(`
      SELECT id, ordernumber, zipcode
      FROM package_orders
      WHERE status IN ('pending', 'reprogrammed')
      ORDER BY id
      LIMIT 5
    `);

    ordersResult.rows.forEach(o => {
      console.log(`\nOrder ${o.id}: ${o.ordernumber}`);
      console.log(`  Zipcode: ${o.zipcode}`);
      console.log(`  Type: ${typeof o.zipcode}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
