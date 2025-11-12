-- PostgreSQL Migration Script from SQLite
-- Database: CubaRapid/LogiRapid

-- Drop all tables if they exist (careful in production!)
DROP TABLE IF EXISTS package_sizes CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS empaques CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS package_orders CASCADE;
DROP TABLE IF EXISTS customer_change_history CASCADE;
DROP TABLE IF EXISTS call_center_notes CASCADE;
DROP TABLE IF EXISTS order_notes CASCADE;
DROP TABLE IF EXISTS crm_orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS company_agency_configs CASCADE;
DROP TABLE IF EXISTS agency_rates_history CASCADE;
DROP TABLE IF EXISTS agency_rates_config CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS user_companies CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;

-- Create warehouses table
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Estados Unidos',
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    manager_name VARCHAR(255),
    manager_email VARCHAR(255),
    manager_phone VARCHAR(50),
    operating_hours VARCHAR(50) NOT NULL DEFAULT 'standard',
    custom_operating_hours TEXT,
    total_area DECIMAL(10,2) DEFAULT 0,
    capacity INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    opening_date DATE,
    notes TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    password TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastLogin TIMESTAMP,
    transactionsCount INTEGER DEFAULT 0,
    isActive BOOLEAN DEFAULT true,
    sendEmail BOOLEAN DEFAULT true
);

-- Create companies table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    legalName VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    walletNumber VARCHAR(100) NOT NULL UNIQUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    isMultiCurrency BOOLEAN DEFAULT false,
    secondaryCurrencies JSON DEFAULT '[]',
    hasLimits BOOLEAN DEFAULT false,
    dailyLimit DECIMAL(15,2) DEFAULT 0,
    monthlyLimit DECIMAL(15,2) DEFAULT 0,
    companyType VARCHAR(50) NOT NULL,
    enabledServices JSON DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    einNumber VARCHAR(50) NOT NULL,
    walletBalance DECIMAL(15,2) DEFAULT 0,
    transactionsCount INTEGER DEFAULT 0,
    usersCount INTEGER DEFAULT 0
);

-- Create user_companies junction table
CREATE TABLE user_companies (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    companyId INTEGER NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (companyId) REFERENCES companies (id) ON DELETE CASCADE,
    UNIQUE(userId, companyId)
);

-- Create transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    userId INTEGER,
    companyId INTEGER,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id),
    FOREIGN KEY (companyId) REFERENCES companies (id)
);

-- Create agency_rates_config table
CREATE TABLE agency_rates_config (
    id VARCHAR(255) PRIMARY KEY,
    adjustmentPercentage DECIMAL(5,2) NOT NULL,
    isActive BOOLEAN NOT NULL DEFAULT true,
    companyId VARCHAR(255),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdBy VARCHAR(255) NOT NULL
);

-- Create agency_rates_history table
CREATE TABLE agency_rates_history (
    id VARCHAR(255) PRIMARY KEY,
    configId VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    baseRate DECIMAL(15,6) NOT NULL,
    agencyRate DECIMAL(15,6) NOT NULL,
    adjustmentPercentage DECIMAL(5,2) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (configId) REFERENCES agency_rates_config(id)
);

-- Create company_agency_configs table
CREATE TABLE company_agency_configs (
    id VARCHAR(255) PRIMARY KEY,
    companyId VARCHAR(255) NOT NULL UNIQUE,
    agencyConfigId VARCHAR(255),
    isActive BOOLEAN NOT NULL DEFAULT true,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agencyConfigId) REFERENCES agency_rates_config(id)
);

-- Create customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    idNumber VARCHAR(50),
    idType VARCHAR(50),
    phone VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    notes TEXT,
    createdBy VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    zipCode VARCHAR(20),
    apartment VARCHAR(50)
);

-- Create crm_orders table
CREATE TABLE crm_orders (
    id SERIAL PRIMARY KEY,
    customerId INTEGER NOT NULL,
    orderNumber VARCHAR(100) NOT NULL UNIQUE,
    packageType VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    createdBy VARCHAR(255) NOT NULL,
    agentId VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers (id)
);

-- Create order_notes table
CREATE TABLE order_notes (
    id SERIAL PRIMARY KEY,
    orderId INTEGER NOT NULL,
    content TEXT NOT NULL,
    agentId VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orderId) REFERENCES crm_orders (id)
);

-- Create call_center_notes table
CREATE TABLE call_center_notes (
    id SERIAL PRIMARY KEY,
    customerId INTEGER NOT NULL,
    note TEXT NOT NULL,
    createdBy VARCHAR(255) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers (id)
);

