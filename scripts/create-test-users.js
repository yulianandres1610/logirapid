const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres'

async function createTestUsers() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    console.log('🔐 Creando usuarios de prueba...\n')

    // Hash de passwords (bcrypt rounds: 12)
    const adminPassword = await bcrypt.hash('admin123', 12)
    const userPassword = await bcrypt.hash('usuario123', 12)

    // 1. Verificar si existe empresa LogiRapid
    const companyResult = await pool.query(
      "SELECT id, legalname FROM companies WHERE legalname = 'LogiRapid' LIMIT 1"
    )

    let logirapidCompanyId
    if (companyResult.rows.length === 0) {
      console.log('📦 Creando empresa LogiRapid...')
      const insertCompany = await pool.query(
        `INSERT INTO companies (legalname, tradename, taxid, phone, email, address, city, state, zipcode, country, status, createdat, updatedat)
         VALUES ('LogiRapid', 'LogiRapid', '123456789', '6452432403', 'info@logirapid.com', '123 Main St', 'Miami', 'FL', '33101', 'US', 'active', NOW(), NOW())
         RETURNING id`
      )
      logirapidCompanyId = insertCompany.rows[0].id
      console.log(`✅ Empresa LogiRapid creada con ID: ${logirapidCompanyId}\n`)
    } else {
      logirapidCompanyId = companyResult.rows[0].id
      console.log(`✅ Empresa LogiRapid ya existe con ID: ${logirapidCompanyId}\n`)
    }

    // 2. Crear usuario SUPER_ADMIN
    console.log('👤 Creando SUPER_ADMIN...')
    const deleteAdmin = await pool.query("DELETE FROM users WHERE email = 'admin@logirapid.com'")

    const adminInsert = await pool.query(
      `INSERT INTO users (firstname, lastname, email, phone, password, role, status, isactive, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      ['Super', 'Admin', 'admin@logirapid.com', '6452432403', adminPassword, 'SUPER_ADMIN', 'active', true]
    )

    const adminId = adminInsert.rows[0].id
    console.log(`✅ SUPER_ADMIN creado`)
    console.log(`   Email: admin@logirapid.com`)
    console.log(`   Password: admin123`)
    console.log(`   ID: ${adminId}\n`)

    // 3. Crear usuario ADMIN de empresa
    console.log('👤 Creando ADMIN de empresa...')
    const deleteUser = await pool.query("DELETE FROM users WHERE email = 'usuario@logirapid.com'")

    const userInsert = await pool.query(
      `INSERT INTO users (firstname, lastname, email, phone, password, role, status, isactive, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      ['Usuario', 'LogiRapid', 'usuario@logirapid.com', '3051234567', userPassword, 'ADMIN', 'active', true]
    )

    const userId = userInsert.rows[0].id

    // Asociar usuario con empresa
    await pool.query("DELETE FROM user_companies WHERE userid = $1", [userId])
    await pool.query(
      `INSERT INTO user_companies (userid, companyid, createdat)
       VALUES ($1, $2, NOW())`,
      [userId, logirapidCompanyId]
    )

    console.log(`✅ ADMIN de empresa creado`)
    console.log(`   Email: usuario@logirapid.com`)
    console.log(`   Password: usuario123`)
    console.log(`   ID: ${userId}`)
    console.log(`   Empresa: LogiRapid (ID: ${logirapidCompanyId})\n`)

    console.log('🎉 Usuarios de prueba creados exitosamente!')
    console.log('\n📋 Resumen de credenciales:')
    console.log('─'.repeat(50))
    console.log('SUPER_ADMIN (ve todas las empresas):')
    console.log('  Email: admin@logirapid.com')
    console.log('  Password: admin123')
    console.log('')
    console.log('ADMIN de empresa (solo ve LogiRapid):')
    console.log('  Email: usuario@logirapid.com')
    console.log('  Password: usuario123')
    console.log('─'.repeat(50))

  } catch (error) {
    console.error('❌ Error creando usuarios:', error)
    console.error(error.stack)
  } finally {
    await pool.end()
  }
}

createTestUsers()
