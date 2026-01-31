#!/usr/bin/env node

/**
 * Script to fix all product prices to have 4 decimal USD that results in exact CUP prices
 *
 * Logic:
 * 1. Get current ElToque exchange rate
 * 2. For each product:
 *    - Calculate current CUP price: priceUSD * rate
 *    - Round CUP to nearest multiple of 10: Math.round(cup / 10) * 10
 *    - Calculate new USD price: cupRounded / rate (4 decimals)
 *    - Update product with new price
 *
 * Run with: node scripts/fix-product-prices-cup-exact.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load env files manually
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

// Default exchange rate (will try to fetch from ElToque)
let EXCHANGE_RATE = 400;

/**
 * Fetch current ElToque exchange rate
 */
async function fetchExchangeRate() {
  try {
    const https = require('https');

    return new Promise((resolve, reject) => {
      const req = https.get('https://api.eltoque.com/public/exchange-rates/latest', {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data.USD) {
              resolve(json.data.USD);
            } else if (json.rates && json.rates.USD) {
              resolve(json.rates.USD);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch (e) {
    return null;
  }
}

/**
 * Calculate new USD price from desired CUP price
 * @param {number} currentUSD - Current USD price
 * @param {number} rate - Exchange rate
 * @returns {{ newUSD: number, oldCUP: number, newCUP: number }}
 */
function calculateExactPrice(currentUSD, rate) {
  // Calculate current CUP
  const oldCUP = currentUSD * rate;

  // Round CUP to nearest multiple of 10
  const newCUP = Math.round(oldCUP / 10) * 10;

  // Calculate new USD with 4 decimals
  const newUSD = Math.round((newCUP / rate) * 10000) / 10000;

  return { newUSD, oldCUP, newCUP };
}

async function fixProductPrices() {
  console.log('🚀 Starting product price correction...\n');

  // Try to fetch current exchange rate
  console.log('📡 Fetching ElToque exchange rate...');
  const elToqueRate = await fetchExchangeRate();

  if (elToqueRate) {
    EXCHANGE_RATE = elToqueRate;
    console.log(`   ✅ ElToque rate: ${EXCHANGE_RATE} CUP/USD\n`);
  } else {
    console.log(`   ⚠️  Could not fetch ElToque rate, using default: ${EXCHANGE_RATE} CUP/USD\n`);
  }

  // Ask for confirmation or allow custom rate
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const rate = await new Promise(resolve => {
    rl.question(`Enter exchange rate to use (or press Enter for ${EXCHANGE_RATE}): `, answer => {
      rl.close();
      const customRate = parseFloat(answer);
      resolve(isNaN(customRate) || customRate <= 0 ? EXCHANGE_RATE : customRate);
    });
  });

  EXCHANGE_RATE = rate;
  console.log(`\n📊 Using exchange rate: ${EXCHANGE_RATE} CUP/USD\n`);

  // ============================================
  // 1. Fix market_products
  // ============================================
  console.log('=' .repeat(60));
  console.log('📦 Processing market_products...');
  console.log('=' .repeat(60));

  const productsResult = await pool.query(`
    SELECT id, name, cost_price, selling_price
    FROM market_products
    WHERE selling_price > 0 OR cost_price > 0
    ORDER BY id
  `);

  let productsUpdated = 0;
  let productsSkipped = 0;

  for (const product of productsResult.rows) {
    const updates = [];
    const changes = [];

    // Fix selling_price
    if (product.selling_price > 0) {
      const { newUSD, oldCUP, newCUP } = calculateExactPrice(parseFloat(product.selling_price), EXCHANGE_RATE);

      if (newUSD !== parseFloat(product.selling_price)) {
        updates.push(`selling_price = ${newUSD}`);
        changes.push(`  selling: $${product.selling_price} -> $${newUSD.toFixed(4)} (${Math.round(oldCUP)} -> ${newCUP} CUP)`);
      }
    }

    // Fix cost_price
    if (product.cost_price > 0) {
      const { newUSD, oldCUP, newCUP } = calculateExactPrice(parseFloat(product.cost_price), EXCHANGE_RATE);

      if (newUSD !== parseFloat(product.cost_price)) {
        updates.push(`cost_price = ${newUSD}`);
        changes.push(`  cost:    $${product.cost_price} -> $${newUSD.toFixed(4)} (${Math.round(oldCUP)} -> ${newCUP} CUP)`);
      }
    }

    if (updates.length > 0) {
      await pool.query(`
        UPDATE market_products
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1
      `, [product.id]);

      console.log(`\n✅ [${product.id}] ${product.name}`);
      changes.forEach(c => console.log(c));
      productsUpdated++;
    } else {
      productsSkipped++;
    }
  }

  console.log(`\n📊 market_products: ${productsUpdated} updated, ${productsSkipped} skipped\n`);

  // ============================================
  // 2. Fix market_product_variants
  // ============================================
  console.log('=' .repeat(60));
  console.log('📦 Processing market_product_variants...');
  console.log('=' .repeat(60));

  const variantsResult = await pool.query(`
    SELECT v.id, v.product_id, v.sku, v.cost_price, v.selling_price, p.name as product_name
    FROM market_product_variants v
    JOIN market_products p ON v.product_id = p.id
    WHERE v.selling_price > 0 OR v.cost_price > 0
    ORDER BY v.id
  `);

  let variantsUpdated = 0;
  let variantsSkipped = 0;

  for (const variant of variantsResult.rows) {
    const updates = [];
    const changes = [];

    // Fix selling_price
    if (variant.selling_price > 0) {
      const { newUSD, oldCUP, newCUP } = calculateExactPrice(parseFloat(variant.selling_price), EXCHANGE_RATE);

      if (newUSD !== parseFloat(variant.selling_price)) {
        updates.push(`selling_price = ${newUSD}`);
        changes.push(`  selling: $${variant.selling_price} -> $${newUSD.toFixed(4)} (${Math.round(oldCUP)} -> ${newCUP} CUP)`);
      }
    }

    // Fix cost_price
    if (variant.cost_price > 0) {
      const { newUSD, oldCUP, newCUP } = calculateExactPrice(parseFloat(variant.cost_price), EXCHANGE_RATE);

      if (newUSD !== parseFloat(variant.cost_price)) {
        updates.push(`cost_price = ${newUSD}`);
        changes.push(`  cost:    $${variant.cost_price} -> $${newUSD.toFixed(4)} (${Math.round(oldCUP)} -> ${newCUP} CUP)`);
      }
    }

    if (updates.length > 0) {
      await pool.query(`
        UPDATE market_product_variants
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1
      `, [variant.id]);

      console.log(`\n✅ [${variant.id}] ${variant.product_name} - ${variant.sku}`);
      changes.forEach(c => console.log(c));
      variantsUpdated++;
    } else {
      variantsSkipped++;
    }
  }

  console.log(`\n📊 market_product_variants: ${variantsUpdated} updated, ${variantsSkipped} skipped\n`);

  // ============================================
  // Summary
  // ============================================
  console.log('=' .repeat(60));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Exchange rate used: ${EXCHANGE_RATE} CUP/USD`);
  console.log(`Products updated: ${productsUpdated}`);
  console.log(`Variants updated: ${variantsUpdated}`);
  console.log(`Total: ${productsUpdated + variantsUpdated} prices corrected`);
  console.log('=' .repeat(60));

  // Verify with examples
  console.log('\n🔍 Verification (sample products):\n');

  const sampleResult = await pool.query(`
    SELECT id, name, selling_price
    FROM market_products
    WHERE selling_price > 0
    ORDER BY id
    LIMIT 5
  `);

  console.log('ID  | Product Name                    | USD Price  | CUP Price');
  console.log('-'.repeat(70));

  for (const row of sampleResult.rows) {
    const usd = parseFloat(row.selling_price);
    const cup = Math.round(usd * EXCHANGE_RATE);
    const isMultiple10 = cup % 10 === 0;
    const mark = isMultiple10 ? '✅' : '❌';

    console.log(`${String(row.id).padEnd(4)}| ${row.name.substring(0, 30).padEnd(32)}| $${usd.toFixed(4).padEnd(9)}| ${cup} CUP ${mark}`);
  }

  await pool.end();

  console.log('\n✨ Price correction complete!\n');
}

fixProductPrices()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
