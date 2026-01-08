import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ error: 'No token', step: 1 })
    }

    let payload: any
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret)
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token', step: 2, details: String(e) })
    }

    const userId = payload.userId

    // Simple query first
    try {
      const simpleResult = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [userId])

      if (simpleResult.rows.length === 0) {
        // Check if user exists at all
        const allUsers = await db.query('SELECT id, email FROM users LIMIT 5')
        return NextResponse.json({
          error: 'User not found',
          step: 3,
          userId,
          tokenPayload: payload,
          sampleUsers: allUsers.rows
        })
      }

      return NextResponse.json({
        success: true,
        step: 4,
        userId,
        user: simpleResult.rows[0],
        tokenPayload: payload
      })
    } catch (dbError) {
      return NextResponse.json({
        error: 'DB query failed',
        step: 5,
        details: String(dbError),
        userId
      })
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Unknown error',
      step: 0,
      details: String(error)
    })
  }
}
