const { Client } = require('pg');

// -- Connection configs ---------------------------------------------------
const supabaseConfig = {
  connectionString:
    'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
};

const vpsConfig = {
  connectionString:
    'postgresql://postgres:ZYJfVKLtuDKDEfBXNU8XYFnH@74.208.221.56:5433/logirapid',
  ssl: false,
};

// -- Helpers --------------------------------------------------------------
function banner(title) {
  const line = '='.repeat(60);
  console.log('\n' + line + '\n  ' + title + '\n' + line);
}

// -- PHASE 1: Migrate Functions -------------------------------------------
async function migrateFunctions() {
  banner('PHASE 1: Migrate Functions');

  const src = new Client(supabaseConfig);
  const dst = new Client(vpsConfig);

  await src.connect();
  await dst.connect();

  const { rows } = await src.query(`
    SELECT
      p.proname                                AS name,
      pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_functiondef(p.oid)                AS funcdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `);

  console.log('\nFound ' + rows.length + ' functions in Supabase (public schema).\n');

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const row of rows) {
    const label = row.name + '(' + row.args + ')';
    try {
      let ddl = row.funcdef;
      // Make it CREATE OR REPLACE so it overwrites existing definitions
      if (ddl.startsWith('CREATE FUNCTION')) {
        ddl = 'CREATE OR REPLACE FUNCTION' + ddl.slice('CREATE FUNCTION'.length);
      }
      await dst.query(ddl);
      console.log('  [OK]   ' + label);
      ok++;
    } catch (err) {
      const msg = err.message.split('\n')[0];
      console.log('  [FAIL] ' + label + '  ->  ' + msg);
      failures.push({ label, error: msg });
      fail++;
    }
  }

  console.log('\nFunctions summary: ' + ok + ' created, ' + fail + ' failed out of ' + rows.length + ' total.');
  if (failures.length) {
    console.log('\nFailed functions:');
    failures.forEach(function (f) { console.log('  - ' + f.label + ': ' + f.error); });
  }

  await src.end();
  await dst.end();

  return { total: rows.length, ok, fail };
}

// -- PHASE 2: Migrate Triggers --------------------------------------------
async function migrateTriggers() {
  banner('PHASE 2: Migrate Triggers');

  const src = new Client(supabaseConfig);
  const dst = new Client(vpsConfig);

  await src.connect();
  await dst.connect();

  const { rows } = await src.query(`
    SELECT
      tg.tgname                          AS trigger_name,
      cls.relname                        AS table_name,
      nst.nspname                        AS table_schema,
      p.proname                          AS function_name,
      np.nspname                         AS function_schema,
      tg.tgtype                          AS tg_type,
      pg_get_triggerdef(tg.oid)          AS triggerdef
    FROM pg_trigger tg
    JOIN pg_class   cls ON tg.tgrelid      = cls.oid
    JOIN pg_namespace nst ON cls.relnamespace = nst.oid
    JOIN pg_proc    p   ON tg.tgfoid       = p.oid
    JOIN pg_namespace np ON p.pronamespace  = np.oid
    WHERE nst.nspname = 'public'
      AND NOT tg.tgisinternal
    ORDER BY cls.relname, tg.tgname
  `);

  console.log('\nFound ' + rows.length + ' triggers in Supabase (public schema).\n');

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const row of rows) {
    const label = row.trigger_name + ' ON ' + row.table_schema + '.' + row.table_name;
    try {
      // Drop existing trigger first, then recreate
      const dropSQL = 'DROP TRIGGER IF EXISTS "' + row.trigger_name + '" ON "' + row.table_schema + '"."' + row.table_name + '"';
      await dst.query(dropSQL);

      // pg_get_triggerdef gives us the full CREATE TRIGGER statement
      await dst.query(row.triggerdef);
      console.log('  [OK]   ' + label);
      ok++;
    } catch (err) {
      const msg = err.message.split('\n')[0];
      console.log('  [FAIL] ' + label + '  ->  ' + msg);
      failures.push({ label, error: msg });
      fail++;
    }
  }

  console.log('\nTriggers summary: ' + ok + ' created, ' + fail + ' failed out of ' + rows.length + ' total.');
  if (failures.length) {
    console.log('\nFailed triggers:');
    failures.forEach(function (f) { console.log('  - ' + f.label + ': ' + f.error); });
  }

  await src.end();
  await dst.end();

  return { total: rows.length, ok, fail };
}

// -- PHASE 3: Verify Counts -----------------------------------------------
async function verifyCounts() {
  banner('PHASE 3: Verification');

  const src = new Client(supabaseConfig);
  const dst = new Client(vpsConfig);

  await src.connect();
  await dst.connect();

  const funcQuery = `
    SELECT count(*) AS cnt
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  `;
  const trigQuery = `
    SELECT count(*) AS cnt
    FROM pg_trigger tg
    JOIN pg_class   cls ON tg.tgrelid = cls.oid
    JOIN pg_namespace ns ON cls.relnamespace = ns.oid
    WHERE ns.nspname = 'public'
      AND NOT tg.tgisinternal
  `;

  const [srcFunc, dstFunc, srcTrig, dstTrig] = await Promise.all([
    src.query(funcQuery),
    dst.query(funcQuery),
    src.query(trigQuery),
    dst.query(trigQuery),
  ]);

  console.log('\n  Resource         Supabase    VPS');
  console.log('  ---------------  --------    ---');
  console.log('  Functions        ' + String(srcFunc.rows[0].cnt).padStart(8) + '    ' + String(dstFunc.rows[0].cnt).padStart(3));
  console.log('  Triggers         ' + String(srcTrig.rows[0].cnt).padStart(8) + '    ' + String(dstTrig.rows[0].cnt).padStart(3));

  const funcMatch = srcFunc.rows[0].cnt === dstFunc.rows[0].cnt;
  const trigMatch = srcTrig.rows[0].cnt === dstTrig.rows[0].cnt;

  console.log('\n  Functions match: ' + (funcMatch ? 'YES' : 'NO  (delta: ' + (srcFunc.rows[0].cnt - dstFunc.rows[0].cnt) + ')'));
  console.log('  Triggers  match: ' + (trigMatch ? 'YES' : 'NO  (delta: ' + (srcTrig.rows[0].cnt - dstTrig.rows[0].cnt) + ')'));

  await src.end();
  await dst.end();
}

// -- Main -----------------------------------------------------------------
(async () => {
  try {
    await migrateFunctions();
    await migrateTriggers();
    await verifyCounts();
    console.log('\nDone.\n');
  } catch (err) {
    console.error('\nFATAL:', err);
    process.exit(1);
  }
})();
