import { Pool } from 'pg';

// Configuración de conexión a PostgreSQL (Supabase)
const connectionString = process.env.DATABASE_URL;

// Lazy initialization to avoid build-time errors
let pool: Pool | null = null;

function getPool(): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined. Please check your .env.local file.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20, // Increased from 10 to handle more concurrent requests
      min: 2, // Keep at least 2 connections alive
      idleTimeoutMillis: 30000, // Increased from 10s to 30s
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      statement_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Allow graceful reconnection
      allowExitOnIdle: false,
    });

    // Event handler para errores del pool
    pool.on('error', (err: any, client) => {
      console.error('❌ [Pool Error] Unexpected error on idle client:', {
        message: err.message,
        code: err.code || 'N/A',
        stack: err.stack
      });

      // Only recreate pool on critical errors
      if (
        err.message?.includes('termination') ||
        err.message?.includes('timeout') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ENOTFOUND') ||
        err.code === 'XX000' // Internal error
      ) {
        console.log('🔄 [Pool] Recreating pool due to critical connection error...');
        pool = null; // Force pool recreation on next query
      } else {
        console.log('⚠️ [Pool] Non-critical error, keeping pool alive');
      }
    });

    // Connection event handlers for debugging
    pool.on('connect', (client) => {
      console.log('✅ [Pool] New client connected to database');
    });

    pool.on('acquire', (client) => {
      console.log('🔓 [Pool] Client acquired from pool');
    });

    pool.on('remove', (client) => {
      console.log('🗑️ [Pool] Client removed from pool');
    });
  }

  return pool;
}

// Wrapper para PostgreSQL con métodos convenientes
class DatabaseWrapper {
  async query(text: string, params?: any[], retries = 2) {
    try {
      const result = await getPool().query(text, params);
      return result;
    } catch (error: any) {
      console.error('❌ [DB Query Error]:', {
        message: error.message,
        code: error.code || 'N/A',
        query: text.substring(0, 100),
        retries
      });

      // Check if error is recoverable
      const isRecoverableError =
        error.message?.includes('termination') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('Connection terminated') ||
        error.code === 'XX000' || // Internal error
        error.code === '57P01' || // Admin shutdown
        error.code === '57P03' || // Cannot connect now
        error.code === '08006' || // Connection failure
        error.code === '08003' || // Connection does not exist
        error.code === '08000'; // Connection exception

      if (retries > 0 && isRecoverableError) {
        console.log(`🔄 [DB] Recoverable error detected, retrying (${retries} attempts left)...`);
        pool = null; // Reset pool to force reconnection
        const delay = (3 - retries) * 1000; // Progressive delay: 1s, 2s
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.query(text, params, retries - 1);
      }

      throw error;
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const txId = Date.now().toString(36)
    console.log(`🔄 [DB Transaction ${txId}] Starting...`)

    const client = await getPool().connect();
    console.log(`🔄 [DB Transaction ${txId}] Client acquired from pool`)

    try {
      console.log(`🔄 [DB Transaction ${txId}] Executing BEGIN`)
      await client.query('BEGIN');

      console.log(`🔄 [DB Transaction ${txId}] Executing callback`)
      const result = await callback(client);

      console.log(`🔄 [DB Transaction ${txId}] Callback completed, executing COMMIT`)
      await client.query('COMMIT');
      console.log(`✅ [DB Transaction ${txId}] COMMIT successful`)

      return result;
    } catch (error: any) {
      console.error(`❌ [DB Transaction ${txId}] Error in transaction:`, error.message);
      try {
        console.log(`🔄 [DB Transaction ${txId}] Executing ROLLBACK`)
        await client.query('ROLLBACK');
        console.log(`⚠️ [DB Transaction ${txId}] ROLLBACK completed`)
      } catch (rollbackError: any) {
        console.error(`❌ [DB Transaction ${txId}] Error during ROLLBACK:`, rollbackError.message);
      }
      console.error(`❌ [DB Transaction ${txId}] Error details:`, {
        message: error.message,
        code: error.code || 'N/A',
        stack: error.stack?.substring(0, 500)
      });
      throw error;
    } finally {
      try {
        client.release();
        console.log(`🔄 [DB Transaction ${txId}] Client released`)
      } catch (releaseError: any) {
        console.error(`❌ [DB Transaction ${txId}] Error releasing client:`, releaseError.message);
      }
    }
  }
}

// Crear instancia singleton del wrapper
export const db = new DatabaseWrapper();

// Función para cerrar el pool (útil para tests y shutdown)
export async function closePool() {
  if (pool) {
    await getPool().end();
    console.log('📦 Database pool closed');
  }
}

// Función para verificar la conexión
export async function checkConnection() {
  try {
    const startTime = Date.now();
    const result = await getPool().query('SELECT NOW() as now, version() as version');
    const duration = Date.now() - startTime;

    console.log('✅ [DB Connection] Successful:', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
      latency: `${duration}ms`
    });
    return true;
  } catch (error: any) {
    console.error('❌ [DB Connection] Failed:', {
      message: error.message,
      code: error.code || 'N/A',
      stack: error.stack
    });
    return false;
  }
}

// Function helper para obtener el pool directo si es necesario
export function getPoolDirect() {
  return getPool();
}

