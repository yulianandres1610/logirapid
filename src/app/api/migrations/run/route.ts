import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import fs from 'fs'
import path from 'path'

// Only allow SUPER_ADMIN to run migrations
export async function POST(request: NextRequest) {
  try {
    const { migrationFiles } = await request.json()

    if (!migrationFiles || !Array.isArray(migrationFiles)) {
      return NextResponse.json({
        success: false,
        error: 'migrationFiles array required'
      }, { status: 400 })
    }

    const results: { file: string; success: boolean; error?: string }[] = []

    for (const file of migrationFiles) {
      try {
        const migrationPath = path.join(process.cwd(), 'migrations', file)

        if (!fs.existsSync(migrationPath)) {
          results.push({ file, success: false, error: 'File not found' })
          continue
        }

        const sql = fs.readFileSync(migrationPath, 'utf8')

        // Execute the migration
        await db.query(sql)

        results.push({ file, success: true })
        console.log(`[Migration] Successfully executed: ${file}`)

      } catch (err: any) {
        console.error(`[Migration] Error executing ${file}:`, err)
        results.push({
          file,
          success: false,
          error: err.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: { results }
    })

  } catch (error: any) {
    console.error('[Migration API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
