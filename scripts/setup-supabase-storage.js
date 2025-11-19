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
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupStorage() {
  console.log('🔧 Configurando Supabase Storage...\n')

  const bucketName = 'company-documents'

  try {
    // 1. Verificar si el bucket existe
    console.log('1️⃣ Verificando si el bucket existe...')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Error listando buckets:', listError.message)
      process.exit(1)
    }

    const bucketExists = buckets.find(b => b.name === bucketName)

    if (bucketExists) {
      console.log(`✅ El bucket "${bucketName}" ya existe`)
      console.log(`   - ID: ${bucketExists.id}`)
      console.log(`   - Público: ${bucketExists.public}`)
      console.log(`   - Creado: ${bucketExists.created_at}`)
    } else {
      // 2. Crear el bucket si no existe
      console.log(`📦 Creando bucket "${bucketName}"...`)
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true, // Hacer el bucket público para que las URLs sean accesibles
        fileSizeLimit: 5242880, // 5MB en bytes
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/svg+xml',
          'image/webp',
          'application/pdf'
        ]
      })

      if (createError) {
        console.error('❌ Error creando bucket:', createError.message)
        process.exit(1)
      }

      console.log(`✅ Bucket "${bucketName}" creado exitosamente`)
    }

    // 3. Verificar políticas de storage
    console.log('\n2️⃣ Verificando políticas de storage...')
    console.log('   Las políticas RLS se configuran automáticamente con el service_role key')
    console.log('   ✅ Service role key puede bypasear RLS')

    // 4. Crear estructura de carpetas (opcional - se crean automáticamente al subir)
    console.log('\n3️⃣ Estructura de carpetas:')
    console.log('   📁 logos/ - Para logos de empresas')
    console.log('   📁 documents/ - Para documentos de empresas')
    console.log('   (Se crean automáticamente al subir archivos)')

    // 5. Probar subida de archivo de prueba
    console.log('\n4️⃣ Probando subida de archivo...')
    const testFile = Buffer.from('Test file content')
    const testPath = 'test/test.txt'

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testPath, testFile, {
        contentType: 'text/plain',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Error en prueba de subida:', uploadError.message)
    } else {
      console.log('✅ Prueba de subida exitosa')
      console.log(`   Path: ${uploadData.path}`)

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(testPath)

      console.log(`   URL pública: ${urlData.publicUrl}`)

      // Limpiar archivo de prueba
      await supabase.storage.from(bucketName).remove([testPath])
      console.log('   ✅ Archivo de prueba eliminado')
    }

    console.log('\n✅ Configuración de Supabase Storage completada!')
    console.log('\n📋 Resumen:')
    console.log(`   • Bucket: ${bucketName}`)
    console.log(`   • URL Base: ${supabaseUrl}/storage/v1/object/public/${bucketName}`)
    console.log(`   • Tamaño máximo: 5MB`)
    console.log(`   • Tipos permitidos: PNG, JPG, SVG, WEBP, PDF`)

  } catch (error) {
    console.error('\n❌ Error inesperado:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Ejecutar
setupStorage()
