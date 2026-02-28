const { Pool } = require('pg');
const supa = new Pool({ connectionString: 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const vps = new Pool({ connectionString: 'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid', ssl: false });

async function main() {
  // Get UNIQUE and FOREIGN KEY constraint definitions from Supabase
  // pg_get_constraintdef gives us the full definition
  const supaConstraints = await supa.query(`
    SELECT
      con.conname as constraint_name,
      con.contype as constraint_type,
      cls.relname as table_name,
      pg_get_constraintdef(con.oid, true) as definition
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype IN ('f', 'u')
    ORDER BY con.contype, cls.relname, con.conname
  `);

  // Get existing constraints in VPS
  const vpsConstraints = await vps.query(`
    SELECT conname FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
  `);
  const vpsSet = new Set(vpsConstraints.rows.map(r => r.conname));

  const missing = supaConstraints.rows.filter(r => !vpsSet.has(r.constraint_name));
  const fk = missing.filter(r => r.constraint_type === 'f');
  const uq = missing.filter(r => r.constraint_type === 'u');

  console.log('Missing FOREIGN KEY: ' + fk.length);
  console.log('Missing UNIQUE: ' + uq.length);
  console.log('');

  // Migrate UNIQUE constraints first (they may be referenced by FK)
  let uqOk = 0, uqFail = 0;
  console.log('=== UNIQUE CONSTRAINTS ===');
  for (const c of uq) {
    const sql = 'ALTER TABLE "' + c.table_name + '" ADD CONSTRAINT "' + c.constraint_name + '" ' + c.definition;
    try {
      await vps.query(sql);
      uqOk++;
      console.log('  ✓ ' + c.constraint_name + ' (' + c.table_name + ')');
    } catch (e) {
      // If it already exists or there's a duplicate, skip
      if (e.message.includes('already exists')) {
        console.log('  ~ ' + c.constraint_name + ' (already exists)');
        uqOk++;
      } else {
        uqFail++;
        console.log('  ✗ ' + c.constraint_name + ' (' + c.table_name + '): ' + e.message.substring(0, 100));
      }
    }
  }
  console.log('UNIQUE: ' + uqOk + ' OK, ' + uqFail + ' failed\n');

  // Migrate FOREIGN KEY constraints
  let fkOk = 0, fkFail = 0;
  const fkErrors = [];
  console.log('=== FOREIGN KEY CONSTRAINTS ===');
  for (const c of fk) {
    const sql = 'ALTER TABLE "' + c.table_name + '" ADD CONSTRAINT "' + c.constraint_name + '" ' + c.definition;
    try {
      await vps.query(sql);
      fkOk++;
    } catch (e) {
      if (e.message.includes('already exists')) {
        fkOk++;
      } else {
        fkFail++;
        fkErrors.push({ name: c.constraint_name, table: c.table_name, error: e.message.substring(0, 120) });
      }
    }
  }

  // Show summary
  console.log('FOREIGN KEY: ' + fkOk + ' OK, ' + fkFail + ' failed');
  if (fkErrors.length > 0) {
    console.log('\nFK Errors (may need data cleanup):');
    for (const e of fkErrors.slice(0, 30)) {
      console.log('  ' + e.name + ' (' + e.table + '): ' + e.error);
    }
    if (fkErrors.length > 30) {
      console.log('  ... and ' + (fkErrors.length - 30) + ' more');
    }
  }

  // Verify
  console.log('\n=== VERIFICATION ===');
  const vpsAfter = await vps.query(`
    SELECT con.contype, COUNT(*) as cnt
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
    GROUP BY con.contype
  `);
  const supaTypes = await supa.query(`
    SELECT con.contype, COUNT(*) as cnt
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
    GROUP BY con.contype
  `);

  const typeNames = { p: 'PRIMARY KEY', u: 'UNIQUE', f: 'FOREIGN KEY', c: 'CHECK' };
  console.log('Type           | Supabase | VPS');
  console.log('---------------|----------|----');
  for (const st of supaTypes.rows) {
    const vt = vpsAfter.rows.find(r => r.contype === st.contype);
    console.log('  ' + (typeNames[st.contype] || st.contype).padEnd(14) + '| ' + String(st.cnt).padEnd(9) + '| ' + (vt ? vt.cnt : 0));
  }

  await supa.end();
  await vps.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
