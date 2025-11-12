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