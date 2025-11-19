const FormData = require('form-data')
const fs = require('fs')
const path = require('path')
const https = require('https')

async function testLogoUpload() {
  console.log('🧪 Probando carga de logo a Supabase Storage...\n')

  try {
    // Crear un archivo de imagen de prueba (PNG simple de 1x1 pixel rojo)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width & height: 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // Color type: RGB
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
      0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
      0x44, 0xAE, 0x42, 0x60, 0x82
    ])

    const testImagePath = path.join(__dirname, 'test-logo.png')
    fs.writeFileSync(testImagePath, testImageBuffer)
    console.log('✅ Archivo de prueba creado: test-logo.png\n')

    // Crear FormData
    const form = new FormData()
    form.append('logo', fs.createReadStream(testImagePath), {
      filename: 'test-logo.png',
      contentType: 'image/png'
    })

    // Obtener las opciones de la petición
    const formHeaders = form.getHeaders()

    // Hacer la petición al endpoint local
    console.log('📤 Enviando archivo a /api/upload/logo...\n')

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/upload/logo',
      method: 'POST',
      headers: formHeaders
    }

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          })
        })
      })

      req.on('error', (error) => {
        // Si falla con HTTPS, probar con HTTP
        console.log('⚠️ HTTPS falló, intentando con HTTP...')
        const http = require('http')
        const httpReq = http.request({ ...options, protocol: 'http:' }, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            })
          })
        })
        httpReq.on('error', reject)
        form.pipe(httpReq)
      })

      form.pipe(req)
    })

    // Limpiar archivo de prueba
    fs.unlinkSync(testImagePath)
    console.log('✅ Archivo de prueba eliminado\n')

    // Analizar respuesta
    console.log('📋 Respuesta del servidor:')
    console.log(`   Status: ${response.statusCode}`)
    console.log(`   Content-Type: ${response.headers['content-type']}\n`)

    let responseData
    try {
      responseData = JSON.parse(response.body)
    } catch (e) {
      console.error('❌ Error parseando respuesta JSON:')
      console.error('   Body:', response.body.substring(0, 200))
      process.exit(1)
    }

    if (response.statusCode === 200 && responseData.success) {
      console.log('✅ ¡Carga exitosa!')
      console.log('\n📊 Detalles:')
      console.log(`   ✓ URL: ${responseData.url}`)
      console.log(`   ✓ Nombre: ${responseData.fileName}`)
      console.log(`   ✓ Mensaje: ${responseData.message}`)

      console.log('\n🎉 La integración con Supabase Storage está funcionando correctamente!')
      console.log('   Puedes usar esta URL en tu navegador para ver el archivo subido.')
    } else {
      console.error('❌ Error en la carga:')
      console.error(`   Status: ${response.statusCode}`)
      console.error(`   Error: ${responseData.error}`)
      console.error(`   Response:`, JSON.stringify(responseData, null, 2))
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Ejecutar
testLogoUpload()
