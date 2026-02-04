import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // Create HR tables

    // 1. Departments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_departments (
        id SERIAL PRIMARY KEY,
        companyid INTEGER REFERENCES companies(id),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        description TEXT,
        managerid INTEGER,
        isactive BOOLEAN DEFAULT true,
        createdat TIMESTAMP DEFAULT NOW(),
        updatedat TIMESTAMP DEFAULT NOW()
      )
    `)

    // 2. Schedules table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_schedules (
        id SERIAL PRIMARY KEY,
        companyid INTEGER REFERENCES companies(id),
        name VARCHAR(100) NOT NULL,
        weeklyhours DECIMAL(5,2) NOT NULL,
        isflexible BOOLEAN DEFAULT false,
        isactive BOOLEAN DEFAULT true,
        createdat TIMESTAMP DEFAULT NOW(),
        updatedat TIMESTAMP DEFAULT NOW()
      )
    `)

    // 3. Schedule days table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_schedule_days (
        id SERIAL PRIMARY KEY,
        scheduleid INTEGER REFERENCES market_schedules(id) ON DELETE CASCADE,
        dayofweek INTEGER NOT NULL,
        starttime TIME,
        endtime TIME,
        breakminutes INTEGER DEFAULT 60,
        isworkday BOOLEAN DEFAULT true
      )
    `)

    // 4. Contracts table (using lowercase column names without underscores for consistency)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_contracts (
        id SERIAL PRIMARY KEY,
        companyid INTEGER REFERENCES companies(id),
        employeeid INTEGER REFERENCES market_employees(id) ON DELETE CASCADE,
        contractnumber VARCHAR(50),
        contracttype VARCHAR(50) NOT NULL,
        startdate DATE NOT NULL,
        enddate DATE,
        paytype VARCHAR(20) NOT NULL,
        payrate DECIMAL(12,4) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        commissionrate DECIMAL(5,2) DEFAULT 0,
        departmentid INTEGER REFERENCES market_departments(id),
        scheduleid INTEGER REFERENCES market_schedules(id),
        position VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active',
        terminationdate DATE,
        terminationreason TEXT,
        notes TEXT,
        photourl TEXT,
        photooriginalurl TEXT,
        photoprocessedat TIMESTAMP,
        createdat TIMESTAMP DEFAULT NOW(),
        updatedat TIMESTAMP DEFAULT NOW()
      )
    `)

    // 5. Attendance table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_attendance (
        id SERIAL PRIMARY KEY,
        companyid INTEGER REFERENCES companies(id),
        employeeid INTEGER REFERENCES market_employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        checkin TIMESTAMP,
        checkout TIMESTAMP,
        checkinmethod VARCHAR(20),
        checkoutmethod VARCHAR(20),
        checkinphotourl TEXT,
        checkoutphotourl TEXT,
        workedhours DECIMAL(5,2),
        overtimehours DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'present',
        lateminutes INTEGER DEFAULT 0,
        earlydepartureminutes INTEGER DEFAULT 0,
        notes TEXT,
        approvedby INTEGER REFERENCES market_employees(id),
        createdat TIMESTAMP DEFAULT NOW(),
        updatedat TIMESTAMP DEFAULT NOW(),
        UNIQUE(employeeid, date)
      )
    `)

    // 6. Attendance kiosks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_attendance_kiosks (
        id SERIAL PRIMARY KEY,
        companyid INTEGER REFERENCES companies(id),
        name VARCHAR(100) NOT NULL,
        location VARCHAR(200),
        deviceid VARCHAR(100) UNIQUE,
        warehouseid INTEGER REFERENCES market_warehouses(id),
        isactive BOOLEAN DEFAULT true,
        lastping TIMESTAMP,
        settings JSONB,
        createdat TIMESTAMP DEFAULT NOW()
      )
    `)

    // 7. Employee faces table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_employee_faces (
        id SERIAL PRIMARY KEY,
        employeeid INTEGER REFERENCES market_employees(id) ON DELETE CASCADE,
        faceencoding TEXT NOT NULL,
        photourl TEXT,
        isprimary BOOLEAN DEFAULT true,
        createdat TIMESTAMP DEFAULT NOW(),
        UNIQUE(employeeid, isprimary)
      )
    `)

    // Add columns to market_employees if not exists
    try {
      await db.query(`ALTER TABLE market_employees ADD COLUMN IF NOT EXISTS departmentid INTEGER REFERENCES market_departments(id)`)
    } catch (e) {
      console.log('Column departmentid may already exist')
    }

    try {
      await db.query(`ALTER TABLE market_employees ADD COLUMN IF NOT EXISTS hasfaceregistered BOOLEAN DEFAULT false`)
    } catch (e) {
      console.log('Column hasfaceregistered may already exist')
    }

    // Add photo columns to market_contracts if not exists (using lowercase naming without underscores)
    try {
      await db.query(`ALTER TABLE market_contracts ADD COLUMN IF NOT EXISTS photourl TEXT`)
    } catch (e) {
      console.log('Column photourl may already exist')
    }

    try {
      await db.query(`ALTER TABLE market_contracts ADD COLUMN IF NOT EXISTS photooriginalurl TEXT`)
    } catch (e) {
      console.log('Column photooriginalurl may already exist')
    }

    try {
      await db.query(`ALTER TABLE market_contracts ADD COLUMN IF NOT EXISTS photoprocessedat TIMESTAMP`)
    } catch (e) {
      console.log('Column photoprocessedat may already exist')
    }

    // Create indexes for better performance (using correct column names without underscores)
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON market_attendance(employeeid, date)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON market_attendance(companyid, date)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_contracts_employee ON market_contracts(employeeid)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_contracts_company ON market_contracts(companyid)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_departments_company ON market_departments(companyid)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_schedules_company ON market_schedules(companyid)`)
    } catch (e) {
      console.log('Some indexes may already exist')
    }

    return NextResponse.json({
      success: true,
      message: 'HR tables created successfully'
    })

  } catch (error: any) {
    console.error('Error creating HR tables:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return info about the HR tables
  try {
    const tables = [
      'market_departments',
      'market_schedules',
      'market_schedule_days',
      'market_contracts',
      'market_attendance',
      'market_attendance_kiosks',
      'market_employee_faces'
    ]

    const results: Record<string, boolean> = {}

    for (const table of tables) {
      try {
        await db.query(`SELECT 1 FROM ${table} LIMIT 1`)
        results[table] = true
      } catch {
        results[table] = false
      }
    }

    return NextResponse.json({
      success: true,
      tables: results
    })

  } catch (error: any) {
    console.error('Error checking HR tables:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
