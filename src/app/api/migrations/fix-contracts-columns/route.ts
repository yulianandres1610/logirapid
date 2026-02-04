import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Migration to fix market_contracts column naming
 * Changes columns from camelCase/no-underscore to snake_case
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

    // Check if we need to rename columns (old naming without underscores)
    const hasOldNaming = existingColumns.includes('companyid') || existingColumns.includes('employeeid')
    const hasNewNaming = existingColumns.includes('company_id') || existingColumns.includes('employee_id')

    if (hasNewNaming && !hasOldNaming) {
      logs.push('Table already uses correct column naming with underscores')

      // Still check for photo columns that might need fixing
      const photoColumnsToAdd = []
      if (!existingColumns.includes('photo_url') && !existingColumns.includes('photourl')) {
        photoColumnsToAdd.push('photo_url TEXT')
      }
      if (!existingColumns.includes('photo_original_url') && !existingColumns.includes('photooriginalurl')) {
        photoColumnsToAdd.push('photo_original_url TEXT')
      }
      if (!existingColumns.includes('photo_processed_at') && !existingColumns.includes('photoprocessedat')) {
        photoColumnsToAdd.push('photo_processed_at TIMESTAMP')
      }

      for (const col of photoColumnsToAdd) {
        try {
          await db.query(`ALTER TABLE market_contracts ADD COLUMN IF NOT EXISTS ${col}`)
          logs.push(`Added column: ${col}`)
        } catch (e: any) {
          logs.push(`Could not add ${col}: ${e.message}`)
        }
      }

      // Rename photo columns if they exist with old naming
      if (existingColumns.includes('photourl')) {
        await db.query(`ALTER TABLE market_contracts RENAME COLUMN photourl TO photo_url`)
        logs.push('Renamed photourl to photo_url')
      }
      if (existingColumns.includes('photooriginalurl')) {
        await db.query(`ALTER TABLE market_contracts RENAME COLUMN photooriginalurl TO photo_original_url`)
        logs.push('Renamed photooriginalurl to photo_original_url')
      }
      if (existingColumns.includes('photoprocessedat')) {
        await db.query(`ALTER TABLE market_contracts RENAME COLUMN photoprocessedat TO photo_processed_at`)
        logs.push('Renamed photoprocessedat to photo_processed_at')
      }

      return NextResponse.json({
        success: true,
        message: 'Column naming is correct, photo columns checked',
        logs
      })
    }

    if (hasOldNaming) {
      logs.push('Detected old column naming, need to rename columns')

      // Define column renames: old -> new
      const columnRenames = [
        ['companyid', 'company_id'],
        ['employeeid', 'employee_id'],
        ['contractnumber', 'contract_number'],
        ['contracttype', 'contract_type'],
        ['startdate', 'start_date'],
        ['enddate', 'end_date'],
        ['paytype', 'pay_type'],
        ['payrate', 'pay_rate'],
        ['commissionrate', 'commission_rate'],
        ['departmentid', 'department_id'],
        ['scheduleid', 'schedule_id'],
        ['terminationdate', 'termination_date'],
        ['terminationreason', 'termination_reason'],
        ['photourl', 'photo_url'],
        ['photooriginalurl', 'photo_original_url'],
        ['photoprocessedat', 'photo_processed_at'],
        ['createdat', 'created_at'],
        ['updatedat', 'updated_at']
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
        await db.query(`CREATE INDEX IF NOT EXISTS idx_contracts_employee ON market_contracts(employee_id)`)
        await db.query(`CREATE INDEX IF NOT EXISTS idx_contracts_company ON market_contracts(company_id)`)
        logs.push('Created new indexes with correct column names')
      } catch (e: any) {
        logs.push(`Could not create indexes: ${e.message}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Columns renamed successfully',
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
      hasUnderscoreNaming: columnsResult.rows.some(r => r.column_name === 'company_id'),
      hasOldNaming: columnsResult.rows.some(r => r.column_name === 'companyid')
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
