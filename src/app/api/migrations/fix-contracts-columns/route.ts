import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Migration to ensure market_contracts uses correct column naming
 * The correct convention is lowercase without underscores (companyid, employeeid, etc.)
 * This migration will:
 * 1. If table has underscore naming (company_id), rename to no-underscore (companyid)
 * 2. If table already has no-underscore naming, just add missing photo columns
 */
export async function POST(request: NextRequest) {
  const logs: string[] = []

  try {
    // Check if the table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'market_contracts'
      ) as exists
    `)

    if (!tableCheck.rows[0].exists) {
      return NextResponse.json({
        success: true,
        message: 'Table market_contracts does not exist. Run init-tables first.',
        logs
      })
    }

    // Get current columns
    const columnsResult = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'market_contracts'
      ORDER BY ordinal_position
    `)

    const existingColumns = columnsResult.rows.map(r => r.column_name)
    logs.push(`Existing columns: ${existingColumns.join(', ')}`)

    // Check naming conventions
    const hasNoUnderscoreNaming = existingColumns.includes('companyid') || existingColumns.includes('employeeid')
    const hasUnderscoreNaming = existingColumns.includes('company_id') || existingColumns.includes('employee_id')

    // CORRECT STATE: Table uses no-underscore naming (companyid, employeeid, etc.)
    if (hasNoUnderscoreNaming && !hasUnderscoreNaming) {
      logs.push('Table already uses correct column naming (no underscores)')

      // Just ensure photo columns exist with correct naming
      const photoColumnsToAdd = []
      if (!existingColumns.includes('photourl')) {
        photoColumnsToAdd.push('photourl TEXT')
      }
      if (!existingColumns.includes('photooriginalurl')) {
        photoColumnsToAdd.push('photooriginalurl TEXT')
      }
      if (!existingColumns.includes('photoprocessedat')) {
        photoColumnsToAdd.push('photoprocessedat TIMESTAMP')
      }

      for (const col of photoColumnsToAdd) {
        try {
          await db.query(`ALTER TABLE market_contracts ADD COLUMN IF NOT EXISTS ${col}`)
          logs.push(`Added column: ${col}`)
        } catch (e: any) {
          logs.push(`Could not add ${col}: ${e.message}`)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Column naming is correct, photo columns checked',
        logs
      })
    }

    // NEEDS MIGRATION: Table has underscore naming, needs to be changed to no-underscore
    if (hasUnderscoreNaming) {
      logs.push('Detected underscore column naming, need to rename to no-underscore format')

      // Define column renames: old (underscore) -> new (no underscore)
      const columnRenames = [
        ['company_id', 'companyid'],
        ['employee_id', 'employeeid'],
        ['contract_number', 'contractnumber'],
        ['contract_type', 'contracttype'],
        ['start_date', 'startdate'],
        ['end_date', 'enddate'],
        ['pay_type', 'paytype'],
        ['pay_rate', 'payrate'],
        ['commission_rate', 'commissionrate'],
        ['department_id', 'departmentid'],
        ['schedule_id', 'scheduleid'],
        ['termination_date', 'terminationdate'],
        ['termination_reason', 'terminationreason'],
        ['photo_url', 'photourl'],
        ['photo_original_url', 'photooriginalurl'],
        ['photo_processed_at', 'photoprocessedat'],
        ['created_at', 'createdat'],
        ['updated_at', 'updatedat']
      ]

      for (const [oldName, newName] of columnRenames) {
        if (existingColumns.includes(oldName)) {
          try {
            await db.query(`ALTER TABLE market_contracts RENAME COLUMN ${oldName} TO ${newName}`)
            logs.push(`Renamed ${oldName} to ${newName}`)
          } catch (e: any) {
            logs.push(`Could not rename ${oldName}: ${e.message}`)
          }
        }
      }

      // Drop old indexes and create new ones
      try {
        await db.query(`DROP INDEX IF EXISTS idx_contracts_employee`)
        await db.query(`DROP INDEX IF EXISTS idx_contracts_company`)
        logs.push('Dropped old indexes')
      } catch (e: any) {
        logs.push(`Could not drop indexes: ${e.message}`)
      }

      try {
        await db.query(`CREATE INDEX IF NOT EXISTS idx_contracts_employee ON market_contracts(employeeid)`)
        await db.query(`CREATE INDEX IF NOT EXISTS idx_contracts_company ON market_contracts(companyid)`)
        logs.push('Created new indexes with correct column names')
      } catch (e: any) {
        logs.push(`Could not create indexes: ${e.message}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Columns renamed successfully to no-underscore format',
        logs
      })
    }

    // Table exists but has neither naming - something is wrong
    return NextResponse.json({
      success: false,
      error: 'Table exists but column naming is inconsistent',
      logs
    }, { status: 500 })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      logs
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check current state of columns
    const columnsResult = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_contracts'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      columns: columnsResult.rows,
      hasNoUnderscoreNaming: columnsResult.rows.some(r => r.column_name === 'companyid'),
      hasUnderscoreNaming: columnsResult.rows.some(r => r.column_name === 'company_id')
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
