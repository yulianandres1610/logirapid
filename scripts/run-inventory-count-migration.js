const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Buscar archivo de entorno
let envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env');
}

if (!fs.existsSync(envPath)) {
  console.error('❌ No se encontró archivo .env o .env.local');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let connectionString = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    connectionString = line.substring('DATABASE_URL='.length).trim();
    if (connectionString.startsWith('"') && connectionString.endsWith('"')) {
      connectionString = connectionString.slice(1, -1);
    }
    if (connectionString.startsWith("'") && connectionString.endsWith("'")) {
      connectionString = connectionString.slice(1, -1);
    }
    break;
  }
}

if (!connectionString) {
  console.error('❌ DATABASE_URL no encontrada');
  process.exit(1);
}

console.log('📦 Conectando a la base de datos...');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando migración de tablas de conteo de inventario...\n');

    // Crear tabla principal de conteos
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_inventory_counts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        session_id INTEGER,
        warehouse_id INTEGER,
        count_number VARCHAR(50),
        status VARCHAR(20) DEFAULT 'in_progress',
        counted_by INTEGER,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        adjustment_operation_id INTEGER,
        total_products INTEGER DEFAULT 0,
        products_with_differences INTEGER DEFAULT 0,
        total_difference_value DECIMAL(12,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla market_inventory_counts creada');

    // Crear índices
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_inventory_counts_company ON market_inventory_counts(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_counts_session ON market_inventory_counts(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_counts_warehouse ON market_inventory_counts(warehouse_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_counts_status ON market_inventory_counts(status)'
    ];
    
    for (const idx of indexes) {
      await client.query(idx).catch(() => {});
    }
    console.log('✅ Índices de market_inventory_counts creados');

    // Crear tabla de líneas de conteo
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_inventory_count_lines (
        id SERIAL PRIMARY KEY,
        count_id INTEGER REFERENCES market_inventory_counts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        product_name VARCHAR(255),
        product_sku VARCHAR(100),
        product_barcode VARCHAR(100),
        product_image TEXT,
        unit_price DECIMAL(12,2) DEFAULT 0,
        expected_quantity DECIMAL(12,2) DEFAULT 0,
        counted_quantity DECIMAL(12,2) DEFAULT 0,
        difference DECIMAL(12,2) DEFAULT 0,
        difference_value DECIMAL(12,2) DEFAULT 0,
        sold_today DECIMAL(12,2) DEFAULT 0,
        scanned_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `);
    console.log('✅ Tabla market_inventory_count_lines creada');

    // Crear índices para líneas
    await client.query('CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_count ON market_inventory_count_lines(count_id)').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_product ON market_inventory_count_lines(product_id)').catch(() => {});
    console.log('✅ Índices de market_inventory_count_lines creados');

    console.log('\n🎉 Migración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
