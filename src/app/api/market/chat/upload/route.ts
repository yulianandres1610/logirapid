import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import * as storageAdapter from '@/lib/storage-adapter'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyType?: string
}

const BUCKET_NAME = 'company-private-documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * POST /api/market/chat/upload
 * Upload a file (image, audio, document) for chat
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
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    if (payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const messageType = formData.get('messageType') as string || 'file'

    if (!file) {
      return NextResponse.json({ success: false, error: 'Archivo es requerido' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'El archivo excede el tamaño máximo de 10MB'
      }, { status: 400 })
    }

    // Validate file type based on messageType
    const allowedTypes: Record<string, string[]> = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      audio: ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav'],
      file: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
      ]
    }

    if (allowedTypes[messageType] && !allowedTypes[messageType].includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de archivo no permitido para ${messageType}`
      }, { status: 400 })
    }

    // Generate unique file path
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileExt = file.name.split('.').pop() || 'bin'
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50)
    const storagePath = `chat/${payload.companyId}/${messageType}/${timestamp}_${randomStr}_${sanitizedName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Storage
    const uploadResult = await storageAdapter.upload(BUCKET_NAME, storagePath, buffer, {
      contentType: file.type,
      upsert: false
    })

    if (!uploadResult.success) {
      console.error('[Chat Upload] Upload error:', uploadResult.error)
      return NextResponse.json({
        success: false,
        error: 'Error al subir archivo'
      }, { status: 500 })
    }

    // Generate signed URL (1 hour expiry for immediate use)
    let signedUrl: string | null = null
    try {
      signedUrl = await storageAdapter.createSignedUrl(BUCKET_NAME, storagePath, 3600)
    } catch (signedUrlError) {
      console.error('[Chat Upload] Signed URL error:', signedUrlError)
    }

    return NextResponse.json({
      success: true,
      data: {
        fileUrl: storagePath,
        signedUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        messageType
      }
    })

  } catch (error) {
    console.error('[Chat Upload] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir archivo'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/chat/upload
 * Get a signed URL for a chat file
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    if (payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fileUrl = searchParams.get('fileUrl')

    if (!fileUrl) {
      return NextResponse.json({ success: false, error: 'fileUrl es requerido' }, { status: 400 })
    }

    // Verify the file belongs to user's company
    if (!fileUrl.includes(`chat/${payload.companyId}/`)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    let signedUrl: string
    try {
      signedUrl = await storageAdapter.createSignedUrl(BUCKET_NAME, fileUrl, 3600)
    } catch (error) {
      console.error('[Chat Upload GET] Signed URL error:', error)
      return NextResponse.json({
        success: false,
        error: 'Error al generar URL'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { signedUrl }
    })

  } catch (error) {
    console.error('[Chat Upload GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener URL'
    }, { status: 500 })
  }
}
