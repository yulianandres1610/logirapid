import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'cubarapid.db')

// Crear directorio si no existe
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

// Crear conexión a la base de datos
export const db = new Database(DB_PATH)

// Inicializar tablas
export function initializeDatabase() {
  // Tabla de usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      password TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      lastLogin TEXT,
      transactionsCount INTEGER DEFAULT 0,
      isActive BOOLEAN DEFAULT 1,
      sendEmail BOOLEAN DEFAULT 1
    )
  `)

  // Tabla de empresas
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legalName TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      walletNumber TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL DEFAULT 'USD',
      isMultiCurrency BOOLEAN DEFAULT 0,
      secondaryCurrencies TEXT DEFAULT '[]',
      hasLimits BOOLEAN DEFAULT 0,
      dailyLimit TEXT DEFAULT '0',
      monthlyLimit TEXT DEFAULT '0',
      companyType TEXT NOT NULL,
      enabledServices TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      einNumber TEXT NOT NULL,
      walletBalance REAL DEFAULT 0,
      transactionsCount INTEGER DEFAULT 0,
      usersCount INTEGER DEFAULT 0
    )
  `)

  // Tabla de relación usuarios-empresas
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      companyId INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (companyId) REFERENCES companies (id) ON DELETE CASCADE,
      UNIQUE(userId, companyId)
    )
  `)

  // Tabla de transacciones
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      companyId INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TEXT,
      FOREIGN KEY (userId) REFERENCES users (id),
      FOREIGN KEY (companyId) REFERENCES companies (id)
    )
  `)

  // Tabla para configuración de tasas de agencia
  db.exec(`
    CREATE TABLE IF NOT EXISTS agency_rates_config (
      id TEXT PRIMARY KEY,
      adjustmentPercentage REAL NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      companyId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      createdBy TEXT NOT NULL
    )
  `)

  // Tabla para registro histórico de tasas
  db.exec(`
    CREATE TABLE IF NOT EXISTS agency_rates_history (
      id TEXT PRIMARY KEY,
      configId TEXT NOT NULL,
      currency TEXT NOT NULL,
      baseRate REAL NOT NULL,
      agencyRate REAL NOT NULL,
      adjustmentPercentage REAL NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (configId) REFERENCES agency_rates_config(id)
    )
  `)

  // Tabla para configuraciones específicas de empresas
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_agency_configs (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL UNIQUE,
      agencyConfigId TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (agencyConfigId) REFERENCES agency_rates_config(id)
    )
  `)

  // Tabla para clientes del CRM
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      idNumber TEXT,
      idType TEXT,
      phone TEXT NOT NULL UNIQUE,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      notes TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `)

  // Agregar nuevas columnas si no existen (para migración)
  try {
    db.exec(`ALTER TABLE customers ADD COLUMN idNumber TEXT`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE customers ADD COLUMN idType TEXT`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE customers ADD COLUMN state TEXT`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE customers ADD COLUMN country TEXT`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE customers ADD COLUMN zipCode TEXT`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE customers ADD COLUMN apartment TEXT`)
  } catch (e) {
    // La columna ya existe
  }

  // Agregar columnas financieras a package_orders si no existen (para migración)
  try {
    db.exec(`ALTER TABLE package_orders ADD COLUMN subtotal REAL DEFAULT 0`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE package_orders ADD COLUMN taxAmount REAL DEFAULT 0`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE package_orders ADD COLUMN totalAmount REAL DEFAULT 0`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE package_orders ADD COLUMN boxCount INTEGER DEFAULT 0`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE package_orders ADD COLUMN boxPrice REAL DEFAULT 0`)
  } catch (e) {
    // La columna ya existe
  }

  try {
    db.exec(`ALTER TABLE package_orders ADD COLUMN additionalServices TEXT DEFAULT '[]'`)
  } catch (e) {
    // La columna ya existe
  }

  // Tabla para órdenes del CRM
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      orderNumber TEXT NOT NULL UNIQUE,
      packageType TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      createdBy TEXT NOT NULL,
      agentId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers (id)
    )
  `)

  // Tabla para notas de órdenes
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      content TEXT NOT NULL,
      agentId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (orderId) REFERENCES crm_orders (id)
    )
  `)

  // Tabla para notas de atención al cliente
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_center_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      note TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers (id)
    )
  `)

  // Tabla para historial de cambios en clientes
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_change_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      fieldName TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT,
      changedBy TEXT NOT NULL,
      changedAt TEXT NOT NULL,
      changeType TEXT NOT NULL DEFAULT 'update',
      FOREIGN KEY (customerId) REFERENCES customers (id)
    )
  `)

  // Tabla de órdenes de paquetería
  db.exec(`
    CREATE TABLE IF NOT EXISTS package_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNumber TEXT NOT NULL UNIQUE,
      customerId INTEGER NOT NULL,
      customerName TEXT NOT NULL,
      customerAddress TEXT,
      services TEXT NOT NULL,
      notes TEXT,
      scheduledDate TEXT,
      timeSlot TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      -- Financial fields
      subtotal REAL DEFAULT 0,
      taxAmount REAL DEFAULT 0,
      totalAmount REAL DEFAULT 0,
      boxCount INTEGER DEFAULT 0,
      boxPrice REAL DEFAULT 0,
      additionalServices TEXT DEFAULT '[]',
      paymentMethod TEXT DEFAULT 'cash_on_delivery',
      FOREIGN KEY (customerId) REFERENCES customers (id)
    )
  `)

  // Add coordinates columns to package_orders table if they don't exist
  try {
    db.exec(`
      ALTER TABLE package_orders ADD COLUMN latitude REAL
    `)
    console.log('Added latitude column to package_orders table')
  } catch (error) {
    // Column might already exist, which is fine
    console.log('latitude column already exists or could not be added')
  }

  try {
    db.exec(`
      ALTER TABLE package_orders ADD COLUMN longitude REAL
    `)
    console.log('Added longitude column to package_orders table')
  } catch (error) {
    // Column might already exist, which is fine
    console.log('longitude column already exists or could not be added')
  }

  // Add paymentMethod column to existing package_orders table if it doesn't exist
  try {
    db.exec(`
      ALTER TABLE package_orders ADD COLUMN paymentMethod TEXT DEFAULT 'cash_on_delivery'
    `)
    console.log('Added paymentMethod column to package_orders table')
  } catch (error) {
    // Column might already exist, which is fine
    console.log('paymentMethod column already exists or could not be added')
  }

  // Tabla de direcciones de clientes
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      street TEXT NOT NULL,
      apartment TEXT,
      city TEXT NOT NULL,
      state TEXT,
      zipCode TEXT,
      country TEXT NOT NULL,
      notes TEXT,
      isPrimary INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers (id)
    )
  `)

  // Tabla de almacenes
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zipCode TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Estados Unidos',
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      managerName TEXT,
      managerEmail TEXT,
      managerPhone TEXT,
      operatingHours TEXT NOT NULL DEFAULT 'standard',
      customOperatingHours TEXT,
      totalArea REAL DEFAULT 0,
      capacity INTEGER DEFAULT 0,
      currentStock INTEGER DEFAULT 0,
      openingDate TEXT,
      notes TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log('Database initialized successfully')
}

