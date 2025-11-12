const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = databaseUrlMatch ? databaseUrlMatch[1].trim() : null;

const pool = new Pool({ connectionString: DATABASE_URL });

async function debug() {
  try {
    // 1. Ver zonas activas
    console.log('=== ZONAS ACTIVAS ===');
    const zonesResult = await pool.query('SELECT * FROM zones WHERE status = $1', ['active']);
    zonesResult.rows.forEach(z => {
      console.log(`\nZona ID ${z.id}: ${z.name}`);
      console.log(`  Color: ${z.color}`);
      console.log(`  ZipCodes raw: ${z.zipcodes}`);
      const zipCodes = typeof z.zipcodes === 'string' ? JSON.parse(z.zipcodes || '[]') : (z.zipcodes || []);
      console.log(`  ZipCodes parsed: ${JSON.stringify(zipCodes)}`);
    });

    // 2. Ver órdenes pendientes/reprogramadas
    console.log('\n\n=== ÓRDENES PENDIENTES/REPROGRAMADAS ===');
    const ordersResult = await pool.query(`
      SELECT id, ordernumber, customername, customeraddress, timeslot, zipcode, status
      FROM package_orders
      WHERE status IN ('pending', 'reprogrammed')
      ORDER BY timeslot, zipcode
      LIMIT 20
    `);

    console.log(`\nTotal órdenes: ${ordersResult.rows.length}\n`);

    // Agrupar por horario
    const byTimeSlot = {};
    ordersResult.rows.forEach(o => {
      const timeSlot = o.timeslot || 'sin_horario';
      if (!byTimeSlot[timeSlot]) {
        byTimeSlot[timeSlot] = [];
      }
      byTimeSlot[timeSlot].push(o);
    });

    Object.keys(byTimeSlot).forEach(timeSlot => {
      console.log(`\n--- HORARIO: ${timeSlot} (${byTimeSlot[timeSlot].length} órdenes) ---`);
      byTimeSlot[timeSlot].forEach(o => {
        console.log(`  Orden ${o.id}: ${o.ordernumber}`);
        console.log(`    Cliente: ${o.customername}`);
        console.log(`    Dirección: ${o.customeraddress}`);
        console.log(`    ZipCode: ${o.zipcode || 'NO TIENE'}`);
        console.log(`    Status: ${o.status}`);
      });
    });

    // 3. Verificar coincidencias entre zonas y órdenes
    console.log('\n\n=== ANÁLISIS ZONAS vs ÓRDENES ===');
    zonesResult.rows.forEach(zone => {
      const zipCodes = typeof zone.zipcodes === 'string' ? JSON.parse(zone.zipcodes || '[]') : (zone.zipcodes || []);
      console.log(`\nZona "${zone.name}" (zipcodes: ${zipCodes.join(', ')})`);

      zipCodes.forEach(zipcode => {
        const ordersInZipcode = ordersResult.rows.filter(o => o.zipcode === zipcode);
        console.log(`  ZipCode ${zipcode}: ${ordersInZipcode.length} órdenes`);
        ordersInZipcode.forEach(o => {
          console.log(`    - Orden ${o.ordernumber} (${o.timeslot || 'sin horario'})`);
        });
      });
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debug();
