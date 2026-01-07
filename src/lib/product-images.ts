/**
 * Product Images Utilities
 * Maneja imagenes de productos en Supabase Storage usando codigo de barras
 * Soporta múltiples imágenes por producto con formato: {barcode}-{index}.ext
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const BUCKET = 'company-documents'
const FOLDER = 'product-images'

/**
 * Verifica si Supabase Storage está configurado
 */
export function isStorageConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey)
}

export interface ProductImage {
  id?: number
  barcode: string
  imageIndex: number
  storagePath: string
  imageUrl: string
  isPrimary: boolean
  processedWithAi?: boolean
  aiModel?: string | null
  contentType?: string
  fileSize?: number
  createdBy?: number
  companyId?: number
  createdAt?: string
}

export interface ProductImagesResponse {
  found: boolean
  count: number
  data: {
    images: ProductImage[]
    primaryImage: string | null
  }
}

/**
 * Crea cliente Supabase con service role key para bypassing RLS
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Storage no está configurado. Verifica NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Genera el path de storage para un barcode (compatibilidad hacia atrás)
 */
export function getStoragePath(barcode: string, extension: string = 'webp'): string {
  // Sanitizar barcode para uso seguro en path
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')
  return `${FOLDER}/${safeBarcode}.${extension}`
}

/**
 * Genera el path de storage para un barcode con índice
 * Formato: product-images/{barcode}-{index}.{extension}
 */
export function getStoragePathWithIndex(barcode: string, index: number, extension: string = 'webp'): string {
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')
  return `${FOLDER}/${safeBarcode}-${index}.${extension}`
}

/**
 * Obtiene el siguiente índice disponible para un barcode
 * Consulta tanto el storage como la base de datos para evitar conflictos
 */
export async function getNextImageIndex(barcode: string): Promise<number> {
  const supabase = getSupabaseClient()
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')

  let maxIndexFromStorage = 0
  let maxIndexFromDB = 0

  // 1. Buscar en Supabase Storage
  const { data } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, {
      search: safeBarcode
    })

  if (data && data.length > 0) {
    const indexPattern = new RegExp(`^${safeBarcode}-(\\d+)\\.`)

    for (const file of data) {
      const match = file.name.match(indexPattern)
      if (match) {
        const index = parseInt(match[1], 10)
        if (index > maxIndexFromStorage) {
          maxIndexFromStorage = index
        }
      }
    }

    // También verificar si existe el formato antiguo sin índice
    const oldFormatExists = data.some(f =>
      f.name.startsWith(safeBarcode + '.') && !f.name.includes('-')
    )
    if (oldFormatExists && maxIndexFromStorage === 0) {
      maxIndexFromStorage = 1
    }
  }

  // 2. Buscar en la base de datos PostgreSQL (para evitar conflictos de constraint)
  try {
    const { db } = await import('./database')
    const dbResult = await db.query(
      'SELECT COALESCE(MAX(image_index), 0) as max_index FROM product_images WHERE barcode = $1',
      [barcode]
    )
    maxIndexFromDB = parseInt(dbResult.rows[0]?.max_index) || 0
  } catch (error) {
    console.warn('[getNextImageIndex] Error querying database:', error)
  }

  // Usar el máximo entre storage y BD
  const maxIndex = Math.max(maxIndexFromStorage, maxIndexFromDB)

  return maxIndex + 1
}

/**
 * Obtiene todas las imágenes de un producto por barcode
 */
export async function getAllProductImagesByBarcode(barcode: string): Promise<ProductImage[]> {
  const supabase = getSupabaseClient()
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')

  const { data } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, {
      search: safeBarcode
    })

  if (!data || data.length === 0) {
    return []
  }

  const images: ProductImage[] = []
  const indexPattern = new RegExp(`^${safeBarcode}-(\\d+)\\.`)

  for (const file of data) {
    // Solo archivos que comienzan con el barcode exacto
    if (!file.name.startsWith(safeBarcode)) continue

    let imageIndex = 1
    let isPrimary = false

    // Formato nuevo: {barcode}-{index}.ext
    const match = file.name.match(indexPattern)
    if (match) {
      imageIndex = parseInt(match[1], 10)
      isPrimary = imageIndex === 1
    } else if (file.name.startsWith(safeBarcode + '.')) {
      // Formato antiguo: {barcode}.ext (sin índice)
      imageIndex = 1
      isPrimary = true
    } else {
      // No coincide con ningún formato válido
      continue
    }

    const storagePath = `${FOLDER}/${file.name}`
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)

    images.push({
      barcode,
      imageIndex,
      storagePath,
      imageUrl: publicUrlData.publicUrl,
      isPrimary,
      fileSize: file.metadata?.size,
      createdAt: file.created_at
    })
  }

  // Ordenar por índice
  images.sort((a, b) => a.imageIndex - b.imageIndex)

  // Asegurar que al menos una sea primaria
  if (images.length > 0 && !images.some(img => img.isPrimary)) {
    images[0].isPrimary = true
  }

  return images
}

