const { Pool } = require('pg');
const supa = new Pool({ connectionString: 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const vps = new Pool({ connectionString: 'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid', ssl: false });

async function main() {
  const tables = await supa.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");

  let totalDiff = 0;
  let issues = [];
  let ok = 0;

  for (const { table_name: t } of tables.rows) {
    if (t === 'system_health_log' || t === 'failover_writes_log') continue;
    try {
      const [sc, vc] = await Promise.all([
        supa.query('SELECT count(*)::int as c FROM "' + t + '"'),
        vps.query('SELECT count(*)::int as c FROM "' + t + '"').catch(() => ({ rows: [{ c: -1 }] })),
      ]);
      const s = sc.rows[0].c;
      const v = vc.rows[0].c;
      const diff = s - v;

      if (v === -1) {
        issues.push({ table: t, supabase: s, vps: 'MISSING', diff: s });
        totalDiff += s;
      } else if (diff !== 0) {
        issues.push({ table: t, supabase: s, vps: v, diff });
        totalDiff += Math.abs(diff);
      } else {
        ok++;
      }
    } catch(e) {
      issues.push({ table: t, error: e.message });
    }
  }

  console.log('════════════════════════════════════════════════════');
  console.log('  AUDITORÍA COMPLETA: Supabase vs VPS');
  console.log('════════════════════════════════════════════════════');
  console.log('Tablas sincronizadas (iguales): ' + ok + '/' + tables.rows.length);
  console.log('Tablas con diferencias: ' + issues.length);
  console.log('Total filas de diferencia: ' + totalDiff);
  console.log('');

  if (issues.length > 0) {
    console.log('TABLAS CON DIFERENCIAS:');
    console.log('─────────────────────────────────────────────────');
    for (const i of issues) {
      if (i.error) {
        console.log('  ERROR ' + i.table + ': ' + i.error);
      } else {
        console.log('  ' + i.table + ': Supabase=' + i.supabase + ' VPS=' + i.vps + ' (diff=' + i.diff + ')');
      }
    }
  }

  await supa.end(); await vps.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
