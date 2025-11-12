const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
let DATABASE_URL = '';

for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    DATABASE_URL = line.substring('DATABASE_URL='.length).trim();
    break;
  }
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkZones() {
  try {
    console.log('🔍 Checking zones...\n');

    const result = await pool.query(`
      SELECT id, name, description, status
      FROM zones
      ORDER BY name
    `);

    console.log('Current zones (alphabetically):');
    result.rows.forEach(zone => {
      console.log(`  ${zone.id}. ${zone.name} - ${zone.status}`);
    });

    console.log('\n---\n');
    console.log('Zones with natural sort (desired order):');

    const naturalSort = result.rows.sort((a, b) => {
      // Extract numbers from zone names
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    naturalSort.forEach(zone => {
      console.log(`  ${zone.id}. ${zone.name} - ${zone.status}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkZones();
