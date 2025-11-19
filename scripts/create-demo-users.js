const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres'

async function createDemoUsers() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    console.log('🔐 Creando usuarios de demostración...\n')

    // Hash de password (bcrypt rounds: 12 como en el código original)
    const adminPassword = await bcrypt.hash('admin123', 12)

    // 1. Buscar o crear empresa CubaRapid
    let companyResult = await pool.query(
      "SELECT id, legalname FROM companies WHERE legalname ILIKE '%cubarapid%' LIMIT 1"
    )

    let cubarapidCompanyId
    if (companyResult.rows.length === 0) {
      console.log('📦 Creando empresa CubaRapid...')
      const insertCompany = await pool.query(
        `INSERT INTO companies (
          legalName, phone, address, city, country,
          walletNumber, currency, companyType, status,
          einNumber, createdAt
        ) VALUES (
          'CubaRapid LLC', '3051234567', '123 Main St', 'Miami', 'USA',
          'WALLET-' || floor(random() * 1000000)::text, 'USD', 'logistics', 'active',
          '123456789', NOW()
        ) RETURNING id`
      )
      cubarapidCompanyId = insertCompany.rows[0].id
      console.log(`✅ Empresa CubaRapid creada con ID: ${cubarapidCompanyId}\n`)
    } else {
      cubarapidCompanyId = companyResult.rows[0].id
      console.log(`✅ Empresa ${companyResult.rows[0].legalname} encontrada con ID: ${cubarapidCompanyId}\n`)
    }

    // 2. Crear/actualizar SUPER_ADMIN
    console.log('👤 Configurando SUPER_ADMIN (admin@cubarapid.com)...')

    // Buscar si ya existe
    const existingAdmin = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@cubarapid.com'"
    )

    if (existingAdmin.rows.length > 0) {
      // Actualizar contraseña
      await pool.query(
        'UPDATE users SET password = $1, role = $2, status = $3, isactive = $4 WHERE email = $5',
        [adminPassword, 'SUPER_ADMIN', 'active', true, 'admin@cubarapid.com']
      )
      console.log('✅ SUPER_ADMIN actualizado')
    } else {
      // Crear nuevo
      await pool.query(
        `INSERT INTO users (
          firstname, lastname, email, phone, password, role,
          status, isactive, createdat
        ) VALUES (
          'Administrador', 'General', 'admin@cubarapid.com', '3051234567',
          $1, 'SUPER_ADMIN', 'active', true, NOW()
        )`,
        [adminPassword]
      )
      console.log('✅ SUPER_ADMIN creado')
    }

    console.log('   Email: admin@cubarapid.com')
    console.log('   Password: admin123')
    console.log('   Rol: SUPER_ADMIN\n')

    // 3. Actualizar password del admin@logirapid.com existente también
    const logirapidAdmin = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@logirapid.com'"
    )

    if (logirapidAdmin.rows.length > 0) {
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [adminPassword, 'admin@logirapid.com']
      )
      console.log('✅ Password actualizado para admin@logirapid.com (admin123)\n')
    }

    // 4. Actualizar password de jesus@holapacks.com
    const holapacksAdmin = await pool.query(
      "SELECT id FROM users WHERE email = 'jesus@holapacks.com'"
    )

    if (holapacksAdmin.rows.length > 0) {
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [adminPassword, 'jesus@holapacks.com']
      )
      console.log('✅ Password actualizado para jesus@holapacks.com (admin123)\n')
    }

    console.log('🎉 Usuarios de demostración configurados exitosamente!')
    console.log('\n📋 Credenciales disponibles:')
    console.log('─'.repeat(60))
    console.log('SUPER_ADMIN (acceso total a todas las empresas):')
    console.log('  Email: admin@cubarapid.com')
    console.log('  Password: admin123')
    console.log('')
    console.log('SUPER_ADMIN alternativo:')
    console.log('  Email: admin@logirapid.com')
    console.log('  Password: admin123')
    console.log('')
    console.log('ADMIN de Hola Packs LLC (solo ve su empresa):')
    console.log('  Email: jesus@holapacks.com')
    console.log('  Password: admin123')
    console.log('─'.repeat(60))

  } catch (error) {
    console.error('❌ Error creando usuarios:', error.message)
    console.error(error.stack)
  } finally {
    await pool.end()
  }
}

createDemoUsers()