-- Create customer_change_history table
CREATE TABLE customer_change_history (
    id SERIAL PRIMARY KEY,
    customerId INTEGER NOT NULL,
    fieldName VARCHAR(100) NOT NULL,
    oldValue TEXT,
    newValue TEXT,
    changedBy VARCHAR(255) NOT NULL,
    changedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changeType VARCHAR(50) NOT NULL DEFAULT 'update',
    FOREIGN KEY (customerId) REFERENCES customers (id)
);

-- Create package_orders table
CREATE TABLE package_orders (
    id SERIAL PRIMARY KEY,
    orderNumber VARCHAR(100) NOT NULL UNIQUE,
    customerId INTEGER NOT NULL,
    customerName VARCHAR(255) NOT NULL,
    customerAddress TEXT,
    services JSON NOT NULL,
    notes TEXT,
    scheduledDate DATE,
    timeSlot VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    createdBy VARCHAR(255),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Financial fields
    subtotal DECIMAL(15,2) DEFAULT 0,
    taxAmount DECIMAL(15,2) DEFAULT 0,
    totalAmount DECIMAL(15,2) DEFAULT 0,
    boxCount INTEGER DEFAULT 0,
    boxPrice DECIMAL(15,2) DEFAULT 0,
    additionalServices JSON DEFAULT '[]',
    paymentMethod VARCHAR(50) DEFAULT 'cash_on_delivery',
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    routeId INTEGER,
    stopNumber INTEGER,
    servicePackages JSON,
    serviceQuantities JSON DEFAULT '{}',
    needsBoxConstruction JSON DEFAULT '{}',
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    customerNotes TEXT,
    boxes JSON DEFAULT '[]',
    FOREIGN KEY (customerId) REFERENCES customers (id)
);

-- Create customer_addresses table
CREATE TABLE customer_addresses (
    id SERIAL PRIMARY KEY,
    customerId INTEGER NOT NULL,
    street TEXT NOT NULL,
    apartment VARCHAR(50),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    zipCode VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    notes TEXT,
    isPrimary BOOLEAN DEFAULT false,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customerId) REFERENCES customers (id)
);

-- Create routes table
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    routeNumber VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    driverId INTEGER,
    driverName VARCHAR(255),
    vehicleId INTEGER,
    vehiclePlate VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    totalPackages INTEGER DEFAULT 0,
    deliveredPackages INTEGER DEFAULT 0,
    estimatedDuration VARCHAR(50),
    actualDuration VARCHAR(50),
    distance DECIMAL(10,2),
    startTime TIMESTAMP,
    endTime TIMESTAMP,
    date DATE NOT NULL,
    notes TEXT,
    mechanism VARCHAR(50) NOT NULL DEFAULT 'manual',
    timeWindows JSON DEFAULT '[]',
    warehouseId VARCHAR(255) NOT NULL,
    optimizedRoute JSON,
    stops JSON DEFAULT '[]',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    qr_code VARCHAR(255),
    qrCode VARCHAR(255),
    mapboxJobId VARCHAR(255)
);

-- Create unique index for qr_code
CREATE UNIQUE INDEX idx_routes_qr_code ON routes(qr_code) WHERE qr_code IS NOT NULL;

-- Create empaques table
CREATE TABLE empaques (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(100) UNIQUE NOT NULL,
    tamano VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'disponible',
    cliente_id INTEGER,
    orden_id INTEGER,
    fecha_asignacion TIMESTAMP,
    descripcion TEXT
);

-- Create zones table
CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    companyId INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    zipCodes JSON NOT NULL, -- JSON array of zip codes
    color VARCHAR(20),
    timeSlot VARCHAR(50), -- e.g., "8:00 AM - 12:00 PM"
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES companies (id) ON DELETE CASCADE
);

-- Create package_sizes table
CREATE TABLE package_sizes (
    id SERIAL PRIMARY KEY,
    companyId INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    dimensions VARCHAR(50) NOT NULL, -- e.g., "12x10x8"
    weight DECIMAL(10,2), -- peso máximo en libras
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    description TEXT,
    isDefault BOOLEAN DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (companyId) REFERENCES companies (id) ON DELETE CASCADE
);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agency_rates_config_updated_at BEFORE UPDATE ON agency_rates_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_agency_configs_updated_at BEFORE UPDATE ON company_agency_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_package_orders_updated_at BEFORE UPDATE ON package_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_package_sizes_updated_at BEFORE UPDATE ON package_sizes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_companies_wallet ON companies(walletNumber);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_package_orders_status ON package_orders(status);
CREATE INDEX idx_package_orders_customer ON package_orders(customerId);
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_date ON routes(date);
CREATE INDEX idx_zones_company ON zones(companyId);
CREATE INDEX idx_package_sizes_company ON package_sizes(companyId);