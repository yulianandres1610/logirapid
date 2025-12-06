import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Wallet System Migration
 *
 * This migration adds wallet_number and wallet_balance fields to:
 * - users table
 * - customers table
 *
 * Then generates wallet numbers for all existing records
 */

// Generate a unique 16-digit wallet number starting with 2026
function generateWalletNumber(): string {
  const timestamp = Date.now().toString().slice(-12)
  return `2026${timestamp}`
}

// Add small delay to ensure unique timestamps
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 Starting wallet system migration...')

    // Step 1: Add columns to users table
    console.log('📦 Adding wallet columns to users table...')
    try {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS wallet_number VARCHAR(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(15,2) DEFAULT 0.00
      `)
      console.log('✅ Users table updated')
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.log('⚠️ Users table wallet columns may already exist:', error.message)
      }
    }

    // Step 2: Add columns to customers table
    console.log('📦 Adding wallet columns to customers table...')
    try {
      await db.query(`
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS wallet_number VARCHAR(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(15,2) DEFAULT 0.00
      `)
      console.log('✅ Customers table updated')
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.log('⚠️ Customers table wallet columns may already exist:', error.message)
      }
    }

    // Step 3: Create indexes
    console.log('📦 Creating indexes...')
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_users_wallet_number ON users(wallet_number);
        CREATE INDEX IF NOT EXISTS idx_customers_wallet_number ON customers(wallet_number);
      `)
      console.log('✅ Indexes created')
    } catch (error: any) {
      console.log('⚠️ Index creation note:', error.message)
    }

    // Step 4: Count records needing wallet numbers
    const usersWithoutWallet = await db.query(`
      SELECT COUNT(*) as count FROM users WHERE wallet_number IS NULL
    `)
    const customersWithoutWallet = await db.query(`
      SELECT COUNT(*) as count FROM customers WHERE wallet_number IS NULL
    `)

    const usersCount = parseInt(usersWithoutWallet.rows[0]?.count || '0')
    const customersCount = parseInt(customersWithoutWallet.rows[0]?.count || '0')

    console.log(`📊 Users without wallet: ${usersCount}`)
    console.log(`📊 Customers without wallet: ${customersCount}`)

    return NextResponse.json({
      success: true,
      message: 'Migration completed. Use POST to generate wallet numbers for existing records.',
      data: {
        tablesUpdated: ['users', 'customers'],
        usersWithoutWallet: usersCount,
        customersWithoutWallet: customersCount
      }
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Generating wallet numbers for existing records...')

    let usersUpdated = 0
    let customersUpdated = 0
    let errors: string[] = []

    // Step 1: Generate wallet numbers for users without one
    console.log('👥 Processing users...')
    const usersWithoutWallet = await db.query(`
      SELECT id, firstname, lastname, email FROM users WHERE wallet_number IS NULL
    `)

    for (const user of usersWithoutWallet.rows) {
      try {
        const walletNumber = generateWalletNumber()
        await db.query(`
          UPDATE users SET wallet_number = $1, wallet_balance = 0.00 WHERE id = $2
        `, [walletNumber, user.id])
        usersUpdated++
        console.log(`✅ User ${user.id} (${user.email}): ${walletNumber}`)
        await delay(3) // Small delay to ensure unique timestamps
      } catch (error: any) {
        const errorMsg = `User ${user.id}: ${error.message}`
        errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    // Step 2: Generate wallet numbers for customers without one
    console.log('👤 Processing customers...')
    const customersWithoutWallet = await db.query(`
      SELECT id, firstname, lastname, phone FROM customers WHERE wallet_number IS NULL
    `)

    for (const customer of customersWithoutWallet.rows) {
      try {
        const walletNumber = generateWalletNumber()
        await db.query(`
          UPDATE customers SET wallet_number = $1, wallet_balance = 0.00 WHERE id = $2
        `, [walletNumber, customer.id])
        customersUpdated++
        console.log(`✅ Customer ${customer.id} (${customer.firstname} ${customer.lastname}): ${walletNumber}`)
        await delay(3) // Small delay to ensure unique timestamps
      } catch (error: any) {
        const errorMsg = `Customer ${customer.id}: ${error.message}`
        errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    console.log(`🎉 Wallet generation complete!`)
    console.log(`   Users updated: ${usersUpdated}`)
    console.log(`   Customers updated: ${customersUpdated}`)
    console.log(`   Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'Wallet numbers generated successfully',
      data: {
        usersUpdated,
        customersUpdated,
        totalUpdated: usersUpdated + customersUpdated,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('❌ Wallet generation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Wallet generation failed'
    }, { status: 500 })
  }
}