// Insertar datos por defecto si las tablas están vacías
export function seedDefaultData() {
  // Verificar si ya hay datos
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  const companyCount = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number }

  if (userCount.count === 0) {
    // Insertar usuario admin por defecto
    const insertUser = db.prepare(`
      INSERT INTO users (firstName, lastName, email, phone, address, city, country, role, password, status, createdAt, lastLogin, transactionsCount, isActive, sendEmail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertUser.run(
      'Super',
      'Admin',
      'admin@cubarapid.com',
      '+53 7 832 4567',
      'Calle 23 #456, Vedado',
      'La Habana',
      'Cuba',
      'super_admin',
      '$2b$10$rOZjKxQxZKxKxKxKxKxKxKxKxKxKxKxKxKxKxKxKxK',
      'active',
      new Date().toISOString(),
      new Date().toISOString(),
      0,
      1,
      1
    )
  }

  if (companyCount.count === 0) {
    // Insertar empresas por defecto
    const insertCompany = db.prepare(`
      INSERT INTO companies (
        legalName, phone, address, city, country, walletNumber, currency,
        isMultiCurrency, secondaryCurrencies, hasLimits, dailyLimit, monthlyLimit,
        companyType, enabledServices, status, createdAt, einNumber,
        walletBalance, transactionsCount, usersCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const defaultCompanies = [
      {
        legalName: 'CubaExpress S.A.',
        phone: '+53 7 832 4567',
        address: 'Calle 23 #456, Vedado',
        city: 'La Habana',
        country: 'Cuba',
        walletNumber: '2026152345678901',
        currency: 'USD',
        isMultiCurrency: 1,
        secondaryCurrencies: '["CUP", "EUR"]',
        hasLimits: 1,
        dailyLimit: '5000',
        monthlyLimit: '50000',
        companyType: 'agency',
        enabledServices: '["wallet", "recharge", "tracker"]',
        status: 'active',
        createdAt: '2024-01-15',
        einNumber: 'CU-12345678',
        walletBalance: 15420.50,
        transactionsCount: 342,
        usersCount: 28
      },
      {
        legalName: 'CaribbeanMarket Ltd.',
        phone: '+1 809 555 0123',
        address: 'Avenida Churchill #123',
        city: 'Santo Domingo',
        country: 'República Dominicana',
        walletNumber: '2026987654321098',
        currency: 'USD',
        isMultiCurrency: 0,
        secondaryCurrencies: '[]',
        hasLimits: 0,
        dailyLimit: '0',
        monthlyLimit: '0',
        companyType: 'market',
        enabledServices: '["wallet", "marketplace"]',
        status: 'active',
        createdAt: '2024-02-20',
        einNumber: 'RD-87654321',
        walletBalance: 8930.75,
        transactionsCount: 156,
        usersCount: 45
      },
      {
        legalName: 'GlobalRemit Corp.',
        phone: '+1 305 888 9999',
        address: 'Brickell Ave #789',
        city: 'Miami',
        country: 'Estados Unidos',
        walletNumber: '2026456789012345',
        currency: 'USD',
        isMultiCurrency: 1,
        secondaryCurrencies: '["CAD", "EUR"]',
        hasLimits: 1,
        dailyLimit: '10000',
        monthlyLimit: '100000',
        companyType: 'broker',
        enabledServices: '["wallet", "recharge", "tracker", "marketplace"]',
        status: 'active',
        createdAt: '2024-03-10',
        einNumber: 'US-987654321',
        walletBalance: 45680.25,
        transactionsCount: 892,
        usersCount: 67
      }
    ]

    defaultCompanies.forEach(company => {
      insertCompany.run(
        company.legalName,
        company.phone,
        company.address,
        company.city,
        company.country,
        company.walletNumber,
        company.currency,
        company.isMultiCurrency,
        company.secondaryCurrencies,
        company.hasLimits,
        company.dailyLimit,
        company.monthlyLimit,
        company.companyType,
        company.enabledServices,
        company.status,
        company.createdAt,
        company.einNumber,
        company.walletBalance,
        company.transactionsCount,
        company.usersCount
      )
    })
  }

  console.log('Default data seeded successfully')
}

// Funciones para tasas de agencia
export function saveAgencyConfig(config: {
  id: string
  adjustmentPercentage: number
  isActive: boolean
  companyId?: string
  createdBy: string
}) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agency_rates_config
    (id, adjustmentPercentage, isActive, companyId, createdAt, updatedAt, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  stmt.run(
    config.id,
    config.adjustmentPercentage,
    config.isActive ? 1 : 0,
    config.companyId || null,
    now,
    now,
    config.createdBy
  )

  return config
}

export function getAgencyConfig(companyId?: string) {
  let query = `
    SELECT * FROM agency_rates_config
    WHERE isActive = 1
  `
  let params: any[] = []

  if (companyId) {
    // Primero buscar configuración específica de la empresa
    const companyConfig = db.prepare(`
      SELECT arc.* FROM agency_rates_config arc
      JOIN company_agency_configs cac ON arc.id = cac.agencyConfigId
      WHERE cac.companyId = ? AND cac.isActive = 1 AND arc.isActive = 1
      ORDER BY arc.updatedAt DESC
      LIMIT 1
    `).get(companyId)

    if (companyConfig) {
      return companyConfig
    }
  }

  // Si no hay configuración específica, buscar la global
  query += ` AND (companyId IS NULL OR companyId = '') ORDER BY updatedAt DESC LIMIT 1`

  return db.prepare(query).get(...params)
}

export function updateAgencyConfig(id: string, updateData: {
  adjustmentPercentage?: number
  isActive?: boolean
}) {
  const updates: string[] = []
  const params: any[] = []

  if (updateData.adjustmentPercentage !== undefined) {
    updates.push('adjustmentPercentage = ?')
    params.push(updateData.adjustmentPercentage)
  }

  if (updateData.isActive !== undefined) {
    updates.push('isActive = ?')
    params.push(updateData.isActive ? 1 : 0)
  }

  updates.push('updatedAt = ?')
  params.push(new Date().toISOString())
  params.push(id)

  const stmt = db.prepare(`
    UPDATE agency_rates_config
    SET ${updates.join(', ')}
    WHERE id = ?
  `)

  return stmt.run(...params)
}

export function saveAgencyRatesHistory(history: {
  id: string
  configId: string
  currency: string
  baseRate: number
  agencyRate: number
  adjustmentPercentage: number
}[]) {
  const stmt = db.prepare(`
    INSERT INTO agency_rates_history
    (id, configId, currency, baseRate, agencyRate, adjustmentPercentage, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    history.forEach(record => {
      stmt.run(
        record.id,
        record.configId,
        record.currency,
        record.baseRate,
        record.agencyRate,
        record.adjustmentPercentage,
        new Date().toISOString()
      )
    })
  })

  transaction()
  return history
}

export function getAgencyRatesHistory(configId: string, days: number = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return db.prepare(`
    SELECT * FROM agency_rates_history
    WHERE configId = ? AND timestamp >= ?
    ORDER BY timestamp DESC
  `).all(configId, cutoffDate.toISOString())
}

export function saveCompanyAgencyConfig(config: {
  id: string
  companyId: string
  agencyConfigId?: string
}) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO company_agency_configs
    (id, companyId, agencyConfigId, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, 1, ?, ?)
  `)

  const now = new Date().toISOString()
  return stmt.run(config.id, config.companyId, config.agencyConfigId || null, now, now)
}

export function getCompanyAgencyConfig(companyId: string) {
  return db.prepare(`
    SELECT cac.*, arc.adjustmentPercentage, arc.isActive as configActive
    FROM company_agency_configs cac
    LEFT JOIN agency_rates_config arc ON cac.agencyConfigId = arc.id
    WHERE cac.companyId = ? AND cac.isActive = 1
    ORDER BY cac.updatedAt DESC
    LIMIT 1
  `).get(companyId)
}

// Funciones para usuarios
export function saveUser(user: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  city?: string
  country?: string
  role: string
  password: string
  status?: string
  createdAt: string
  lastLogin?: string
  transactionsCount?: number
  isActive?: boolean
  sendEmail?: boolean
}) {
  const stmt = db.prepare(`
    INSERT INTO users (
      firstName, lastName, email, phone, address, city, country, role,
      password, status, createdAt, lastLogin, transactionsCount, isActive, sendEmail
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    user.firstName,
    user.lastName,
    user.email,
    user.phone || null,
    user.address || null,
    user.city || null,
    user.country || null,
    user.role,
    user.password,
    user.status || 'active',
    user.createdAt,
    user.lastLogin || null,
    user.transactionsCount || 0,
    user.isActive ? 1 : 0,
    user.sendEmail ? 1 : 0
  )

  return { ...user, id: result.lastInsertRowid as number }
}

export function getAllUsers() {
  return db.prepare(`
    SELECT * FROM users
    ORDER BY createdAt DESC
  `).all()
}

export function getUserByEmail(email: string) {
  return db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(email)
}

export function updateUser(id: number, updateData: {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  role?: string
  status?: string
  lastLogin?: string
  transactionsCount?: number
  isActive?: boolean
}) {
  const updates: string[] = []
  const params: any[] = []

  if (updateData.firstName !== undefined) {
    updates.push('firstName = ?')
    params.push(updateData.firstName)
  }
  if (updateData.lastName !== undefined) {
    updates.push('lastName = ?')
    params.push(updateData.lastName)
  }
  if (updateData.email !== undefined) {
    updates.push('email = ?')
    params.push(updateData.email)
  }
  if (updateData.phone !== undefined) {
    updates.push('phone = ?')
    params.push(updateData.phone)
  }
  if (updateData.address !== undefined) {
    updates.push('address = ?')
    params.push(updateData.address)
  }
  if (updateData.city !== undefined) {
    updates.push('city = ?')
    params.push(updateData.city)
  }
  if (updateData.country !== undefined) {
    updates.push('country = ?')
    params.push(updateData.country)
  }
  if (updateData.role !== undefined) {
    updates.push('role = ?')
    params.push(updateData.role)
  }
  if (updateData.status !== undefined) {
    updates.push('status = ?')
    params.push(updateData.status)
  }
  if (updateData.lastLogin !== undefined) {
    updates.push('lastLogin = ?')
    params.push(updateData.lastLogin)
  }
  if (updateData.transactionsCount !== undefined) {
    updates.push('transactionsCount = ?')
    params.push(updateData.transactionsCount)
  }
  if (updateData.isActive !== undefined) {
    updates.push('isActive = ?')
    params.push(updateData.isActive ? 1 : 0)
  }

  if (updates.length === 0) return

  params.push(id)
  const stmt = db.prepare(`
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = ?
  `)

  return stmt.run(...params)
}

export function deleteUser(id: number) {
  const stmt = db.prepare('DELETE FROM users WHERE id = ?')
  return stmt.run(id)
}

// Funciones para relación usuarios-empresas
export function assignUserToCompany(userId: number, companyId: number) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO user_companies (userId, companyId, createdAt)
    VALUES (?, ?, ?)
  `)

  return stmt.run(userId, companyId, new Date().toISOString())
}

