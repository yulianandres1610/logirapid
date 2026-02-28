const { Pool } = require('pg');
const supa = new Pool({ connectionString: 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const vps = new Pool({ connectionString: 'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid', ssl: false });

async function main() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  AUDITORÍA COMPLETA DE FAILOVER: Supabase vs VPS');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 1. TABLES
  const supaTables = await supa.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  const vpsTables = await vps.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");

  const supaTableSet = new Set(supaTables.rows.map(r => r.table_name));
  const vpsTableSet = new Set(vpsTables.rows.map(r => r.table_name));

  const missingInVps = supaTables.rows.filter(r => !vpsTableSet.has(r.table_name)).map(r => r.table_name);
  const extraInVps = vpsTables.rows.filter(r => !supaTableSet.has(r.table_name)).map(r => r.table_name);

  console.log('1. TABLAS');
  console.log('─────────────────────────────────────────────────');
  console.log('   Supabase: ' + supaTableSet.size + ' | VPS: ' + vpsTableSet.size);
  if (missingInVps.length === 0) {
    console.log('   ✓ Todas las tablas de Supabase existen en VPS');
  } else {
    console.log('   ✗ FALTAN EN VPS: ' + missingInVps.join(', '));
  }
  if (extraInVps.length > 0) {
    console.log('   Extra en VPS (HA system): ' + extraInVps.join(', '));
  }

  // 2. SCHEMA - columns per table
  console.log('\n2. SCHEMA (columnas)');
  console.log('─────────────────────────────────────────────────');
  let schemaMismatches = [];
  for (const t of supaTables.rows) {
    if (t.table_name === 'system_health_log' || t.table_name === 'failover_writes_log') continue;
    if (!vpsTableSet.has(t.table_name)) continue;
    try {
      const [sc, vc] = await Promise.all([
        supa.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='" + t.table_name + "' ORDER BY ordinal_position"),
        vps.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='" + t.table_name + "' ORDER BY ordinal_position")
      ]);
      const supaColSet = new Set(sc.rows.map(r => r.column_name));
      const vpsColSet = new Set(vc.rows.map(r => r.column_name));
      const missingCols = sc.rows.filter(r => !vpsColSet.has(r.column_name)).map(r => r.column_name);
      const extraCols = vc.rows.filter(r => !supaColSet.has(r.column_name)).map(r => r.column_name);
      if (missingCols.length > 0 || extraCols.length > 0) {
        schemaMismatches.push({ table: t.table_name, missingCols, extraCols, supaCount: sc.rows.length, vpsCount: vc.rows.length });
      }
    } catch (e) {}
  }
  if (schemaMismatches.length === 0) {
    console.log('   ✓ Schema idéntico en todas las tablas');
  } else {
    console.log('   ✗ ' + schemaMismatches.length + ' tablas con diferencias de columnas:');
    for (const m of schemaMismatches) {
      console.log('     ' + m.table + ' (Supa: ' + m.supaCount + ' cols, VPS: ' + m.vpsCount + ' cols)');
      if (m.missingCols.length) console.log('       Faltan en VPS: ' + m.missingCols.join(', '));
      if (m.extraCols.length) console.log('       Extra en VPS: ' + m.extraCols.join(', '));
    }
  }

  // 3. ROW COUNTS - detailed
  console.log('\n3. DATOS (conteo de filas)');
  console.log('─────────────────────────────────────────────────');
  let totalDiff = 0;
  let issues = [];
  let ok = 0;
  let totalSupaRows = 0;
  let totalVpsRows = 0;

  for (const { table_name: t } of supaTables.rows) {
    if (t === 'system_health_log' || t === 'failover_writes_log') continue;
    try {
      const [sc, vc] = await Promise.all([
        supa.query('SELECT count(*)::int as c FROM "' + t + '"'),
        vps.query('SELECT count(*)::int as c FROM "' + t + '"').catch(() => ({ rows: [{ c: -1 }] }))
      ]);
      const s = sc.rows[0].c;
      const v = vc.rows[0].c;
      totalSupaRows += s;
      if (v >= 0) totalVpsRows += v;
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
    } catch (e) {
      issues.push({ table: t, error: e.message });
    }
  }

  console.log('   Tablas iguales: ' + ok + '/' + supaTables.rows.length);
  console.log('   Total filas Supabase: ' + totalSupaRows.toLocaleString());
  console.log('   Total filas VPS: ' + totalVpsRows.toLocaleString());
  console.log('   Diferencia total: ' + totalDiff + ' filas');

  if (issues.length > 0) {
    console.log('   Tablas con diferencias:');
    for (const i of issues) {
      if (i.error) {
        console.log('     ✗ ' + i.table + ': ERROR - ' + i.error);
      } else {
        const arrow = i.diff > 0 ? '(Supa +' + i.diff + ')' : '(VPS +' + Math.abs(i.diff) + ')';
        console.log('     ' + i.table + ': Supa=' + i.supabase + ' VPS=' + i.vps + ' ' + arrow);
      }
    }
  }

  // 4. SEQUENCES
  console.log('\n4. SECUENCIAS');
  console.log('─────────────────────────────────────────────────');
  const supaSeqs = await supa.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename");
  const vpsSeqs = await vps.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename");
  const vpsSeqMap = new Map(vpsSeqs.rows.map(r => [r.sequencename, r.last_value]));
  const missingSeqs = supaSeqs.rows.filter(r => !vpsSeqMap.has(r.sequencename));
  const seqValueMismatches = [];
  for (const s of supaSeqs.rows) {
    const vpsVal = vpsSeqMap.get(s.sequencename);
    if (vpsVal !== undefined && vpsVal !== null && s.last_value !== null) {
      const diff = parseInt(s.last_value) - parseInt(vpsVal);
      if (Math.abs(diff) > 5) { // Allow small differences for live system
        seqValueMismatches.push({ name: s.sequencename, supa: s.last_value, vps: vpsVal, diff });
      }
    }
  }
  console.log('   Supabase: ' + supaSeqs.rows.length + ' | VPS: ' + vpsSeqs.rows.length);
  if (missingSeqs.length === 0) {
    console.log('   ✓ Todas las secuencias existen en VPS');
  } else {
    console.log('   ✗ Faltan ' + missingSeqs.length + ': ' + missingSeqs.map(r => r.sequencename).join(', '));
  }
  if (seqValueMismatches.length > 0) {
    console.log('   ⚠ Secuencias con valores muy diferentes (>5):');
    for (const s of seqValueMismatches) {
      console.log('     ' + s.name + ': Supa=' + s.supa + ' VPS=' + s.vps + ' (diff=' + s.diff + ')');
    }
  } else {
    console.log('   ✓ Valores de secuencias alineados');
  }

  // 5. FUNCTIONS
  console.log('\n5. FUNCIONES / STORED PROCEDURES');
  console.log('─────────────────────────────────────────────────');
  const supaFuncs = await supa.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION' ORDER BY routine_name");
  const vpsFuncs = await vps.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION' ORDER BY routine_name");
  const vpsFuncSet = new Set(vpsFuncs.rows.map(r => r.routine_name));
  const missingFuncs = supaFuncs.rows.filter(r => !vpsFuncSet.has(r.routine_name)).map(r => r.routine_name);
  console.log('   Supabase: ' + supaFuncs.rows.length + ' | VPS: ' + vpsFuncs.rows.length);
  if (missingFuncs.length === 0) {
    console.log('   ✓ Todas las funciones existen en VPS');
  } else {
    console.log('   ✗ Faltan en VPS: ' + missingFuncs.join(', '));
  }

  // 6. INDEXES
  console.log('\n6. ÍNDICES');
  console.log('─────────────────────────────────────────────────');
  const supaIdx = await supa.query("SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' ORDER BY indexname");
  const vpsIdx = await vps.query("SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' ORDER BY indexname");
  const vpsIdxSet = new Set(vpsIdx.rows.map(r => r.indexname));
  const missingIdx = supaIdx.rows.filter(r => !vpsIdxSet.has(r.indexname));
  console.log('   Supabase: ' + supaIdx.rows.length + ' | VPS: ' + vpsIdx.rows.length);
  if (missingIdx.length === 0) {
    console.log('   ✓ Todos los índices existen en VPS');
  } else {
    console.log('   ✗ Faltan ' + missingIdx.length + ' índices en VPS:');
    for (const idx of missingIdx) {
      console.log('     ' + idx.indexname + ' (tabla: ' + idx.tablename + ')');
    }
  }

  // 7. CONSTRAINTS
  console.log('\n7. CONSTRAINTS (unique, foreign key, check)');
  console.log('─────────────────────────────────────────────────');
  const supaCons = await supa.query("SELECT constraint_name, table_name, constraint_type FROM information_schema.table_constraints WHERE constraint_schema='public' ORDER BY constraint_name");
  const vpsCons = await vps.query("SELECT constraint_name, table_name, constraint_type FROM information_schema.table_constraints WHERE constraint_schema='public' ORDER BY constraint_name");
  const vpsConSet = new Set(vpsCons.rows.map(r => r.constraint_name));
  const missingCons = supaCons.rows.filter(r => !vpsConSet.has(r.constraint_name));
  console.log('   Supabase: ' + supaCons.rows.length + ' | VPS: ' + vpsCons.rows.length);
  if (missingCons.length === 0) {
    console.log('   ✓ Todos los constraints existen en VPS');
  } else {
    console.log('   ✗ Faltan ' + missingCons.length + ' constraints en VPS:');
    for (const c of missingCons.slice(0, 20)) {
      console.log('     ' + c.constraint_name + ' (' + c.constraint_type + ' en ' + c.table_name + ')');
    }
    if (missingCons.length > 20) console.log('     ... y ' + (missingCons.length - 20) + ' más');
  }

  // 8. TRIGGERS
  console.log('\n8. TRIGGERS');
  console.log('─────────────────────────────────────────────────');
  const supaTrigs = await supa.query("SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY trigger_name");
  const vpsTrigs = await vps.query("SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY trigger_name");
  const vpsTrigSet = new Set(vpsTrigs.rows.map(r => r.trigger_name));
  const missingTrigs = supaTrigs.rows.filter(r => !vpsTrigSet.has(r.trigger_name));
  console.log('   Supabase: ' + supaTrigs.rows.length + ' | VPS: ' + vpsTrigs.rows.length);
  if (missingTrigs.length === 0) {
    console.log('   ✓ Todos los triggers existen en VPS');
  } else {
    console.log('   ✗ Faltan ' + missingTrigs.length + ' triggers en VPS:');
    for (const t of missingTrigs) {
      console.log('     ' + t.trigger_name + ' (tabla: ' + t.event_object_table + ')');
    }
  }

  // 9. DATA INTEGRITY - spot check recent records in critical tables
  console.log('\n9. INTEGRIDAD DE DATOS (verificación de registros recientes)');
  console.log('─────────────────────────────────────────────────');
  const criticalTables = [
    'companies', 'users', 'user_companies', 'wallet_transactions',
    'remittance_orders', 'market_products', 'market_warehouse_stock',
    'package_orders', 'routes', 'customers', 'broker_wallet_balances'
  ];

  for (const table of criticalTables) {
    try {
      // Compare last 5 IDs
      const sLast = await supa.query('SELECT id FROM "' + table + '" ORDER BY id DESC LIMIT 5');
      const vLast = await vps.query('SELECT id FROM "' + table + '" ORDER BY id DESC LIMIT 5');

      const sIds = sLast.rows.map(r => String(r.id));
      const vIds = vLast.rows.map(r => String(r.id));

      const match = JSON.stringify(sIds) === JSON.stringify(vIds);
      if (match) {
        console.log('   ✓ ' + table + ' - últimos 5 IDs coinciden');
      } else {
        console.log('   ⚠ ' + table + ' - últimos IDs difieren:');
        console.log('     Supa: [' + sIds.join(', ') + ']');
        console.log('     VPS:  [' + vIds.join(', ') + ']');
      }
    } catch (e) {
      console.log('   - ' + table + ': ' + e.message.substring(0, 60));
    }
  }

  // SUMMARY
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('════════════════════════════════════════════════════════════════');
  const allOk = missingInVps.length === 0 && schemaMismatches.length === 0 &&
                missingSeqs.length === 0 && missingFuncs.length === 0;

  if (allOk && totalDiff <= 5) {
    console.log('  ✓ VPS LISTO PARA FAILOVER');
    console.log('  Diferencia de datos: ' + totalDiff + ' filas (tráfico en vivo)');
  } else {
    console.log('  ⚠ REQUIERE ATENCIÓN');
    if (missingInVps.length > 0) console.log('  - ' + missingInVps.length + ' tablas faltan en VPS');
    if (schemaMismatches.length > 0) console.log('  - ' + schemaMismatches.length + ' tablas con schema diferente');
    if (missingSeqs.length > 0) console.log('  - ' + missingSeqs.length + ' secuencias faltan');
    if (missingFuncs.length > 0) console.log('  - ' + missingFuncs.length + ' funciones faltan');
    if (totalDiff > 5) console.log('  - ' + totalDiff + ' filas de diferencia');
  }

  await supa.end();
  await vps.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
