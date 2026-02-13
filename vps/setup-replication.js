#!/usr/bin/env node
/**
 * Schema Migration Script: Supabase → VPS PostgreSQL
 *
 * Dumps schema from Supabase (via pooler) and creates tables on VPS standby.
 * Uses information_schema introspection (works through PgBouncer).
 *
 * Usage: node vps/setup-replication.js
 *
 * Prerequisites:
 *   - VPS PostgreSQL running on port 5433
 *   - .env.local with DATABASE_URL and DATABASE_URL_STANDBY
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manual .env.local parsing (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const PRIMARY_URL = process.env.DATABASE_URL_TRANSACTION || process.env.DATABASE_URL;
const STANDBY_URL = process.env.DATABASE_URL_STANDBY;

if (!PRIMARY_URL || !STANDBY_URL) {
  console.error('Missing DATABASE_URL or DATABASE_URL_STANDBY in .env.local');
  process.exit(1);
}

const primaryPool = new Pool({
  connectionString: PRIMARY_URL.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl: { rejectUnauthorized: false },
  max: 2,
});

const standbyPool = new Pool({
  connectionString: STANDBY_URL.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl: false,
  max: 2,
});

async function getTableDefinitions() {
  console.log('📖 Reading schema from Supabase...');

  // Get all public tables
  const tablesResult = await primaryPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tables = tablesResult.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

  const ddlStatements = [];

  // First, collect all sequences that need to be created
  const seqResult = await primaryPool.query(`
    SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);

  for (const seq of seqResult.rows) {
    ddlStatements.push(`CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}" START WITH ${seq.start_value || 1} INCREMENT BY ${seq.increment || 1};`);
  }

  console.log(`Found ${seqResult.rows.length} sequences to create`);

  // Also ensure pg_trgm extension exists (used by some indexes)
  ddlStatements.push(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  for (const table of tables) {
    // Get columns
    const colsResult = await primaryPool.query(`
      SELECT
        column_name,
        data_type,
        udt_name,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    if (colsResult.rows.length === 0) continue;

    const columns = colsResult.rows.map(col => {
      let type = col.udt_name;

      // Map UDT names to SQL types
      if (type === 'int4') type = 'INTEGER';
      else if (type === 'int8') type = 'BIGINT';
      else if (type === 'int2') type = 'SMALLINT';
      else if (type === 'float4') type = 'REAL';
      else if (type === 'float8') type = 'DOUBLE PRECISION';
      else if (type === 'bool') type = 'BOOLEAN';
      else if (type === 'varchar') type = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
      else if (type === 'bpchar') type = col.character_maximum_length ? `CHAR(${col.character_maximum_length})` : 'CHAR';
      else if (type === 'numeric') type = col.numeric_precision ? `NUMERIC(${col.numeric_precision},${col.numeric_scale || 0})` : 'NUMERIC';
      else if (type === 'timestamptz') type = 'TIMESTAMP WITH TIME ZONE';
      else if (type === 'timestamp') type = 'TIMESTAMP';
      else if (type === 'jsonb') type = 'JSONB';
      else if (type === 'json') type = 'JSON';
      else if (type === 'text') type = 'TEXT';
      else if (type === 'uuid') type = 'UUID';
      else if (type === '_text') type = 'TEXT[]';
      else if (type === '_varchar') type = 'VARCHAR[]';
      else if (type === '_int4') type = 'INTEGER[]';
      else if (type === '_jsonb') type = 'JSONB[]';
      else type = col.data_type.toUpperCase();

      let def = `  "${col.column_name}" ${type}`;
      if (col.column_default) {
        // Keep the default as-is - sequences are now created above
        def += ` DEFAULT ${col.column_default}`;
      }
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL';
      }
      return def;
    });

    // Get primary key
    const pkResult = await primaryPool.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [table]);

    let pkClause = '';
    if (pkResult.rows.length > 0) {
      const pkCols = pkResult.rows.map(r => `"${r.column_name}"`).join(', ');
      pkClause = `,\n  PRIMARY KEY (${pkCols})`;
    }

    ddlStatements.push(`CREATE TABLE IF NOT EXISTS "${table}" (\n${columns.join(',\n')}${pkClause}\n);`);
  }

  // Get indexes
  const indexResult = await primaryPool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
    ORDER BY tablename, indexname
  `);

  for (const idx of indexResult.rows) {
    ddlStatements.push(idx.indexdef.replace(/CREATE INDEX/, 'CREATE INDEX IF NOT EXISTS') + ';');
  }

  return ddlStatements;
}

async function createSchemaOnStandby(ddlStatements) {
  console.log(`\n📝 Creating ${ddlStatements.length} objects on standby...`);

  let created = 0;
  let errors = 0;

  for (const ddl of ddlStatements) {
    try {
      await standbyPool.query(ddl);
      created++;
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.error(`  ❌ Error: ${err.message.substring(0, 100)}`);
        console.error(`     DDL: ${ddl.substring(0, 100)}...`);
        errors++;
      } else {
        created++;
      }
    }
  }

  console.log(`  ✅ Created: ${created}, Errors: ${errors}`);
}

async function copyData() {
  console.log('\n📦 Copying data from Supabase to standby...');

  const tablesResult = await primaryPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  for (const { table_name: table } of tablesResult.rows) {
    try {
      // Skip system tables that might already exist on standby
      if (table === 'system_health_log' || table === 'failover_writes_log') continue;

      const countResult = await primaryPool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const count = parseInt(countResult.rows[0].cnt);

      if (count === 0) {
        console.log(`  ⏭️  ${table}: empty, skipping`);
        continue;
      }

      console.log(`  📥 ${table}: ${count} rows...`);

      // Read in batches
      const batchSize = 500;
      for (let offset = 0; offset < count; offset += batchSize) {
        const dataResult = await primaryPool.query(`SELECT * FROM "${table}" LIMIT ${batchSize} OFFSET ${offset}`);

        if (dataResult.rows.length === 0) break;

        // Generate INSERT
        const cols = Object.keys(dataResult.rows[0]);
        const colNames = cols.map(c => `"${c}"`).join(', ');

        for (const row of dataResult.rows) {
          const values = cols.map((_, i) => `$${i + 1}`).join(', ');
          const params = cols.map(c => row[c]);

          try {
            await standbyPool.query(
              `INSERT INTO "${table}" (${colNames}) VALUES (${values}) ON CONFLICT DO NOTHING`,
              params
            );
          } catch (err) {
            // Skip constraint violations (data already exists)
            if (!err.message.includes('duplicate') && !err.message.includes('violates')) {
              console.error(`    ⚠️ ${table}: ${err.message.substring(0, 80)}`);
            }
          }
        }
      }

      console.log(`  ✅ ${table}: done`);
    } catch (err) {
      console.error(`  ❌ ${table}: ${err.message.substring(0, 100)}`);
    }
  }
}

async function main() {
  console.log('🚀 LogiRapid Schema Migration: Supabase → VPS PostgreSQL\n');

  try {
    // Test connections
    console.log('Testing connections...');
    console.log('  Primary URL:', PRIMARY_URL?.substring(0, 40) + '...');
    console.log('  Standby URL:', STANDBY_URL?.substring(0, 40) + '...');
    await primaryPool.query('SELECT 1');
    console.log('  ✅ Primary (Supabase) connected');
    await standbyPool.query('SELECT 1');
    console.log('  ✅ Standby (VPS) connected');

    // Step 1: Schema
    const ddl = await getTableDefinitions();
    await createSchemaOnStandby(ddl);

    // Step 2: Data
    const args = process.argv.slice(2);
    if (args.includes('--with-data')) {
      await copyData();
    } else {
      console.log('\n💡 To also copy data, run with --with-data flag');
    }

    // Step 3: Sync sequence values so auto-increment starts at the right point
    if (args.includes('--with-data')) {
      console.log('\n🔢 Syncing sequence values...');
      try {
        const seqSyncResult = await primaryPool.query(`
          SELECT
            s.relname AS seq_name,
            t.relname AS table_name,
            a.attname AS column_name
          FROM pg_class s
          JOIN pg_depend d ON d.objid = s.oid
          JOIN pg_class t ON d.refobjid = t.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
          WHERE s.relkind = 'S' AND s.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        `);

        for (const { seq_name, table_name, column_name } of seqSyncResult.rows) {
          try {
            const maxResult = await standbyPool.query(`SELECT COALESCE(MAX("${column_name}"), 0) + 1 AS next_val FROM "${table_name}"`);
            const nextVal = maxResult.rows[0].next_val;
            if (nextVal > 1) {
              await standbyPool.query(`SELECT setval('"${seq_name}"', ${nextVal}, false)`);
              console.log(`  ✅ ${seq_name} → ${nextVal}`);
            }
          } catch (err) {
            // Skip if table doesn't exist
          }
        }
      } catch (err) {
        console.error('  ⚠️ Sequence sync skipped:', err.message.substring(0, 100));
      }
    }

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Verify tables: docker exec logirapid-postgres-standby psql -U postgres -d logirapid -c "\\dt"');
    console.log('2. Add DATABASE_URL_STANDBY to Vercel environment variables');
    console.log('3. Set STORAGE_FALLBACK_ENABLED=true in Vercel');
    console.log('4. Deploy to Vercel');

  } catch (err) {
    console.error('❌ Migration failed:', err.message, err.stack);
  } finally {
    await primaryPool.end();
    await standbyPool.end();
  }
}

main();
