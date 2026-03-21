import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/print-agent/version
 *
 * Returns the current expected agent version.
 */
export async function GET() {
  return NextResponse.json({ version: '1.2.1' })
}