// Funciones para agency rates
export async function getAgencyConfig(companyId?: string) {
  try {
    const query = companyId
      ? 'SELECT * FROM agency_rates_config WHERE companyid = $1 ORDER BY updatedat DESC LIMIT 1'
      : 'SELECT * FROM agency_rates_config WHERE companyid IS NULL ORDER BY updatedat DESC LIMIT 1'

    const params = companyId ? [companyId] : []
    const result = await db.query(query, params)

    // Map lowercase column names to camelCase for consistency
    if (result.rows[0]) {
      return {
        id: result.rows[0].id,
        adjustmentPercentage: parseFloat(result.rows[0].adjustmentpercentage),
        isActive: result.rows[0].isactive,
        companyId: result.rows[0].companyid,
        createdAt: result.rows[0].createdat,
        updatedAt: result.rows[0].updatedat,
        createdBy: result.rows[0].createdby
      }
    }
    return null
  } catch (error) {
    console.error('Error getting agency config:', error)
    return null
  }
}

export async function saveAgencyConfig(config: any) {
  try {
    const query = `
      INSERT INTO agency_rates_config (id, adjustmentpercentage, isactive, companyid, createdby)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `
    const values = [
      config.id,
      config.adjustmentPercentage,
      config.isActive !== undefined ? config.isActive : true,
      config.companyId || null,
      config.createdBy
    ]
    const result = await db.query(query, values)
    console.log('[DB] Agency config saved:', result.rows[0])

    // Map lowercase column names to camelCase
    if (result.rows[0]) {
      return {
        id: result.rows[0].id,
        adjustmentPercentage: parseFloat(result.rows[0].adjustmentpercentage),
        isActive: result.rows[0].isactive,
        companyId: result.rows[0].companyid,
        createdAt: result.rows[0].createdat,
        updatedAt: result.rows[0].updatedat,
        createdBy: result.rows[0].createdby
      }
    }
    return null
  } catch (error) {
    console.error('Error saving agency config:', error)
    return null
  }
}

export async function updateAgencyConfig(id: string, config: any) {
  try {
    const query = `
      UPDATE agency_rates_config
      SET adjustmentpercentage = $2, isactive = $3, updatedat = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `
    const values = [id, config.adjustmentPercentage, config.isActive]
    const result = await db.query(query, values)
    console.log('[DB] Agency config updated:', result.rows[0])

    // Map lowercase column names to camelCase
    if (result.rows[0]) {
      return {
        id: result.rows[0].id,
        adjustmentPercentage: parseFloat(result.rows[0].adjustmentpercentage),
        isActive: result.rows[0].isactive,
        companyId: result.rows[0].companyid,
        createdAt: result.rows[0].createdat,
        updatedAt: result.rows[0].updatedat,
        createdBy: result.rows[0].createdby
      }
    }
    return null
  } catch (error) {
    console.error('Error updating agency config:', error)
    return null
  }
}

export async function saveAgencyRatesHistory(history: any[]) {
  try {
    if (!history || history.length === 0) return []

    // Construir query con múltiples inserts
    const placeholders = history.map((_, i) =>
      `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
    ).join(', ')

    const query = `
      INSERT INTO agency_rates_history
      (id, configid, currency, baserate, agencyrate, adjustmentpercentage)
      VALUES ${placeholders}
      RETURNING *
    `

    const values = history.flatMap(h => [
      h.id,
      h.configId,
      h.currency,
      h.baseRate,
      h.agencyRate,
      h.adjustmentPercentage
    ])

    const result = await db.query(query, values)
    console.log(`[DB] Saved ${result.rows.length} agency rates history records`)
    return result.rows
  } catch (error) {
    console.error('Error saving agency rates history:', error)
    return []
  }
}

export async function getAgencyRatesHistory(configId: string, days: number = 30) {
  try {
    const query = `
      SELECT * FROM agency_rates_history
      WHERE configid = $1
      AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      ORDER BY timestamp DESC
    `
    const result = await db.query(query, [configId])
    return result.rows
  } catch (error) {
    console.error('Error getting agency rates history:', error)
    return []
  }
}

export async function saveCompanyAgencyConfig(config: any) {
  try {
    const query = `
      INSERT INTO company_agency_configs (id, "companyId", "agencyConfigId", "isActive")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT ("companyId") DO UPDATE SET
        "agencyConfigId" = $3,
        "isActive" = $4,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `
    const values = [config.id, config.companyId, config.agencyConfigId, config.isActive]
    const result = await db.query(query, values)
    return result.rows[0]
  } catch (error) {
    console.error('Error saving company agency config:', error)
    return null
  }
}

export async function getCompanyAgencyConfig(companyId: string) {
  try {
    const query = `
      SELECT cac.*, arc.*
      FROM company_agency_configs cac
      LEFT JOIN agency_rates_config arc ON cac."agencyConfigId" = arc.id
      WHERE cac."companyId" = $1
    `
    const result = await db.query(query, [companyId])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting company agency config:', error)
    return null
  }
}

// Nueva función para obtener tasas publicadas (solo resultado final para agencias)
// OPTIMIZACIÓN: Usar DISTINCT ON en lugar de subconsulta correlacionada
export async function getPublishedRates() {
  try {
    const query = `
      SELECT DISTINCT ON (currency) currency, agencyrate as rate, timestamp
      FROM agency_rates_history
      ORDER BY currency, timestamp DESC
    `
    const result = await db.query(query)
    return result.rows
  } catch (error) {
    console.error('Error getting published rates:', error)
    return []
  }
}

// Función para obtener servicios habilitados de una empresa
export async function getCompanyServices(companyId: number): Promise<string[]> {
  try {
    const result = await db.query(
      'SELECT enabledservices FROM companies WHERE id = $1',
      [companyId]
    )

    if (result.rows[0]?.enabledservices) {
      return result.rows[0].enabledservices
    }

    return []
  } catch (error) {
    console.error('[DB] Error getting company services:', error)
    return []
  }
}

// Inicialización de la base de datos
console.log('PostgreSQL database initialized - tables managed via migrations');
