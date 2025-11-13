import { Pool } from 'pg';

// Configuración de conexión a PostgreSQL (Supabase)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined. Please check your .env.local file.');
}

let pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // Reducido para Supabase free tier
  min: 0, // Sin conexiones mínimas para evitar problemas con idle
  idleTimeoutMillis: 10000, // Reducido a 10 segundos
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  statement_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Event handler para errores del pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Si hay un error crítico de conexión, recrear el pool
  if (err.message.includes('termination') || err.message.includes('timeout')) {
    console.log('🔄 Recreating pool due to connection error...');
    recreatePool();
  }
});

// Función para recrear el pool
function recreatePool() {
  try {
    // Intentar cerrar el pool anterior
    pool.end().catch(() => {});

    // Crear nuevo pool
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      min: 0,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      statement_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Reattach event handler
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      if (err.message.includes('termination') || err.message.includes('timeout')) {
        console.log('🔄 Recreating pool due to connection error...');
        recreatePool();
      }
    });

    console.log('✅ Pool recreated successfully');
  } catch (error) {
    console.error('❌ Error recreating pool:', error);
  }
}

// Función para obtener el pool actual
function getActivePool() {
  return pool;
}

// Wrapper para PostgreSQL con métodos convenientes
class DatabaseWrapper {
  async query(text: string, params?: any[], retries = 1) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error: any) {
      console.error('Database query error:', error);

      // Si es un error de conexión y aún quedan reintentos, recrear pool y reintentar
      if (retries > 0 && (error.message?.includes('termination') || error.message?.includes('timeout'))) {
        console.log('🔄 Connection error detected, recreating pool and retrying...');
        recreatePool();
        // Esperar un momento antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.query(text, params, retries - 1);
      }

      throw error;
    }
  }

  // Método prepare para queries preparados
  prepare(query: string) {
    const self = this;
    return {
      run(...params: any[]) {
        // Convertir placeholders (?) a PostgreSQL ($1, $2, etc.)
        let pgQuery = query;
        let paramIndex = 1;
        while (pgQuery.includes('?')) {
          pgQuery = pgQuery.replace('?', `$${paramIndex}`);
          paramIndex++;
        }

        return self.query(pgQuery, params).then(result => ({
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows[0]?.id || null
        }));
      },

      get(...params: any[]) {
        let pgQuery = query;
        let paramIndex = 1;
        while (pgQuery.includes('?')) {
          pgQuery = pgQuery.replace('?', `$${paramIndex}`);
          paramIndex++;
        }

        return self.query(pgQuery, params).then(result => result.rows[0] || null);
      },

      all(...params: any[]) {
        let pgQuery = query;
        let paramIndex = 1;
        while (pgQuery.includes('?')) {
          pgQuery = pgQuery.replace('?', `$${paramIndex}`);
          paramIndex++;
        }

        return self.query(pgQuery, params).then(result => result.rows || []);
      }
    };
  }

  // Método exec para ejecutar múltiples sentencias SQL (usado en inicialización)
  async exec(sql: string) {
    try {
      // PostgreSQL no soporta múltiples sentencias en una sola query por defecto
      // Dividir por punto y coma y ejecutar cada sentencia
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.query(statement);
        }
      }
    } catch (error) {
      console.error('Database exec error:', error);
      throw error;
    }
  }

  // Método transaction para compatibilidad
  async transaction(fn: Function, retries = 1) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      // Si es un error de conexión y aún quedan reintentos, recrear pool y reintentar
      if (retries > 0 && (error.message?.includes('termination') || error.message?.includes('timeout'))) {
        console.log('🔄 Connection error in transaction, recreating pool and retrying...');
        recreatePool();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.transaction(fn, retries - 1);
      }
      throw error;
    }
  }

  // Cerrar conexiones
  async close() {
    await pool.end();
  }
}

// Crear instancia del wrapper
export const db = new DatabaseWrapper();

