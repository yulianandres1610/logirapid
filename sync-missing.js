const { Pool } = require('pg');
const supa = new Pool({ connectionString: 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const vps = new Pool({ connectionString: 'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid', ssl: false });

function escVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return "'" + v.toISOString() + "'";
  if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function syncTable(table) {
  try {
    const [sc, vc] = await Promise.all([
      supa.query('SELECT count(*)::int as c FROM "' + table + '"'),
      vps.query('SELECT count(*)::int as c FROM "' + table + '"'),
    ]);
    const diff = sc.rows[0].c - vc.rows[0].c;
    if (diff <= 0) {
      console.log(table + ': already synced (diff=' + diff + ')');
      return 0;
    }

    console.log(table + ': ' + diff + ' rows missing, syncing...');

    // Get max id from VPS to find new rows
    const vpsMax = await vps.query('SELECT MAX(id) as m FROM "' + table + '"');
    const maxId = vpsMax.rows[0].m;

    let newRows;
    if (maxId === null || typeof maxId === 'number') {
      const numMax = maxId || 0;
      newRows = await supa.query('SELECT * FROM "' + table + '" WHERE id > ' + numMax + ' ORDER BY id');
    } else {
      const vpsIds = await vps.query('SELECT id FROM "' + table + '"');
      const idSet = new Set(vpsIds.rows.map(r => String(r.id)));
      const allRows = await supa.query('SELECT * FROM "' + table + '"');
      newRows = { rows: allRows.rows.filter(r => !idSet.has(String(r.id))) };
    }

    if (newRows.rows.length === 0) {
      console.log('  No new rows found (possible deletions in VPS)');
      return 0;
    }

    const cols = Object.keys(newRows.rows[0]);
    const colNames = cols.map(c => '"' + c + '"').join(', ');
    let synced = 0;
    for (const row of newRows.rows) {
      const vals = cols.map(c => escVal(row[c])).join(', ');
      try {
        await vps.query('INSERT INTO "' + table + '" (' + colNames + ') VALUES (' + vals + ') ON CONFLICT DO NOTHING');
        synced++;
      } catch(e) {
        console.log('  Error inserting row: ' + e.message.substring(0, 100));
      }
    }
    console.log('  Synced ' + synced + '/' + newRows.rows.length + ' rows');

    // Fix sequence
    try {
      const seqResult = await vps.query("SELECT pg_get_serial_sequence('" + table + "', 'id') as seq");
      if (seqResult.rows[0].seq) {
        const maxResult = await vps.query('SELECT COALESCE(MAX(id)::bigint, 0) + 1 as next FROM "' + table + '"');
        await vps.query("SELECT setval('" + seqResult.rows[0].seq + "', " + maxResult.rows[0].next + ", false)");
      }
    } catch(e) {}

    return synced;
  } catch(e) {
    console.log(table + ': ERROR - ' + e.message.substring(0, 100));
    return 0;
  }
}

async function main() {
  const tables = ['agency_rates_history', 'market_pos_terminals', 'print_service_printers', 'product_images'];

  // Also handle market_product_change_logs (VPS has 1 extra)
  let total = 0;
  for (const t of tables) {
    total += await syncTable(t);
  }

  // Handle the extra row in market_product_change_logs (VPS has 1 more than Supabase)
  const sCount = await supa.query('SELECT count(*)::int as c FROM market_product_change_logs');
  const vCount = await vps.query('SELECT count(*)::int as c FROM market_product_change_logs');
  console.log('\nmarket_product_change_logs: Supabase=' + sCount.rows[0].c + ' VPS=' + vCount.rows[0].c);
  if (vCount.rows[0].c > sCount.rows[0].c) {
    // Find IDs in VPS that don't exist in Supabase
    const vpsIds = await vps.query('SELECT id FROM market_product_change_logs ORDER BY id DESC LIMIT 10');
    const supaIds = await supa.query('SELECT id FROM market_product_change_logs ORDER BY id DESC LIMIT 10');
    const supaSet = new Set(supaIds.rows.map(r => r.id));
    const extras = vpsIds.rows.filter(r => !supaSet.has(r.id));
    if (extras.length > 0) {
      console.log('  VPS has extra IDs: ' + extras.map(r => r.id).join(', '));
      for (const e of extras) {
        await vps.query('DELETE FROM market_product_change_logs WHERE id = $1', [e.id]);
      }
      console.log('  Cleaned ' + extras.length + ' extra rows from VPS');
    }
  }

  console.log('\nTotal synced: ' + total + ' rows');
  await supa.end(); await vps.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
