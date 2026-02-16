import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/market/door-security/init-tables
 * Initialize door security tables in the database
 * Only SUPER_ADMIN or ADMIN can initialize tables
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN or ADMIN can initialize tables
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para esta operación'
      }, { status: 403 })
    }

    const results: string[] = []

    // Create market_door_kiosks table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_door_kiosks (
          id SERIAL PRIMARY KEY,
          companyid INTEGER REFERENCES companies(id),
          name VARCHAR(100) NOT NULL,
          location VARCHAR(200),
          deviceid VARCHAR(100) UNIQUE,
          warehouseid INTEGER REFERENCES market_warehouses(id),
          isactive BOOLEAN DEFAULT true,
          lastping TIMESTAMP,
          settings JSONB DEFAULT '{}',
          createdat TIMESTAMP DEFAULT NOW(),
          updatedat TIMESTAMP
        )
      `)
      results.push('market_door_kiosks created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        results.push('market_door_kiosks already exists')
      } else {
        results.push(`market_door_kiosks error: ${error.message}`)
      }
    }

    // Create index on companyid
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_door_kiosks_companyid
        ON market_door_kiosks(companyid)
      `)
      results.push('index on companyid created')
    } catch {
      results.push('index on companyid already exists or failed')
    }

    // Create market_visitors table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_visitors (
          id SERIAL PRIMARY KEY,
          companyid INTEGER REFERENCES companies(id),
          fullname VARCHAR(200) NOT NULL,
          idtype VARCHAR(50),
          idnumber VARCHAR(50) NOT NULL,
          dateofbirth DATE,
          address TEXT,
          nationality VARCHAR(100),
          gender VARCHAR(20),
          idphotourl TEXT,
          firstvisit TIMESTAMP DEFAULT NOW(),
          lastvisit TIMESTAMP,
          totalvisits INTEGER DEFAULT 0,
          createdat TIMESTAMP DEFAULT NOW(),
          updatedat TIMESTAMP,
          UNIQUE(companyid, idnumber)
        )
      `)
      results.push('market_visitors created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        results.push('market_visitors already exists')
      } else {
        results.push(`market_visitors error: ${error.message}`)
      }
    }

    // Create indexes for visitors
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitors_companyid
        ON market_visitors(companyid)
      `)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitors_idnumber
        ON market_visitors(idnumber)
      `)
      results.push('visitor indexes created')
    } catch {
      results.push('visitor indexes already exist or failed')
    }

    // Create market_visitor_logs table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_visitor_logs (
          id SERIAL PRIMARY KEY,
          companyid INTEGER REFERENCES companies(id),
          visitorid INTEGER REFERENCES market_visitors(id),
          kioskid INTEGER REFERENCES market_door_kiosks(id),
          entrytime TIMESTAMP NOT NULL,
          exittime TIMESTAMP,
          visitpurpose VARCHAR(100),
          visitnotes TEXT,
          hostemployeeid INTEGER REFERENCES market_employees(id),
          haspendinginvoices BOOLEAN DEFAULT false,
          invoicesvalidated BOOLEAN DEFAULT false,
          validatedat TIMESTAMP,
          validatedby INTEGER,
          status VARCHAR(20) DEFAULT 'active',
          createdat TIMESTAMP DEFAULT NOW()
        )
      `)
      results.push('market_visitor_logs created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        results.push('market_visitor_logs already exists')
      } else {
        results.push(`market_visitor_logs error: ${error.message}`)
      }
    }

    // Create indexes for visitor logs
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitor_logs_companyid
        ON market_visitor_logs(companyid)
      `)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitor_logs_visitorid
        ON market_visitor_logs(visitorid)
      `)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitor_logs_status
        ON market_visitor_logs(status)
      `)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitor_logs_entrytime
        ON market_visitor_logs(entrytime)
      `)
      results.push('visitor_logs indexes created')
    } catch {
      results.push('visitor_logs indexes already exist or failed')
    }

    // Create market_visitor_invoice_validations table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_visitor_invoice_validations (
          id SERIAL PRIMARY KEY,
          visitorlogid INTEGER REFERENCES market_visitor_logs(id),
          documenttype VARCHAR(20) NOT NULL,
          documentid INTEGER,
          documentnumber VARCHAR(50),
          totalamount DECIMAL(12,2),
          currency VARCHAR(10),
          validated BOOLEAN DEFAULT false,
          validatedat TIMESTAMP,
          validatedby INTEGER REFERENCES market_employees(id),
          notes TEXT,
          createdat TIMESTAMP DEFAULT NOW()
        )
      `)
      results.push('market_visitor_invoice_validations created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        results.push('market_visitor_invoice_validations already exists')
      } else {
        results.push(`market_visitor_invoice_validations error: ${error.message}`)
      }
    }

    // Create index for invoice validations
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_visitor_invoice_validations_visitorlogid
        ON market_visitor_invoice_validations(visitorlogid)
      `)
      results.push('invoice_validations index created')
    } catch {
      results.push('invoice_validations index already exists or failed')
    }

    // Create market_door_guards table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_door_guards (
          id SERIAL PRIMARY KEY,
          companyid INTEGER REFERENCES companies(id),
          employeeid INTEGER REFERENCES market_employees(id),
          kioskid INTEGER REFERENCES market_door_kiosks(id),
          isactive BOOLEAN DEFAULT true,
          createdat TIMESTAMP DEFAULT NOW(),
          UNIQUE(companyid, employeeid, kioskid)
        )
      `)
      results.push('market_door_guards created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        results.push('market_door_guards already exists')
      } else {
        results.push(`market_door_guards error: ${error.message}`)
      }
    }

    // Create indexes for guards
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_door_guards_companyid
        ON market_door_guards(companyid)
      `)
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_market_door_guards_employeeid
        ON market_door_guards(employeeid)
      `)
      results.push('guards indexes created')
    } catch {
      results.push('guards indexes already exist or failed')
    }

    // Add door_security_enabled column to market_company_settings if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE market_company_settings
        ADD COLUMN IF NOT EXISTS door_security_enabled BOOLEAN DEFAULT false
      `)
      await db.query(`
        ALTER TABLE market_company_settings
        ADD COLUMN IF NOT EXISTS door_require_invoice_validation BOOLEAN DEFAULT true
      `)
      results.push('market_company_settings columns added')
    } catch (error: any) {
      results.push(`settings columns: ${error.message}`)
    }

    console.log('[Door Security Init] Tables initialized:', results)

    return NextResponse.json({
      success: true,
      message: 'Tablas de seguridad de puerta inicializadas',
      results
    })

  } catch (error) {
    console.error('[Door Security Init] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al inicializar tablas'
    }, { status: 500 })
  }
}
