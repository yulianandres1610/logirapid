import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import * as storageAdapter from '@/lib/storage-adapter'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

const BUCKET_NAME = 'company-private-documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * POST /api/market/fixed-assets/upload-image
 * Upload an image for a fixed asset (FormData with 'image' file)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se proporcionó imagen' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de archivo no permitido. Solo JPG, PNG y WebP'
      }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'La imagen excede el tamaño máximo de 10MB'
      }, { status: 400 })
    }

    // Delete old image if provided
    const oldImageUrl = formData.get('oldImageUrl') as string | null
    if (oldImageUrl) {
      try {
        const pathMatch = oldImageUrl.match(/company-\d+\/fixed-assets\/.+/)
        if (pathMatch) {
          await storageAdapter.remove(BUCKET_NAME, [pathMatch[0]])
        }
      } catch {
        // Ignore deletion errors
      }
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const storagePath = `company-${payload.companyId}/fixed-assets/${timestamp}-${randomSuffix}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const uploadResult = await storageAdapter.upload(BUCKET_NAME, storagePath, Buffer.from(arrayBuffer), {
      contentType: file.type,
      upsert: true
    })

    if (!uploadResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Error al subir imagen al almacenamiento'
      }, { status: 500 })
    }

    const publicUrl = storageAdapter.getPublicUrl(BUCKET_NAME, storagePath)

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: publicUrl,
        storagePath
      }
    })

  } catch (error) {
    console.error('[Fixed Assets Upload] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir imagen'
    }, { status: 500 })
  }
}
