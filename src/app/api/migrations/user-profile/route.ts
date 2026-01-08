import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/user-profile
 * Migration to add avatar column to users table
 */
export async function POST() {
  try {
    const results: string[] = []

    // Add avatar column to users table
    try {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)
      `)
      results.push('Added avatar column to users table')
    } catch (error: any) {
      results.push(`Avatar column: ${error.message}`)
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
    // Check current state
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('avatar', 'firstname', 'lastname', 'phone', 'address', 'city', 'state', 'country', 'zipcode')
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
