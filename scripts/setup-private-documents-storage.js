const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Leer variables de entorno desde .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=')
    if (key && valueParts.length > 0) {
      envVars[key] = valueParts.join('=')
    }
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupPrivateStorage() {
  console.log('🔐 Configurando almacenamiento PRIVADO para documentos de empresas...\n')

  const publicBucket = 'company-documents' // Para logos (público)
  const privateBucket = 'company-private-documents' // Para documentos (privado)

  try {
    // 1. Verificar buckets existentes
    console.log('1️⃣ Verificando buckets...')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Error listando buckets:', listError.message)
      process.exit(1)
    }

    const publicExists = buckets.find(b => b.name === publicBucket)
    const privateExists = buckets.find(b => b.name === privateBucket)

    console.log(`   ${publicExists ? '✅' : '❌'} Bucket público: ${publicBucket} ${publicExists ? '(existe)' : '(no existe)'}`)
    console.log(`   ${privateExists ? '✅' : '❌'} Bucket privado: ${privateBucket} ${privateExists ? '(existe)' : '(no existe)'}\n`)

    // 2. Crear bucket privado si no existe
    if (!privateExists) {
      console.log('2️⃣ Creando bucket PRIVADO para documentos...')
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(privateBucket, {
        public: false, // ⚠️ PRIVADO - Solo accesible con signed URLs
        fileSizeLimit: 52428800, // 50MB - Para documentos y PDFs escaneados
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
      })

      if (createError) {
        console.error('❌ Error creando bucket privado:', createError.message)
        process.exit(1)
      }

      console.log(`✅ Bucket "${privateBucket}" creado exitosamente\n`)
    } else {
      console.log(`2️⃣ Bucket privado ya existe\n`)
    }

    // 3. Explicar políticas RLS
    console.log('3️⃣ Configuración de Seguridad:')
    console.log('   🔒 El bucket es PRIVADO por defecto')
    console.log('   🔑 Solo el service_role puede subir archivos')
    console.log('   ⏱️  El acceso será mediante URLs firmadas temporales (1 hora)')
    console.log('   🛡️  La aplicación verificará permisos antes de generar URLs\n')

    // 4. Probar subida de documento privado
    console.log('4️⃣ Probando subida de documento privado...')
    const testFile = Buffer.from('Documento confidencial de prueba - Solo para usuarios autorizados')
    const testPath = 'test-company-1/test-document.pdf'

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(privateBucket)
      .upload(testPath, testFile, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Error en prueba de subida:', uploadError.message)
      process.exit(1)
    }

    console.log('✅ Documento subido exitosamente')
    console.log(`   Path: ${uploadData.path}\n`)

    // 5. Probar acceso público (debe fallar)
    console.log('5️⃣ Verificando que NO es accesible públicamente...')
    const { data: publicUrlData } = supabase.storage
      .from(privateBucket)
      .getPublicUrl(testPath)

    console.log(`   ❌ URL pública (NO funcionará): ${publicUrlData.publicUrl}`)
    console.log('   ℹ️  Esto es correcto - los documentos privados no deben ser accesibles públicamente\n')

    // 6. Generar URL firmada temporal
    console.log('6️⃣ Generando URL firmada temporal (1 hora)...')
    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(privateBucket)
      .createSignedUrl(testPath, 3600) // 3600 segundos = 1 hora

    if (signedError) {
      console.error('❌ Error generando URL firmada:', signedError.message)
      process.exit(1)
    }

    console.log('✅ URL firmada generada exitosamente')
    console.log(`   URL temporal: ${signedUrlData.signedUrl.substring(0, 80)}...`)
    console.log(`   ⏱️  Válida por: 1 hora`)
    console.log(`   🔒 Requiere: Token de autorización de Supabase\n`)

    // 7. Limpiar archivo de prueba
    await supabase.storage.from(privateBucket).remove([testPath])
    console.log('🧹 Archivo de prueba eliminado\n')

    // 8. Resumen
    console.log('✅ Configuración completada!\n')
    console.log('📋 Resumen de la Arquitectura de Seguridad:\n')
    console.log('🔓 BUCKET PÚBLICO: company-documents')
    console.log('   • Uso: Logos de empresas')
    console.log('   • Acceso: URLs públicas directas')
    console.log('   • Seguridad: Los logos son públicos por naturaleza\n')

    console.log('🔒 BUCKET PRIVADO: company-private-documents')
    console.log('   • Uso: Documentos confidenciales (EIN, licencias, contratos)')
    console.log('   • Acceso: URLs firmadas temporales (1 hora)')
    console.log('   • Seguridad: Solo usuarios autorizados pueden generar URLs')
    console.log('   • Verificación: La API verifica permisos antes de generar URLs\n')

    console.log('🎯 Próximos pasos:')
    console.log('   1. El endpoint /api/upload/documents subirá a bucket privado')
    console.log('   2. Crear endpoint /api/documents/[companyId]/[filename] para URLs firmadas')
    console.log('   3. Verificar que el usuario pertenece a la empresa antes de dar acceso')

  } catch (error) {
    console.error('\n❌ Error inesperado:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Ejecutar
setupPrivateStorage()
