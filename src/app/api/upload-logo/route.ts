import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validar tipo de archivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de archivo no válido. Use PNG, JPG, SVG o WEBP' },
        { status: 400 }
      )
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'El archivo es demasiado grande. Máximo 2MB' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Crear directorio de uploads si no existe
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `logo-${timestamp}.${extension}`
    const filepath = path.join(uploadDir, filename)

    // Guardar archivo
    await writeFile(filepath, buffer)

    // Devolver URL pública
    const publicUrl = `/uploads/logos/${filename}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: 'Logo subido exitosamente'
    })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al subir el logo' },
      { status: 500 }
    )
  }
}
