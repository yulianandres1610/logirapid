#!/usr/bin/env node
/**
 * Fast Data Copy: Supabase → VPS PostgreSQL
 *
 * Uses multi-row INSERT VALUES for dramatically faster bulk copy.
 * Schema must already exist on VPS (run setup-replication.js first).
 *
 * Usage: node vps/fast-data-copy.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manual .env.local parsing
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

const primaryPool = new Pool({
  connectionString: PRIMARY_URL.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const standbyPool = new Pool({
  connectionString: STANDBY_URL.replace(/[?&]sslmode=[^&]*/g, ''),
  ssl: false,
  max: 3,
});

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  console.log('🚀 Fast Data Copy: Supabase → VPS PostgreSQL\n');

  await primaryPool.query('SELECT 1');
  console.log('✅ Supabase connected');
  await standbyPool.query('SELECT 1');
  console.log('✅ VPS connected\n');

  const tablesResult = await primaryPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  let totalRows = 0;
  let totalTables = 0;
  const startTime = Date.now();

  for (const { table_name: table } of tablesResult.rows) {
    if (table === 'system_health_log' || table === 'failover_writes_log') continue;

    try {
      // Check how many already exist on VPS
      const vpsCount = await standbyPool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const existingRows = parseInt(vpsCount.rows[0].cnt);

      const srcCount = await primaryPool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const sourceRows = parseInt(srcCount.rows[0].cnt);

      if (sourceRows === 0) continue;

      if (existingRows >= sourceRows) {
        console.log(`  ⏭️  ${table}: ${existingRows}/${sourceRows} rows (already synced)`);
        continue;
      }

      console.log(`  📥 ${table}: ${sourceRows} rows (${existingRows} already on VPS)...`);

      // For tables with existing data, truncate and re-insert to avoid conflicts
      if (existingRows > 0 && existingRows < sourceRows) {
        await standbyPool.query(`TRUNCATE "${table}" CASCADE`);
      }

      // Read in batches and do multi-row INSERT
      const batchSize = 1000;
      let copied = 0;

      for (let offset = 0; offset < sourceRows; offset += batchSize) {
        const dataResult = await primaryPool.query(
          `SELECT * FROM "${table}" ORDER BY ctid LIMIT ${batchSize} OFFSET ${offset}`
        );

        if (dataResult.rows.length === 0) break;

        const cols = Object.keys(dataResult.rows[0]);
        const colNames = cols.map(c => `"${c}"`).join(', ');

        // Build multi-row VALUES
        const rowChunks = [];
        // Sub-batch: 100 rows per INSERT to avoid query size limits
        const subBatch = 100;
        for (let i = 0; i < dataResult.rows.length; i += subBatch) {
          const chunk = dataResult.rows.slice(i, i + subBatch);
          const valuesList = chunk.map(row => {
            const vals = cols.map(c => escapeValue(row[c]));
            return `(${vals.join(', ')})`;
          }).join(',\n');

          const sql = `INSERT INTO "${table}" (${colNames}) VALUES ${valuesList} ON CONFLICT DO NOTHING`;
          try {
            await standbyPool.query(sql);
          } catch (err) {
            // If bulk fails, fall back to individual inserts for this chunk
            for (const row of chunk) {
              const vals = cols.map(c => escapeValue(row[c]));
              try {
                await standbyPool.query(
                  `INSERT INTO "${table}" (${colNames}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING`
                );
              } catch (e) {
                // skip
              }
            }
          }
        }

        copied += dataResult.rows.length;
        if (copied % 5000 === 0 || copied === sourceRows) {
          const pct = ((copied / sourceRows) * 100).toFixed(0);
          process.stdout.write(`    ${copied}/${sourceRows} (${pct}%)\r`);
        }
      }

      console.log(`  ✅ ${table}: ${copied} rows copied                    `);
      totalRows += copied;
      totalTables++;
    } catch (err) {
      console.error(`  ❌ ${table}: ${err.message.substring(0, 120)}`);
    }
  }

  // Sync sequences
  console.log('\n🔢 Syncing sequence values...');
  const seqResult = await primaryPool.query(`
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `);

  for (const { sequence_name: seq } of seqResult.rows) {
    try {
      const tableName = seq.replace(/_id_seq$/, '');
      const maxResult = await standbyPool.query(`SELECT COALESCE(MAX(id), 0) + 1 as next FROM "${tableName}"`);
      const nextVal = maxResult.rows[0].next;
      if (nextVal > 1) {
        await standbyPool.query(`SELECT setval('${seq}', ${nextVal}, false)`);
      }
    } catch (err) {
      // Not all sequences follow the tablename_id_seq pattern
    }
  }
  console.log('✅ Sequences synced');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n📊 Summary: ${totalRows} rows across ${totalTables} tables in ${elapsed}s`);
  console.log('✅ Data copy complete!');

  await primaryPool.end();
  await standbyPool.end();
}

main().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
