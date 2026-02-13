import { Pool } from 'pg';

// Configuración de conexión a PostgreSQL (Supabase)
// IMPORTANTE: Usar DATABASE_URL_TRANSACTION (puerto 6543) para Transaction mode
// Transaction mode permite más conexiones concurrentes que Session mode
let connectionString = process.env.DATABASE_URL_TRANSACTION || process.env.DATABASE_URL;

// Remover sslmode de la URL si existe - lo manejamos en la configuración del pool
if (connectionString) {
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
}

// Lazy initialization to avoid build-time errors
let pool: Pool | null = null;

// ============================================================================
// STANDBY REPLICATION - Real-time async write replication via HTTP proxy
// ============================================================================
const replicationProxyUrl = process.env.REPLICATION_PROXY_URL?.trim();
const replicationApiKey = process.env.REPLICATION_API_KEY?.trim();
let replicationErrors = 0;
let replicationSuccesses = 0;
const MAX_REPLICATION_ERRORS = 50;

// Buffer for batching writes (send every 2 seconds or when buffer is full)
let replicationBuffer: Array<{ text: string; params?: any[] }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 2000; // 2 seconds
const MAX_BUFFER_SIZE = 20; // flush immediately at 20 queries

if (replicationProxyUrl) {
  console.log(`[REPLICATION] HTTP proxy configured: ${replicationProxyUrl}`);
} else {
  console.log('[REPLICATION] No proxy URL, replication disabled');
}

const WRITE_PATTERNS = /^\s*(INSERT|UPDATE|DELETE|UPSERT|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE)/i;

async function flushReplicationBuffer(): Promise<void> {
  if (replicationBuffer.length === 0) return;
  if (!replicationProxyUrl || !replicationApiKey) return;
  if (replicationErrors >= MAX_REPLICATION_ERRORS) return;

  const queries = [...replicationBuffer];
  replicationBuffer = [];

  try {
    const res = await fetch(`${replicationProxyUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': replicationApiKey,
      },
      body: JSON.stringify({ queries }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json();
      replicationSuccesses += data.succeeded || 0;
      if (data.failed > 0) replicationErrors++;
      if (replicationErrors > 0 && data.succeeded > 0) replicationErrors = Math.max(0, replicationErrors - 1);
      if (replicationSuccesses === queries.length || replicationSuccesses % 100 < queries.length) {
        console.log(`[REPLICATION] OK batch: ${data.succeeded}/${queries.length} (total: ${replicationSuccesses})`);
      }
    } else {
      replicationErrors++;
      const errText = await res.text().catch(() => 'unknown');
      if (replicationErrors <= 5 || replicationErrors % 10 === 1) {
        console.error(`[REPLICATION] HTTP ${res.status} (${replicationErrors}): ${errText.substring(0, 150)}`);
      }
    }
  } catch (err: any) {
    replicationErrors++;
    if (replicationErrors <= 5 || replicationErrors % 10 === 1) {
      console.error(`[REPLICATION] Error (${replicationErrors}): ${err.message?.substring(0, 150)}`);
    }
  }
}

function replicateToStandby(text: string, params?: any[]): void {
  if (!WRITE_PATTERNS.test(text)) return;
  if (!replicationProxyUrl || !replicationApiKey) return;
  if (replicationErrors >= MAX_REPLICATION_ERRORS) return;

  replicationBuffer.push({ text, params });

  // Flush immediately if buffer is full
  if (replicationBuffer.length >= MAX_BUFFER_SIZE) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    flushReplicationBuffer();
    return;
  }

  // Otherwise schedule a flush
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushReplicationBuffer();
    }, FLUSH_INTERVAL);
  }
}

function replicateTransactionToStandby(queries: Array<{ text: string; params?: any[] }>): void {
  if (!replicationProxyUrl || !replicationApiKey) return;
  if (replicationErrors >= MAX_REPLICATION_ERRORS) return;
  if (queries.length === 0) return;

  // Transactions are sent immediately (not buffered) to maintain atomicity
  fetch(`${replicationProxyUrl}/replicate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': replicationApiKey,
    },
    body: JSON.stringify({ queries }),
    signal: AbortSignal.timeout(15000),
  }).then(async (res) => {
    if (res.ok) {
      replicationSuccesses += queries.length;
      if (replicationErrors > 0) replicationErrors = Math.max(0, replicationErrors - 1);
      console.log(`[REPLICATION] TX OK: ${queries.length} queries`);
    } else {
      replicationErrors++;
      const errText = await res.text().catch(() => 'unknown');
      console.error(`[REPLICATION TX] HTTP ${res.status}: ${errText.substring(0, 100)}`);
    }
  }).catch((err: any) => {
    replicationErrors++;
    if (replicationErrors <= 5 || replicationErrors % 10 === 1) {
      console.error(`[REPLICATION TX] Error (${replicationErrors}): ${err.message?.substring(0, 100)}`);
    }
  });
}