export function getUserCompanies(userId: number) {
  return db.prepare(`
    SELECT c.* FROM companies c
    JOIN user_companies uc ON c.id = uc.companyId
    WHERE uc.userId = ?
    ORDER BY c.legalName
  `).all(userId)
}

export function removeUserFromCompany(userId: number, companyId: number) {
  const stmt = db.prepare('DELETE FROM user_companies WHERE userId = ? AND companyId = ?')
  return stmt.run(userId, companyId)
}

// Funciones para empresas
export function getAllCompanies() {
  return db.prepare(`
    SELECT * FROM companies
    ORDER BY legalName ASC
  `).all()
}

// Crear configuración por defecto si no existe
export function createDefaultAgencyConfig() {
  const existingConfig = getAgencyConfig()

  if (!existingConfig) {
    const defaultConfig = saveAgencyConfig({
      id: 'global_config_1',
      adjustmentPercentage: 5.0,
      isActive: true,
      createdBy: 'system'
    })

    console.log('✅ Configuración por defecto de tasas de agencia creada')
    return defaultConfig
  }

  return existingConfig
}

// Funciones para CRM - Call Center
export function saveCustomer(customer: {
  firstName: string
  lastName: string
  idNumber?: string
  idType?: string
  phone: string
  email?: string
  address?: string
  city?: string
  state?: string
  country?: string
  notes?: string
  createdBy: string
}) {
  const stmt = db.prepare(`
    INSERT INTO customers (
      firstName, lastName, idNumber, idType, phone, email, address, city, state, country, notes, createdBy, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    customer.firstName,
    customer.lastName,
    customer.idNumber || null,
    customer.idType || null,
    customer.phone,
    customer.email || null,
    customer.address || null,
    customer.city || null,
    customer.state || null,
    customer.country || null,
    customer.notes || null,
    customer.createdBy,
    new Date().toISOString()
  )

  return { ...customer, id: result.lastInsertRowid as number }
}

export function getAllCustomers() {
  return db.prepare(`
    SELECT * FROM customers
    ORDER BY createdAt DESC
  `).all()
}

export function getCustomerByPhone(phone: string) {
  return db.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).get(phone)
}

export function searchCustomers(query: string) {
  const stmt = db.prepare(`
    SELECT * FROM customers
    WHERE firstName LIKE ? OR lastName LIKE ? OR phone LIKE ? OR email LIKE ?
    ORDER BY createdAt DESC
  `)

  const searchPattern = `%${query}%`
  return stmt.all(searchPattern, searchPattern, searchPattern, searchPattern)
}

export function updateCustomer(id: number, updateData: {
  firstName?: string
  lastName?: string
  idNumber?: string
  idType?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  country?: string
  notes?: string
}) {
  const updates: string[] = []
  const params: any[] = []

  if (updateData.firstName !== undefined) {
    updates.push('firstName = ?')
    params.push(updateData.firstName)
  }
  if (updateData.lastName !== undefined) {
    updates.push('lastName = ?')
    params.push(updateData.lastName)
  }
  if (updateData.idNumber !== undefined) {
    updates.push('idNumber = ?')
    params.push(updateData.idNumber)
  }
  if (updateData.idType !== undefined) {
    updates.push('idType = ?')
    params.push(updateData.idType)
  }
  if (updateData.phone !== undefined) {
    updates.push('phone = ?')
    params.push(updateData.phone)
  }
  if (updateData.email !== undefined) {
    updates.push('email = ?')
    params.push(updateData.email)
  }
  if (updateData.address !== undefined) {
    updates.push('address = ?')
    params.push(updateData.address)
  }
  if (updateData.city !== undefined) {
    updates.push('city = ?')
    params.push(updateData.city)
  }
  if (updateData.state !== undefined) {
    updates.push('state = ?')
    params.push(updateData.state)
  }
  if (updateData.country !== undefined) {
    updates.push('country = ?')
    params.push(updateData.country)
  }
  if (updateData.notes !== undefined) {
    updates.push('notes = ?')
    params.push(updateData.notes)
  }

  if (updates.length === 0) return

  params.push(id)
  const stmt = db.prepare(`
    UPDATE customers
    SET ${updates.join(', ')}
    WHERE id = ?
  `)

  return stmt.run(...params)
}

export function saveOrder(order: {
  customerId: number
  orderNumber: string
  packageType: string
  status: string
  notes?: string
  createdBy: string
  agentId: string
}) {
  const stmt = db.prepare(`
    INSERT INTO crm_orders (
      customerId, orderNumber, packageType, status, notes, createdBy, agentId, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    order.customerId,
    order.orderNumber,
    order.packageType,
    order.status,
    order.notes || null,
    order.createdBy,
    order.agentId,
    new Date().toISOString()
  )

  return { ...order, id: result.lastInsertRowid as number }
}

export function getCustomerOrders(customerId: number) {
  return db.prepare(`
    SELECT o.*, c.firstName, c.lastName, c.phone
    FROM crm_orders o
    JOIN customers c ON o.customerId = c.id
    WHERE o.customerId = ?
    ORDER BY o.createdAt DESC
  `).all(customerId)
}

export function getOrderByNumber(orderNumber: string) {
  return db.prepare(`
    SELECT o.*, c.firstName, c.lastName, c.phone
    FROM crm_orders o
    JOIN customers c ON o.customerId = c.id
    WHERE o.orderNumber = ?
  `).get(orderNumber)
}

export function getAllOrders() {
  return db.prepare(`
    SELECT o.*, c.firstName, c.lastName, c.phone
    FROM crm_orders o
    JOIN customers c ON o.customerId = c.id
    ORDER BY o.createdAt DESC
  `).all()
}

export function updateOrder(id: number, updateData: {
  status?: string
  notes?: string
  packageType?: string
}) {
  const updates: string[] = []
  const params: any[] = []

  if (updateData.status !== undefined) {
    updates.push('status = ?')
    params.push(updateData.status)
  }
  if (updateData.notes !== undefined) {
    updates.push('notes = ?')
    params.push(updateData.notes)
  }
  if (updateData.packageType !== undefined) {
    updates.push('packageType = ?')
    params.push(updateData.packageType)
  }

  if (updates.length === 0) return

  params.push(id)
  const stmt = db.prepare(`
    UPDATE crm_orders
    SET ${updates.join(', ')}
    WHERE id = ?
  `)

  return stmt.run(...params)
}

export function saveOrderNote(orderId: number, note: {
  content: string
  agentId: string
}) {
  const stmt = db.prepare(`
    INSERT INTO order_notes (
      orderId, content, agentId, createdAt
    )
    VALUES (?, ?, ?, ?)
  `)

  const result = stmt.run(
    orderId,
    note.content,
    note.agentId,
    new Date().toISOString()
  )

  return { ...note, id: result.lastInsertRowid as number }
}

export function getOrderNotes(orderId: number) {
  return db.prepare(`
    SELECT on.*, u.firstName, u.lastName
    FROM order_notes on
    LEFT JOIN users u ON on.agentId = u.email
    WHERE on.orderId = ?
    ORDER BY on.createdAt DESC
  `).all(orderId)
}

// Funciones para notas de atención al cliente
export function createCallCenterNote(customerId: number, note: string, createdBy: string, priority: string = 'medium') {
  const result = db.prepare(`
    INSERT INTO call_center_notes (customerId, note, createdBy, priority, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    customerId,
    note,
    createdBy,
    priority,
    new Date().toISOString()
  )

  return { id: result.lastInsertRowid as number }
}

export function getCallCenterNotes(customerId: number) {
  return db.prepare(`
    SELECT ccn.*, u.firstName, u.lastName
    FROM call_center_notes ccn
    LEFT JOIN users u ON ccn.createdBy = u.email
    WHERE ccn.customerId = ?
    ORDER BY ccn.createdAt DESC
  `).all(customerId)
}

// ========== FUNCIONES PARA HISTORIAL DE CAMBIOS DE CLIENTES ==========

// Función para registrar un cambio en un cliente
export function addCustomerChangeHistory(
  customerId: number,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy: string,
  changeType: string = 'update'
) {
  try {
    const result = db.prepare(`
      INSERT INTO customer_change_history (customerId, fieldName, oldValue, newValue, changedBy, changedAt, changeType)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      new Date().toISOString(),
      changeType
    )
    return { id: result.lastInsertRowid as number }
  } catch (error) {
    console.error('Error adding customer change history:', error)
    throw error
  }
}

