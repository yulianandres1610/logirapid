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

async function fixZoneIds() {
  const client = await pool.connect();

  try {
    console.log('🔧 Starting zone ID renumbering...\n');

    // Start transaction
    await client.query('BEGIN');

    // Get all zones in natural sort order
    const zonesResult = await client.query(`
      SELECT id, name, companyid, description, zipcodes, color, timeslot, status, createdat, updatedat
      FROM zones
      ORDER BY
        CAST(NULLIF(regexp_replace(name, '[^0-9]', '', 'g'), '') AS INTEGER) NULLS LAST,
        name
    `);

    const zones = zonesResult.rows;
    console.log(`Found ${zones.length} zones to renumber\n`);

    // Show current state
    console.log('Current zone IDs:');
    zones.forEach((zone, index) => {
      console.log(`  ${index + 1}. ID ${zone.id} → ${zone.name}`);
    });

    console.log('\n📝 Step 1: Assigning temporary IDs (offset by 1000)...\n');

    // First pass: assign temporary IDs to avoid conflicts
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const tempId = 1000 + i + 1;

      await client.query(`
        UPDATE zones
        SET id = $1
        WHERE id = $2
      `, [tempId, zone.id]);

      console.log(`  ✓ ${zone.name}: ${zone.id} → ${tempId} (temp)`);
    }

    console.log('\n📝 Step 2: Assigning final sequential IDs...\n');

    // Second pass: assign final sequential IDs
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const finalId = i + 1;
      const tempId = 1000 + i + 1;

      await client.query(`
        UPDATE zones
        SET id = $1
        WHERE id = $2
      `, [finalId, tempId]);

      console.log(`  ✓ ${zone.name}: ${tempId} (temp) → ${finalId} (final)`);
    }

    // Reset the sequence for future inserts
    const maxId = zones.length;
    await client.query(`
      SELECT setval(pg_get_serial_sequence('zones', 'id'), $1, true)
    `, [maxId]);

    console.log(`\n✓ Sequence reset to start at ${maxId + 1} for next insert`);

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n✅ Zone IDs renumbered successfully!\n');

    // Verify the new order
    const verifyResult = await client.query(`
      SELECT id, name
      FROM zones
      ORDER BY id
    `);

    console.log('Final zone order:');
    verifyResult.rows.forEach(zone => {
      console.log(`  ID ${zone.id}: ${zone.name}`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during migration:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixZoneIds().catch(err => {
  console.error('Failed to fix zone IDs:', err);
  process.exit(1);
});
