const { Pool } = require('pg');
const supa = new Pool({ connectionString: 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const vps = new Pool({ connectionString: 'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid', ssl: false });

async function main() {
  // Get CHECK constraints from Supabase (only real CHECK, not NOT NULL)
  const supaChecks = await supa.query(`
    SELECT
      con.conname as constraint_name,
      cls.relname as table_name,
      pg_get_constraintdef(con.oid, true) as definition
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype = 'c'
    ORDER BY cls.relname, con.conname
  `);

  console.log('CHECK constraints in Supabase: ' + supaChecks.rows.length);
  for (const c of supaChecks.rows) {
    console.log('  ' + c.table_name + '.' + c.constraint_name + ': ' + c.definition);
  }

  // Migrate each
  console.log('\nMigrating...');
  let ok = 0, fail = 0;
  for (const c of supaChecks.rows) {
    const sql = 'ALTER TABLE "' + c.table_name + '" ADD CONSTRAINT "' + c.constraint_name + '" ' + c.definition;
    try {
      await vps.query(sql);
      ok++;
      console.log('  ✓ ' + c.constraint_name);
    } catch (e) {
      if (e.message.includes('already exists')) {
        ok++;
        console.log('  ~ ' + c.constraint_name + ' (exists)');
      } else {
        fail++;
        console.log('  ✗ ' + c.constraint_name + ': ' + e.message.substring(0, 100));
      }
    }
  }
  console.log('\nResult: ' + ok + ' OK, ' + fail + ' failed');

  await supa.end();
  await vps.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