// Función para obtener el historial de cambios de un cliente
export function getCustomerChangeHistory(customerId: number) {
  try {
    return db.prepare(`
      SELECT
        cch.*,
        cch.changedBy as changedByName
      FROM customer_change_history cch
      WHERE cch.customerId = ?
      ORDER BY cch.changedAt DESC
    `).all(customerId)
  } catch (error) {
    console.error('Error getting customer change history:', error)
    return []
  }
}

// Función para actualizar un cliente y registrar los cambios
export function updateCustomerWithHistory(customerId: number, updateData: any, changedBy: string) {
  try {
    console.log('🔧 Updating customer:', { customerId, updateData, changedBy })

    // Obtener los datos actuales del cliente
    const currentCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)

    if (!currentCustomer) {
      throw new Error('Cliente no encontrado')
    }

    console.log('📋 Current customer data:', currentCustomer)

    // Campos que se pueden actualizar
    const allowedFields = ['firstName', 'lastName', 'idNumber', 'idType', 'phone', 'email', 'address', 'city', 'state', 'country', 'notes']

    // Construir la consulta de actualización dinámicamente
    const setClause = []
    const values = []

    for (const [key, value] of Object.entries(updateData)) {
      console.log(`🔍 Checking field "${key}":`, {
        allowed: allowedFields.includes(key),
        currentValue: (currentCustomer as any)[key],
        newValue: value,
        hasChanged: (currentCustomer as any)[key] !== value
      })

      if (allowedFields.includes(key) && (currentCustomer as any)[key] !== value) {
        setClause.push(`${key} = ?`)
        values.push(value)

        console.log(`✅ Field "${key}" will be updated`)

        // Registrar el cambio en el historial
        addCustomerChangeHistory(
          customerId,
          key,
          (currentCustomer as any)[key] ? String((currentCustomer as any)[key]) : null,
          value ? String(value) : null,
          changedBy,
          'update'
        )
      }
    }

    if (setClause.length === 0) {
      console.log('⚠️ No changes detected')
      return { changes: 0 } // No hay cambios que realizar
    }

    values.push(customerId)

    const updateQuery = `UPDATE customers SET ${setClause.join(', ')} WHERE id = ?`
    console.log('🚀 Executing SQL:', updateQuery)
    console.log('📝 With values:', values)

    const result = db.prepare(updateQuery).run(...values)

    console.log('✅ Update result:', result)
    return result
  } catch (error) {
    console.error('Error updating customer with history:', error)
    throw error
  }
}

