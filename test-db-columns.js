const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Power*27801610@db.mmmcqpptupterlpthlhc.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  try {
    // Get column names from package_orders table
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'package_orders'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in package_orders table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });
    
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    pool.end();
  }
}

checkColumns();
