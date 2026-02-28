const { Pool } = require('pg');
const supa = new Pool({ connectionString: 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const vps = new Pool({ connectionString: 'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid', ssl: false });

async function syncWithParams(table) {
  const vpsIds = await vps.query('SELECT id FROM "' + table + '"');
  const idSet = new Set(vpsIds.rows.map(r => String(r.id)));
  const allRows = await supa.query('SELECT * FROM "' + table + '"');
  const missing = allRows.rows.filter(r => !idSet.has(String(r.id)));

  if (missing.length === 0) {
    console.log(table + ': no missing rows');
    return;
  }

  console.log(table + ': ' + missing.length + ' missing rows');

  for (const row of missing) {
    const cols = Object.keys(row);
    const colNames = cols.map(c => '"' + c + '"').join(', ');
    const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
    const vals = cols.map(c => row[c]);

    try {
      await vps.query('INSERT INTO "' + table + '" (' + colNames + ') VALUES (' + placeholders + ') ON CONFLICT DO NOTHING', vals);
      console.log('  + #' + row.id);
    } catch(e) {
      console.log('  ERROR #' + row.id + ': ' + e.message.substring(0, 120));
    }
  }

  // Fix sequence
  try {
    const seqResult = await vps.query("SELECT pg_get_serial_sequence('" + table + "', 'id') as seq");
    if (seqResult.rows[0] && seqResult.rows[0].seq) {
      const maxResult = await vps.query('SELECT COALESCE(MAX(id)::bigint, 0) + 1 as next FROM "' + table + '"');
      await vps.query("SELECT setval('" + seqResult.rows[0].seq + "', " + maxResult.rows[0].next + ", false)");
    }
  } catch(e) {}
}

async function main() {
  await syncWithParams('market_pos_terminals');
  await syncWithParams('print_service_printers');
  await supa.end();
  await vps.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
