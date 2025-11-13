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
    const client = await getPool().connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error: any) {
      try {
        await client.query('ROLLBACK');
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
export function getAgencyConfig(companyId?: string) {
  try {
    // Implementación simplificada - retorna null durante build
    if (!connectionString) return null;

    const query = companyId
      ? 'SELECT * FROM agency_rates_config WHERE company_id = $1 LIMIT 1'
      : 'SELECT * FROM agency_rates_config WHERE company_id IS NULL LIMIT 1';
    const params = companyId ? [companyId] : [];

    // Usar query síncrona solo si está disponible
    return null; // Placeholder - implementar según necesidades
  } catch (error) {
    console.error('Error getting agency config:', error);
    return null;
  }
}

export function saveAgencyConfig(config: any) {
  // Implementación placeholder
  return null;
}

export function updateAgencyConfig(id: any, config: any) {
  // Implementación placeholder
  return null;
}

export function saveAgencyRatesHistory(history: any) {
  // Implementación placeholder
  return null;
}

export function getAgencyRatesHistory(...args: any[]) {
  // Implementación placeholder
  return [];
}

export function saveCompanyAgencyConfig(config: any) {
  // Implementación placeholder
  return null;
}

export function getCompanyAgencyConfig(companyId: string) {
  // Implementación placeholder
  return null;
}

// Inicialización de la base de datos
console.log('PostgreSQL database initialized - tables managed via migrations');
