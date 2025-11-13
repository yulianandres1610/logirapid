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
      max: 10,
      min: 0,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      statement_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Event handler para errores del pool
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      if (err.message.includes('termination') || err.message.includes('timeout')) {
        console.log('🔄 Recreating pool due to connection error...');
        pool = null; // Force pool recreation on next query
      }
    });
  }

  return pool;
}

// Wrapper para PostgreSQL con métodos convenientes
class DatabaseWrapper {
  async query(text: string, params?: any[], retries = 1) {
    try {
      const result = await getPool().query(text, params);
      return result;
    } catch (error: any) {
      console.error('Database query error:', error);

      if (retries > 0 && (error.message?.includes('termination') || error.message?.includes('timeout'))) {
        console.log('🔄 Connection error detected, retrying...');
        pool = null; // Reset pool
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
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
    const result = await getPool().query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
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