// ========== FUNCIONES GLOBALES PARA ACCESO A CLIENTES DESDE CUALQUIER VISTA ==========

// Función principal para obtener un cliente por teléfono (uso global)
export function getCustomerByPhoneGlobal(phone: string) {
  try {
    const customer = db.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).get(phone)

    return customer || null
  } catch (error) {
    console.error('Error getting customer by phone:', error)
    return null
  }
}

// Función principal para buscar clientes por texto (uso global)
export function searchCustomersGlobal(query: string) {
  try {
    const searchPattern = `%${query}%`
    const stmt = db.prepare(`
      SELECT * FROM customers
      WHERE firstName LIKE ? OR lastName LIKE ? OR phone LIKE ? OR email LIKE ?
      ORDER BY createdAt DESC
    `)
    return stmt.all(searchPattern, searchPattern, searchPattern, searchPattern)
  } catch (error) {
    console.error('Error searching customers:', error)
    return []
  }
}

// Función para obtener cliente por ID (uso global)
export function getCustomerByIdGlobal(id: number) {
  try {
    const customer = db.prepare(`
      SELECT * FROM customers WHERE id = ?
    `).get(id)

    return customer || null
  } catch (error) {
    console.error('Error getting customer by ID:', error)
    return null
  }
}

// Función para obtener todos los clientes (uso global)
export function getAllCustomersGlobal() {
  try {
    return db.prepare(`
      SELECT * FROM customers ORDER BY createdAt DESC
    `).all()
  } catch (error) {
    console.error('Error getting all customers:', error)
    return []
  }
}

