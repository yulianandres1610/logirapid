-- Tablas necesarias para el sistema de failover
-- Se crean automáticamente al inicializar PostgreSQL

-- Log de salud del sistema
CREATE TABLE IF NOT EXISTS system_health_log (
    id SERIAL PRIMARY KEY,
    check_type VARCHAR(50) NOT NULL,        -- 'primary', 'standby', 'failover', 'recovery'
    status VARCHAR(20) NOT NULL,            -- 'healthy', 'unhealthy', 'failover', 'recovered'
    latency_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log de escrituras durante failover (para replay posterior)
CREATE TABLE IF NOT EXISTS failover_writes_log (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(10) NOT NULL,          -- 'INSERT', 'UPDATE', 'DELETE'
    query_text TEXT NOT NULL,
    query_params JSONB,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    replayed_at TIMESTAMP WITH TIME ZONE,   -- NULL hasta que se replaye a primary
    replay_status VARCHAR(20) DEFAULT 'pending'  -- 'pending', 'replayed', 'failed'
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_health_log_created ON system_health_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_log_type ON system_health_log(check_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_failover_writes_status ON failover_writes_log(replay_status) WHERE replay_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_failover_writes_executed ON failover_writes_log(executed_at);