/**
 * Sube una imagen de producto usando el barcode como nombre
 * @deprecated Use uploadProductImageWithIndex para nuevas imágenes
 */
export async function uploadProductImageByBarcode(
  barcode: string,
  imageBuffer: Buffer,
  contentType: string = 'image/webp'
): Promise<{ url: string; path: string }> {
  const supabase = getSupabaseClient()

  // Determinar extension basada en content type
  let extension = 'webp'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg'
  else if (contentType.includes('png')) extension = 'png'
  else if (contentType.includes('gif')) extension = 'gif'

  const storagePath = getStoragePath(barcode, extension)

  // Intentar eliminar si ya existe (para actualizar)
  try {
    await supabase.storage.from(BUCKET).remove([storagePath])
  } catch {
    // Ignorar si no existe
  }

  // Subir imagen
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType,
      upsert: true
    })

  if (error) {
    throw new Error(`Error uploading product image: ${error.message}`)
  }

  // Obtener URL publica
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return {
    url: publicUrlData.publicUrl,
    path: storagePath
  }
}

/**
 * Sube una imagen de producto con índice específico
 * No sobrescribe, agrega a la galería
 */
export async function uploadProductImageWithIndex(
  barcode: string,
  imageBuffer: Buffer,
  contentType: string = 'image/webp',
  index?: number
): Promise<{ url: string; path: string; index: number; isPrimary: boolean }> {
  const supabase = getSupabaseClient()

  // Determinar extension basada en content type
  let extension = 'webp'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg'
  else if (contentType.includes('png')) extension = 'png'
  else if (contentType.includes('gif')) extension = 'gif'

  // Obtener siguiente índice si no se especifica
  const imageIndex = index ?? await getNextImageIndex(barcode)
  const isPrimary = imageIndex === 1

  const storagePath = getStoragePathWithIndex(barcode, imageIndex, extension)

  // Subir imagen (upsert: true para permitir reemplazar imágenes existentes)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType,
      upsert: true
    })

  if (error) {
    throw new Error(`Error uploading product image: ${error.message}`)
  }

  // Obtener URL publica
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return {
    url: publicUrlData.publicUrl,
    path: storagePath,
    index: imageIndex,
    isPrimary
  }
}

/**
 * Obtiene la URL de imagen de un producto por barcode
 * Solo devuelve la URL si el archivo existe y tiene contenido
 */
export async function getProductImageByBarcode(barcode: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')

  // Buscar en diferentes extensiones
  const extensions = ['webp', 'jpg', 'jpeg', 'png']

  for (const ext of extensions) {
    const storagePath = getStoragePath(barcode, ext)

    // Verificar si existe y tiene contenido
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(FOLDER, {
        search: `${safeBarcode}.${ext}`
      })

    if (data && data.length > 0) {
      // Verificar que el archivo tiene tamaño > 0
      const file = data.find(f => f.name === `${safeBarcode}.${ext}`)
      if (file && file.metadata?.size > 0) {
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath)

        return publicUrlData.publicUrl
      }
    }
  }

  return null
}

/**
 * Verifica si existe una imagen para un barcode
 */
export async function checkProductImageExists(barcode: string): Promise<boolean> {
  const imageUrl = await getProductImageByBarcode(barcode)
  return imageUrl !== null
}

/**
 * Elimina la imagen de un producto por barcode
 */
export async function deleteProductImageByBarcode(barcode: string): Promise<boolean> {
  const supabase = getSupabaseClient()

  const extensions = ['webp', 'jpg', 'jpeg', 'png']
  let deleted = false

  for (const ext of extensions) {
    const storagePath = getStoragePath(barcode, ext)

    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath])

      if (!error) {
        deleted = true
      }
    } catch {
      // Continuar con siguiente extension
    }
  }

  return deleted
}

/**
 * Lista todas las imagenes de productos en el storage
 */
export async function listProductImages(limit: number = 100, offset: number = 0): Promise<{
  images: Array<{ barcode: string; url: string; path: string }>
  total: number
}> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, {
      limit,
      offset,
      sortBy: { column: 'created_at', order: 'desc' }
    })

  if (error) {
    throw new Error(`Error listing product images: ${error.message}`)
  }

  const images = (data || []).map(file => {
    // Extraer barcode del nombre del archivo
    const barcode = file.name.replace(/\.[^.]+$/, '')
    const storagePath = `${FOLDER}/${file.name}`

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)

    return {
      barcode,
      url: publicUrlData.publicUrl,
      path: storagePath
    }
  })

  return {
    images,
    total: images.length
  }
}