// Función para obtener opciones de clientes para selects (formato simple)
export function getCustomerSelectOptions() {
  try {
    return db.prepare(`
      SELECT id, firstName, lastName, phone
      FROM customers
      ORDER BY firstName, lastName
    `).all()
  } catch (error) {
    console.error('Error getting customer select options:', error)
    return []
  }
}

// Función para verificar si un teléfono ya existe (validación)
export function isPhoneUniqueGlobal(phone: string, excludeId?: number) {
  try {
    let query = 'SELECT COUNT(*) as count FROM customers WHERE phone = ?'
    let params = [phone]

    if (excludeId) {
      query += ' AND id != ?'
      params.push(String(excludeId))
    }

    const result = db.prepare(query).get(...params) as { count: number }
    return result.count === 0
  } catch (error) {
    console.error('Error checking phone uniqueness:', error)
    return false
  }
}

// Función para obtener estadísticas de clientes (dashboard)
export function getCustomersStats() {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number }
    const thisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM customers
      WHERE createdAt >= date('now', '-1 month')
    `).get() as { count: number }

    return {
      total: total.count,
      thisMonth: thisMonth.count
    }
  } catch (error) {
    console.error('Error getting customers stats:', error)
    return { total: 0, thisMonth: 0 }
  }
}

// Función para eliminar un cliente (solo para superadmins)
export function deleteCustomer(id: number) {
  try {
    // Primero eliminar registros relacionados en otras tablas
    // Eliminar notas del call center
    db.prepare('DELETE FROM call_center_notes WHERE customerId = ?').run(id)

    // Eliminar historial de cambios
    db.prepare('DELETE FROM customer_change_history WHERE customerId = ?').run(id)

    // Eliminar el cliente
    const result = db.prepare('DELETE FROM customers WHERE id = ?').run(id)

    if (result.changes === 0) {
      throw new Error('Cliente no encontrado')
    }

    return { success: true, changes: result.changes }
  } catch (error) {
    console.error('Error deleting customer:', error)
    throw error
  }
}

// Address interface for package orders
interface PackageOrderAddress {
  street: string
  apartment?: string
  city: string
  state: string
  zipCode: string
  country: string
  notes?: string
  isPrimary?: boolean
  createdAt?: string
}

// Package Orders Functions
export function savePackageOrder(orderData: {
  orderNumber: string
  customerId: number
  customerName: string
  customerAddress?: string | PackageOrderAddress
  services: string[]
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status?: string
  createdBy?: string
  paymentMethod?: string
  latitude?: number | null
  longitude?: number | null
  // Financial fields
  subtotal?: number
  taxAmount?: number
  totalAmount?: number
  boxCount?: number
  boxPrice?: number
  additionalServices?: string
}) {
  try {
    const now = new Date().toISOString()

    const stmt = db.prepare(`
      INSERT INTO package_orders (
        orderNumber, customerId, customerName, customerAddress, services, notes,
        scheduledDate, timeSlot, status, createdBy, createdAt, updatedAt,
        latitude, longitude,
        subtotal, taxAmount, totalAmount, boxCount, boxPrice, additionalServices, paymentMethod
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      orderData.orderNumber,
      orderData.customerId,
      orderData.customerName,
      orderData.customerAddress || null,
      JSON.stringify(orderData.services), // Store services as JSON string
      orderData.notes || null,
      orderData.scheduledDate || null,
      orderData.timeSlot || null,
      orderData.status || 'pending',
      orderData.createdBy || 'system',
      now,
      now,
      // Coordinates
      orderData.latitude || null,
      orderData.longitude || null,
      // Financial fields
      orderData.subtotal || 0,
      orderData.taxAmount || 0,
      orderData.totalAmount || 0,
      orderData.boxCount || 0,
      orderData.boxPrice || 0,
      orderData.additionalServices || '[]',
      orderData.paymentMethod || 'cash_on_delivery'
    )

    return {
      id: result.lastInsertRowid,
      ...orderData,
      createdAt: now,
      updatedAt: now
    }
  } catch (error) {
    console.error('Error saving package order:', error)
    throw error
  }
}

