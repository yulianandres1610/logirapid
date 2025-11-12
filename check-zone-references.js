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

async function checkZoneReferences() {
  try {
    console.log('🔍 Checking for foreign key references to zones table...\n');

    // Check for foreign key constraints
    const fkQuery = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'zones'
      ORDER BY tc.table_name;
    `);

    console.log('Foreign key constraints pointing to zones:');
    if (fkQuery.rows.length === 0) {
      console.log('  ✓ No foreign key constraints found');
    } else {
      fkQuery.rows.forEach(row => {
        console.log(`  - ${row.table_name}.${row.column_name} → zones.${row.foreign_column_name}`);
      });
    }

    // Check for columns that might reference zones (by name pattern)
    console.log('\n🔍 Checking for potential zone references by column name...\n');

    const columnQuery = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE (column_name LIKE '%zone%' OR column_name = 'zoneid')
        AND table_name != 'zones'
      ORDER BY table_name, column_name;
    `);

    console.log('Columns that might reference zones:');
    if (columnQuery.rows.length === 0) {
      console.log('  ✓ No potential zone reference columns found');
    } else {
      for (const col of columnQuery.rows) {
        console.log(`  - ${col.table_name}.${col.column_name} (${col.data_type})`);

        // Check if this column has any data
        const countQuery = await pool.query(`
          SELECT COUNT(*) as count, COUNT(DISTINCT ${col.column_name}) as distinct_count
          FROM ${col.table_name}
          WHERE ${col.column_name} IS NOT NULL
        `);

        if (countQuery.rows[0].count > 0) {
          console.log(`    → ${countQuery.rows[0].count} records with non-null values (${countQuery.rows[0].distinct_count} distinct values)`);

          // Show sample values
          const sampleQuery = await pool.query(`
            SELECT DISTINCT ${col.column_name}
            FROM ${col.table_name}
            WHERE ${col.column_name} IS NOT NULL
            ORDER BY ${col.column_name}
            LIMIT 10
          `);
          console.log(`    → Sample values: ${sampleQuery.rows.map(r => r[col.column_name]).join(', ')}`);
        }
      }
    }

    // Show current zone IDs
    console.log('\n📋 Current zone IDs and names:\n');
    const zonesQuery = await pool.query(`
      SELECT id, name, status
      FROM zones
      ORDER BY id
    `);

    zonesQuery.rows.forEach(zone => {
      console.log(`  ID ${zone.id}: ${zone.name} (${zone.status})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkZoneReferences();
