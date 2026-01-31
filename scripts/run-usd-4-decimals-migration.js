#!/usr/bin/env node

/**
 * CLI Script to run the USD 4 decimals migration
 * Run with: node scripts/run-usd-4-decimals-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load env files manually (check .env.local first, then .env)
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

const connectionString = process.env.DATABASE_URL_TRANSACTION || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Starting USD 4 decimals migration...\n');

  const results = [];

  // 1. market_products: cost_price, selling_price
  console.log('📦 Migrating market_products...');
  try {
    await pool.query(`
      ALTER TABLE market_products
      ALTER COLUMN cost_price TYPE DECIMAL(12,4),
      ALTER COLUMN selling_price TYPE DECIMAL(12,4)
    `);
    results.push({ table: 'market_products', success: true });
    console.log('   ✅ market_products: cost_price, selling_price -> DECIMAL(12,4)');
  } catch (e) {
    results.push({ table: 'market_products', success: false, error: e.message });
    console.log('   ❌ market_products:', e.message);
  }

  // 2. market_product_variants: cost_price, selling_price
  console.log('📦 Migrating market_product_variants...');
  try {
    await pool.query(`
      ALTER TABLE market_product_variants
      ALTER COLUMN cost_price TYPE DECIMAL(12,4),
      ALTER COLUMN selling_price TYPE DECIMAL(12,4)
    `);
    results.push({ table: 'market_product_variants', success: true });
    console.log('   ✅ market_product_variants: cost_price, selling_price -> DECIMAL(12,4)');
  } catch (e) {
    results.push({ table: 'market_product_variants', success: false, error: e.message });
    console.log('   ❌ market_product_variants:', e.message);
  }

  // 3. market_pos_order_lines: unit_price
  console.log('📦 Migrating market_pos_order_lines...');
  try {
    await pool.query(`
      ALTER TABLE market_pos_order_lines
      ALTER COLUMN unit_price TYPE DECIMAL(12,4)
    `);
    results.push({ table: 'market_pos_order_lines', success: true });
    console.log('   ✅ market_pos_order_lines: unit_price -> DECIMAL(12,4)');
  } catch (e) {
    results.push({ table: 'market_pos_order_lines', success: false, error: e.message });
    console.log('   ❌ market_pos_order_lines:', e.message);
  }

  // 4. market_invoice_lines: unit_price, cost_price
  console.log('📦 Migrating market_invoice_lines...');
  try {
    await pool.query(`
      ALTER TABLE market_invoice_lines
      ALTER COLUMN unit_price TYPE DECIMAL(12,4),
      ALTER COLUMN cost_price TYPE DECIMAL(12,4)
    `);
    results.push({ table: 'market_invoice_lines', success: true });
    console.log('   ✅ market_invoice_lines: unit_price, cost_price -> DECIMAL(12,4)');
  } catch (e) {
    results.push({ table: 'market_invoice_lines', success: false, error: e.message });
    console.log('   ❌ market_invoice_lines:', e.message);
  }

  // 5. Create index for price searches
  console.log('📦 Creating index idx_products_selling_price...');
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_products_selling_price
      ON market_products(selling_price)
    `);
    results.push({ table: 'idx_products_selling_price', success: true });
    console.log('   ✅ Index idx_products_selling_price created');
  } catch (e) {
    results.push({ table: 'idx_products_selling_price', success: false, error: e.message });
    console.log('   ❌ Index:', e.message);
  }

  // Summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Migration Summary: ${successCount} success, ${failCount} failed`);
  console.log('='.repeat(50));

  // Verify column precision
  console.log('\n🔍 Verifying column precision...\n');
  const verifyResult = await pool.query(`
    SELECT
      table_name,
      column_name,
      data_type,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_name IN ('market_products', 'market_product_variants', 'market_pos_order_lines', 'market_invoice_lines')
      AND column_name IN ('cost_price', 'selling_price', 'unit_price')
    ORDER BY table_name, column_name
  `);

  console.log('Table                        | Column         | Type    | Precision | Scale');
  console.log('-'.repeat(80));
  for (const row of verifyResult.rows) {
    const table = row.table_name.padEnd(28);
    const column = row.column_name.padEnd(14);
    const type = row.data_type.padEnd(7);
    const precision = String(row.numeric_precision || '-').padEnd(9);
    const scale = String(row.numeric_scale || '-');
    console.log(`${table} | ${column} | ${type} | ${precision} | ${scale}`);
  }

  await pool.end();

  console.log('\n✨ Migration complete!\n');
  console.log('Note: numeric_scale = 4 means 4 decimal places (correct)');

  return failCount === 0;
}

runMigration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