export function getAllPackageOrders() {
  try {
    const stmt = db.prepare(`
      SELECT
        po.*,
        c.firstName,
        c.lastName,
        c.phone,
        c.email,
        c.address,
        c.notes as customerNotes
      FROM package_orders po
      LEFT JOIN customers c ON po.customerId = c.id
      ORDER BY po.createdAt DESC
    `)
    const orders = stmt.all() as any[]

    // Parse services from JSON string back to array
    return orders.map(order => ({
      ...order,
      services: JSON.parse(order.services || '[]'),
      customerAddress: order.customerAddress ? (() => {
        try {
          // Check if it's already an object (not a string)
          if (typeof order.customerAddress === 'object' && order.customerAddress !== null) {
            return order.customerAddress
          }
          // Try to parse as JSON string
          if (typeof order.customerAddress === 'string') {
            const trimmed = order.customerAddress.trim()
            if (trimmed.startsWith('{')) {
              return JSON.parse(trimmed)
            } else {
              return { street: trimmed }
            }
          }
          return null
        } catch (error) {
          console.warn('Failed to parse address:', order.customerAddress, error)
          return { street: typeof order.customerAddress === 'string' ? order.customerAddress : 'Unknown address' }
        }
      })() : null
    }))
  } catch (error) {
    console.error('Error getting all package orders:', error)
    throw error
  }
}

export function getPackageOrderById(id: number) {
  try {
    const stmt = db.prepare(`
      SELECT po.*, c.firstName, c.lastName, c.phone, c.email, c.address, c.notes as customerNotes
      FROM package_orders po
      LEFT JOIN customers c ON po.customerId = c.id
      WHERE po.id = ?
    `)
    const order = stmt.get(id) as any

    if (order) {
      // Parse services from JSON string back to array
      return {
        ...order,
        services: JSON.parse(order.services || '[]'),
        customerAddress: order.customerAddress ? (() => {
          try {
            return JSON.parse(order.customerAddress)
          } catch {
            return { street: order.customerAddress }
          }
        })() : null
      }
    }

    return null
  } catch (error) {
    console.error('Error getting package order by ID:', error)
    throw error
  }
}

export function getCustomerPackageOrders(customerId: number) {
  try {
    const stmt = db.prepare(`
      SELECT po.*, c.firstName, c.lastName, c.phone, c.email, c.address, c.notes as customerNotes
      FROM package_orders po
      LEFT JOIN customers c ON po.customerId = c.id
      WHERE po.customerId = ?
      ORDER BY po.createdAt DESC
    `)
    const orders = stmt.all(customerId) as any[]

    // Parse services from JSON string back to array
    return orders.map(order => ({
      ...order,
      services: JSON.parse(order.services || '[]'),
      customerAddress: order.customerAddress ? (() => {
        try {
          // Check if it's already an object (not a string)
          if (typeof order.customerAddress === 'object' && order.customerAddress !== null) {
            return order.customerAddress
          }
          // Try to parse as JSON string
          if (typeof order.customerAddress === 'string') {
            const trimmed = order.customerAddress.trim()
            if (trimmed.startsWith('{')) {
              return JSON.parse(trimmed)
            } else {
              return { street: trimmed }
            }
          }
          return null
        } catch (error) {
          console.warn('Failed to parse address:', order.customerAddress, error)
          return { street: typeof order.customerAddress === 'string' ? order.customerAddress : 'Unknown address' }
        }
      })() : null
    }))
  } catch (error) {
    console.error('Error getting customer package orders:', error)
    throw error
  }
}