// Simple in-memory cache for frequently accessed data
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

function getCachedResult(key: string): any | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  queryCache.delete(key);
  return null;
}

function setCachedResult(key: string, data: any): void {
  // Limit cache size to prevent memory issues
  if (queryCache.size > 1000) {
    // Clear oldest entries
    const entries = Array.from(queryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 500; i++) {
      queryCache.delete(entries[i][0]);
    }
  }
  queryCache.set(key, { data, timestamp: Date.now() });
}

function getPool(): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined. Please check your .env.local file.');
  }

  if (!pool) {
    // Para serverless (Vercel), usar pool mínimo
    // RECOMENDACIÓN: Usar DATABASE_URL_TRANSACTION (puerto 6543) para Transaction mode
    // Transaction mode libera conexiones inmediatamente después de cada query
    const isTransactionMode = connectionString.includes(':6543');

    console.log(`[DB] Initializing pool - Mode: ${isTransactionMode ? 'TRANSACTION' : 'SESSION'}`);

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      // Transaction mode permite más conexiones, Session mode necesita menos
      max: isTransactionMode ? 5 : 1,
      min: 0,
      idleTimeoutMillis: isTransactionMode ? 10000 : 1000, // Liberar muy rápido en Session mode
      connectionTimeoutMillis: 20000, // Más tiempo para esperar
      query_timeout: 30000,
      statement_timeout: 30000,
      keepAlive: false,
      allowExitOnIdle: true,
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
  // Get a dedicated client from the pool for transactions
  async getClient() {
    return await getPool().connect()
  }

  /**
   * Query with caching - use for frequently accessed, rarely changing data
   * @param cacheKey - Unique key for this query result
   * @param text - SQL query
   * @param params - Query parameters
   * @param ttl - Cache TTL in ms (default 30s)
   */
  async queryCached(cacheKey: string, text: string, params?: any[], ttl: number = CACHE_TTL) {
    // Check cache first
    const cached = getCachedResult(cacheKey);
    if (cached) {
      console.log(`[DB] Cache HIT for: ${cacheKey}`);
      return cached;
    }

    // Execute query
    const result = await this.query(text, params);

    // Cache result
    setCachedResult(cacheKey, result);
    console.log(`[DB] Cache MISS, stored: ${cacheKey}`);

    return result;
  }

  async query(text: string, params?: any[], retries = 3) {
    try {
      const result = await getPool().query(text, params);
      // Async replication to standby (fire-and-forget)
      replicateToStandby(text, params);
      return result;
    } catch (error: any) {
      // Check if it's a max clients error - these need special handling
      const isMaxClientsError =
        error.message?.includes('MaxClientsInSessionMode') ||
        error.message?.includes('max clients') ||
        error.code === 'XX000';

      // Only log as error if not a simple retry situation
      if (!isMaxClientsError || retries <= 1) {
        console.error('❌ [DB Query Error]:', {
          message: error.message,
          code: error.code || 'N/A',
          query: text.substring(0, 100),
          retries
        });
      } else {
        console.log('⏳ [DB] Max clients reached, waiting for connection...');
      }

      // Check if error is recoverable
      const isRecoverableError =
        error.message?.includes('termination') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('Connection terminated') ||
        isMaxClientsError ||
        error.code === '57P01' || // Admin shutdown
        error.code === '57P03' || // Cannot connect now
        error.code === '08006' || // Connection failure
        error.code === '08003' || // Connection does not exist
        error.code === '08000'; // Connection exception

      if (retries > 0 && isRecoverableError) {
        // For max clients error, wait longer and don't reset pool
        if (isMaxClientsError) {
          const delay = (4 - retries) * 2000; // Progressive delay: 2s, 4s, 6s
          console.log(`🔄 [DB] Waiting ${delay}ms before retry (${retries} attempts left)...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.query(text, params, retries - 1);
        } else {
          console.log(`🔄 [DB] Recoverable error detected, retrying (${retries} attempts left)...`);
          pool = null; // Reset pool to force reconnection
          const delay = (4 - retries) * 1000; // Progressive delay: 1s, 2s, 3s
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.query(text, params, retries - 1);
        }
      }

      throw error;
    }
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    // Capture queries for standby replication
    const capturedQueries: Array<{ text: string; params?: any[] }> = [];
    const originalQuery = client.query.bind(client);
    (client as any).query = function(text: any, ...args: any[]) {
      if (typeof text === 'string' && WRITE_PATTERNS.test(text)) {
        capturedQueries.push({ text, params: Array.isArray(args[0]) ? args[0] : undefined });
      }
      return originalQuery(text, ...args);
    };

    try {
      await originalQuery('BEGIN');
      const result = await callback(client);
      await originalQuery('COMMIT');

      // Replicate transaction to standby via HTTP proxy (async, fire-and-forget)
      if (capturedQueries.length > 0) {
        replicateTransactionToStandby(capturedQueries);
      }

      return result;
    } catch (error: any) {
      try {
        await originalQuery('ROLLBACK');
      } catch (rollbackError: any) {
        console.error('❌ [DB] Error during ROLLBACK:', rollbackError.message);
      }
      console.error('❌ [DB Transaction Error]:', {
        message: error.message,
        code: error.code || 'N/A'
      });
      throw error;
    } finally {
      try {
        client.release();
      } catch (releaseError: any) {
        console.error('❌ [DB] Error releasing client:', releaseError.message);
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

    // Construir query con múltiples inserts - incluye timestamp
    const placeholders = history.map((_, i) =>
      `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
    ).join(', ')

    const query = `
      INSERT INTO agency_rates_history
      (id, configid, currency, baserate, agencyrate, adjustmentpercentage, timestamp)
      VALUES ${placeholders}
      RETURNING *
    `

    const now = new Date().toISOString()
    const values = history.flatMap(h => [
      h.id,
      h.configId,
      h.currency,
      h.baseRate,
      h.agencyRate,
      h.adjustmentPercentage,
      h.timestamp || now
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

// ============================================================================
// HEALTH CHECK FUNCTIONS (for HA monitoring)
// ============================================================================

export async function runHealthChecks(): Promise<{
  primary: { healthy: boolean; latencyMs?: number; error?: string };
  standby: { healthy: boolean; latencyMs?: number; error?: string } | null;
  recoveryAttempted: boolean;
}> {
  const primaryResult: { healthy: boolean; latencyMs?: number; error?: string } = { healthy: false };
  let standbyResult: { healthy: boolean; latencyMs?: number; error?: string } | null = null;

  // Check primary
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    primaryResult.healthy = true;
    primaryResult.latencyMs = Date.now() - start;
  } catch (err: any) {
    primaryResult.error = err.message;
  }

  // Check standby via HTTP proxy
  if (replicationProxyUrl) {
    standbyResult = { healthy: false };
    try {
      const start = Date.now();
      const res = await fetch(`${replicationProxyUrl}/health`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        standbyResult.healthy = data.ok === true;
        standbyResult.latencyMs = Date.now() - start;
      } else {
        standbyResult.error = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      standbyResult.error = err.message;
    }
  }

  return { primary: primaryResult, standby: standbyResult, recoveryAttempted: false };
}

export function getCurrentDatabaseInfo(): {
  primaryConfigured: boolean;
  standbyConfigured: boolean;
  mode: string;
} {
  return {
    primaryConfigured: !!connectionString,
    standbyConfigured: !!replicationProxyUrl,
    mode: 'primary',
  };
}

// Inicialización de la base de datos
console.log('PostgreSQL database initialized - tables managed via migrations');
