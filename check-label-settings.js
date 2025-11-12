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

async function checkTables() {
  try {
    console.log('🔍 Checking label_settings table...');

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'label_settings'
      );
    `);

    console.log('label_settings exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Get table structure
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'label_settings'
        ORDER BY ordinal_position;
      `);

      console.log('\nTable structure:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Get data
      const data = await pool.query('SELECT * FROM label_settings ORDER BY id DESC LIMIT 5');
      console.log(`\nRecords found: ${data.rows.length}`);
      if (data.rows.length > 0) {
        console.log('Latest record:', JSON.stringify(data.rows[0], null, 2));
      }
    }

    console.log('\n🔍 Checking package_sizes table...');

    const packageTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'package_sizes'
      );
    `);

    console.log('package_sizes exists:', packageTableCheck.rows[0].exists);

    if (packageTableCheck.rows[0].exists) {
      const packageData = await pool.query('SELECT * FROM package_sizes LIMIT 5');
      console.log(`Records in package_sizes: ${packageData.rows.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