export function updatePackageOrder(id: number, updateData: any) {
  try {
    const now = new Date().toISOString()
    const updateFields = []
    const values = []

    // Build dynamic update query
    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'id' && key !== 'createdAt') {
        updateFields.push(`${key} = ?`)

        // If updating services, convert array to JSON string
        if (key === 'services') {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
      }
    }

    if (updateFields.length === 0) {
      return { changes: 0 }
    }

    updateFields.push('updatedAt = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE package_orders
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `)

    const result = stmt.run(...values)

    return { changes: result.changes }
  } catch (error) {
    console.error('Error updating package order:', error)
    throw error
  }
}

export function deletePackageOrder(id: number) {
  try {
    const stmt = db.prepare('DELETE FROM package_orders WHERE id = ?')
    const result = stmt.run(id)

    // Return true if a row was deleted, false otherwise
    return result.changes > 0
  } catch (error) {
    console.error('Error deleting package order:', error)
    return false
  }
}

// ========== FUNCIONES PARA DIRECCIONES DE CLIENTES ==========

// Función para agregar una nueva dirección a un cliente
export function addCustomerAddress(customerId: number, addressData: {
  street: string
  apartment?: string
  city: string
  state?: string
  zipCode?: string
  country: string
  notes?: string
  isPrimary?: boolean
}) {
  try {
    // Si se marca como primaria, desmarcar las demás
    if (addressData.isPrimary) {
      db.prepare('UPDATE customer_addresses SET isPrimary = 0 WHERE customerId = ?').run(customerId)
    }

    const stmt = db.prepare(`
      INSERT INTO customer_addresses (customerId, street, apartment, city, state, zipCode, country, notes, isPrimary, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      customerId,
      addressData.street,
      addressData.apartment || null,
      addressData.city,
      addressData.state || null,
      addressData.zipCode || null,
      addressData.country,
      addressData.notes || null,
      addressData.isPrimary ? 1 : 0,
      new Date().toISOString()
    )

    return { id: result.lastInsertRowid as number, ...addressData }
  } catch (error) {
    console.error('Error adding customer address:', error)
    throw error
  }
}

// Función para obtener todas las direcciones de un cliente
export function getCustomerAddresses(customerId: number) {
  try {
    return db.prepare(`
      SELECT * FROM customer_addresses
      WHERE customerId = ?
      ORDER BY isPrimary DESC, createdAt DESC
    `).all(customerId)
  } catch (error) {
    console.error('Error getting customer addresses:', error)
    return []
  }
}

// Función para obtener la dirección primaria de un cliente
export function getPrimaryCustomerAddress(customerId: number) {
  try {
    return db.prepare(`
      SELECT * FROM customer_addresses
      WHERE customerId = ? AND isPrimary = 1
      ORDER BY createdAt DESC
      LIMIT 1
    `).get()
  } catch (error) {
    console.error('Error getting primary customer address:', error)
    return null
  }
}

// Función para actualizar una dirección de cliente
export function updateCustomerAddress(addressId: number, updateData: Partial<{
  street: string
  apartment: string
  city: string
  state: string
  zipCode: string
  country: string
  notes: string
  isPrimary: boolean
}>) {
  try {
    // Si se marca como primaria, desmarcar las demás del mismo cliente
    if (updateData.isPrimary) {
      const customerId = db.prepare('SELECT customerId FROM customer_addresses WHERE id = ?').get(addressId) as { customerId: number }
      if (customerId) {
        db.prepare('UPDATE customer_addresses SET isPrimary = 0 WHERE customerId = ?').run(customerId.customerId)
      }
    }

    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ')
    const values = Object.values(updateData)

    const stmt = db.prepare(`
      UPDATE customer_addresses
      SET ${fields}
      WHERE id = ?
    `)

    const result = stmt.run(...values, addressId)
    return result.changes > 0
  } catch (error) {
    console.error('Error updating customer address:', error)
    throw error
  }
}

// Función para eliminar una dirección de cliente
export function deleteCustomerAddress(addressId: number) {
  try {
    const stmt = db.prepare('DELETE FROM customer_addresses WHERE id = ?')
    const result = stmt.run(addressId)
    return result.changes > 0
  } catch (error) {
    console.error('Error deleting customer address:', error)
    return false
  }
}

// Función para eliminar órdenes problemáticas por número de orden
export function deleteProblematicPackageOrders(orderNumbers: string[] = []) {
  try {
    let deletedCount = 0

    // Si no se proporcionan números específicos, eliminar todas las órdenes con customerAddress como objeto
    if (orderNumbers.length === 0) {
      // Eliminar todas las órdenes que puedan tener problemas de dirección
      const stmt = db.prepare("DELETE FROM package_orders WHERE customerAddress LIKE '{%'")
      const result = stmt.run()
      deletedCount = result.changes
      console.log(`Deleted ${deletedCount} problematic package orders`)
    } else {
      // Eliminar órdenes específicas por número
      const placeholders = orderNumbers.map(() => '?').join(',')
      const stmt = db.prepare(`DELETE FROM package_orders WHERE orderNumber IN (${placeholders})`)
      const result = stmt.run(...orderNumbers)
      deletedCount = result.changes
      console.log(`Deleted ${deletedCount} specific package orders: ${orderNumbers.join(', ')}`)
    }

    return { success: true, deletedCount }
  } catch (error) {
    console.error('Error deleting problematic package orders:', error)
    return { success: false, deletedCount: 0, error: String(error) }
  }
}

// Inicializar la base de datos
initializeDatabase()
seedDefaultData()
createDefaultAgencyConfig()

export default db