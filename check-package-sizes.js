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

async function checkPackageSizes() {
  try {
    console.log('🔍 Checking package_sizes table...');

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'package_sizes'
      );
    `);

    console.log('package_sizes exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Get table structure
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'package_sizes'
        ORDER BY ordinal_position;
      `);

      console.log('\nTable structure:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });

      // Get data
      const data = await pool.query('SELECT * FROM package_sizes ORDER BY id DESC LIMIT 5');
      console.log(`\nRecords found: ${data.rows.length}`);
      if (data.rows.length > 0) {
        console.log('Records:', JSON.stringify(data.rows, null, 2));
      }
    } else {
      console.log('\n❌ Table does not exist! Need to create it.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPackageSizes();
