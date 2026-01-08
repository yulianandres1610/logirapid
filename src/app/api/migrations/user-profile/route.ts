import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/user-profile
 * Migration to add profile columns to users table
 */
export async function POST() {
  try {
    const results: string[] = []

    // List of columns to add
    const columns = [
      { name: 'firstname', type: 'VARCHAR(100)' },
      { name: 'lastname', type: 'VARCHAR(100)' },
      { name: 'phone', type: 'VARCHAR(50)' },
      { name: 'address', type: 'VARCHAR(255)' },
      { name: 'city', type: 'VARCHAR(100)' },
      { name: 'state', type: 'VARCHAR(100)' },
      { name: 'country', type: 'VARCHAR(100)' },
      { name: 'zipcode', type: 'VARCHAR(20)' },
      { name: 'avatar', type: 'VARCHAR(500)' },
      { name: 'lastlogin', type: 'TIMESTAMP' }
    ]

    // Add each column if not exists
    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added ${col.name} column`)
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          results.push(`${col.name} already exists`)
        } else {
          results.push(`${col.name}: ${error.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User profile migration completed',
      results
    })

  } catch (error) {
    console.error('[Migration] User profile error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current state of all profile columns
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('avatar', 'firstname', 'lastname', 'phone', 'address', 'city', 'state', 'country', 'zipcode', 'lastlogin', 'createdat')
      ORDER BY column_name
    `)

    return NextResponse.json({
      success: true,
      columns: result.rows
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