// Función de inicialización (Las tablas de PostgreSQL se gestionan mediante migraciones)
export function initializeDatabase() {
  console.log('PostgreSQL database initialized - tables managed via migrations');
}

// Función helper para obtener el pool directo si es necesario
export function getPool() {
  return pool;
}

// Función para verificar la conexión
export async function checkConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Verificar conexión al iniciar
checkConnection();

// ==================== Agency Rates Functions ====================

/**
 * Get agency configuration from database
 */
export function getAgencyConfig(companyId?: string) {
  try {
    const query = companyId
      ? 'SELECT * FROM agency_rates_config WHERE company_id = $1 LIMIT 1'
      : 'SELECT * FROM agency_rates_config WHERE company_id IS NULL LIMIT 1';

    const params = companyId ? [companyId] : [];
    const stmt = db.prepare(query);
    return stmt.get(...params);
  } catch (error) {
    console.error('Error getting agency config:', error);
    return null;
  }
}

/**
 * Save new agency configuration
 */
export function saveAgencyConfig(config: {
  id: string;
  adjustmentPercentage: number;
  isActive: boolean;
  createdBy: string;
  companyId?: string;
}) {
  try {
    const query = `
      INSERT INTO agency_rates_config
      (id, adjustment_percentage, is_active, created_by, company_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    const stmt = db.prepare(query);
    return stmt.run(
      config.id,
      config.adjustmentPercentage,
      config.isActive,
      config.createdBy,
      config.companyId || null
    );
  } catch (error) {
    console.error('Error saving agency config:', error);
    return null;
  }
}

/**
 * Update existing agency configuration
 */
export function updateAgencyConfig(
  id: string,
  updates: {
    adjustmentPercentage?: number;
    isActive?: boolean;
  }
) {
  try {
    const query = `
      UPDATE agency_rates_config
      SET adjustment_percentage = COALESCE($2, adjustment_percentage),
          is_active = COALESCE($3, is_active),
          updated_at = NOW()
      WHERE id = $1
    `;

    const stmt = db.prepare(query);
    return stmt.run(
      id,
      updates.adjustmentPercentage ?? null,
      updates.isActive ?? null
    );
  } catch (error) {
    console.error('Error updating agency config:', error);
    return null;
  }
}

/**
 * Save agency rates history records
 */
export function saveAgencyRatesHistory(records: Array<{
  id: string;
  configId: string;
  currency: string;
  baseRate: number;
  agencyRate: number;
  adjustmentPercentage: number;
}>) {
  try {
    const query = `
      INSERT INTO agency_rates_history
      (id, config_id, currency, base_rate, agency_rate, adjustment_percentage, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    const stmt = db.prepare(query);
    records.forEach(record => {
      stmt.run(
        record.id,
        record.configId,
        record.currency,
        record.baseRate,
        record.agencyRate,
        record.adjustmentPercentage
      );
    });

    return true;
  } catch (error) {
    console.error('Error saving agency rates history:', error);
    return false;
  }
}

/**
 * Get agency rates history
 */
export function getAgencyRatesHistory(configId: string, days: number = 30) {
  try {
    const query = `
      SELECT * FROM agency_rates_history
      WHERE config_id = $1
      AND timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp DESC
    `;

    const stmt = db.prepare(query);
    return stmt.all(configId);
  } catch (error) {
    console.error('Error getting agency rates history:', error);
    return [];
  }
}

/**
 * Save company-specific agency configuration
 */
export function saveCompanyAgencyConfig(config: {
  companyId: string;
  adjustmentPercentage: number;
  isActive: boolean;
  createdBy: string;
}) {
  const id = `company_${config.companyId}_${Date.now()}`;
  return saveAgencyConfig({
    id,
    adjustmentPercentage: config.adjustmentPercentage,
    isActive: config.isActive,
    createdBy: config.createdBy,
    companyId: config.companyId
  });
}

/**
 * Get company-specific agency configuration
 */
export function getCompanyAgencyConfig(companyId: string) {
  return getAgencyConfig(companyId);
}