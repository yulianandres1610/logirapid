/**
 * Product Images Utilities
 * Maneja imagenes de productos en Storage usando codigo de barras
 * Soporta múltiples imágenes por producto con formato: {barcode}-{index}.ext
 */

import * as storageAdapter from '@/lib/storage-adapter'

const BUCKET = 'company-documents'
const FOLDER = 'product-images'

/**
 * Verifica si Storage está configurado
 */
export function isStorageConfigured(): boolean {
  return storageAdapter.isConfigured()
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
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')

  let maxIndexFromStorage = 0
  let maxIndexFromDB = 0

  // 1. Buscar en Storage
  const data = await storageAdapter.list(BUCKET, FOLDER, {
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
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')

  const data = await storageAdapter.list(BUCKET, FOLDER, {
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
    const publicUrl = storageAdapter.getPublicUrl(BUCKET, storagePath)

    images.push({
      barcode,
      imageIndex,
      storagePath,
      imageUrl: publicUrl,
      isPrimary,
      fileSize: file.size,
      createdAt: file.createdAt
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
  // Determinar extension basada en content type
  let extension = 'webp'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg'
  else if (contentType.includes('png')) extension = 'png'
  else if (contentType.includes('gif')) extension = 'gif'

  const storagePath = getStoragePath(barcode, extension)

  // Intentar eliminar si ya existe (para actualizar)
  try {
    await storageAdapter.remove(BUCKET, [storagePath])
  } catch {
    // Ignorar si no existe
  }

  // Subir imagen
  const uploadResult = await storageAdapter.upload(BUCKET, storagePath, imageBuffer, {
    contentType,
    upsert: true
  })

  if (!uploadResult.success) {
    throw new Error(`Error uploading product image: ${uploadResult.error}`)
  }

  // Obtener URL publica
  const publicUrl = uploadResult.publicUrl || storageAdapter.getPublicUrl(BUCKET, storagePath)

  return {
    url: publicUrl,
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
  const uploadResult = await storageAdapter.upload(BUCKET, storagePath, imageBuffer, {
    contentType,
    upsert: true
  })

  if (!uploadResult.success) {
    throw new Error(`Error uploading product image: ${uploadResult.error}`)
  }

  // Obtener URL publica
  const publicUrl = uploadResult.publicUrl || storageAdapter.getPublicUrl(BUCKET, storagePath)

  return {
    url: publicUrl,
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
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')

  // Buscar en diferentes extensiones
  const extensions = ['webp', 'jpg', 'jpeg', 'png']

  for (const ext of extensions) {
    const storagePath = getStoragePath(barcode, ext)

    // Verificar si existe y tiene contenido
    const data = await storageAdapter.list(BUCKET, FOLDER, {
      search: `${safeBarcode}.${ext}`
    })

    if (data && data.length > 0) {
      // Verificar que el archivo tiene tamaño > 0
      const file = data.find(f => f.name === `${safeBarcode}.${ext}`)
      if (file && (file.size === undefined || file.size > 0)) {
        return storageAdapter.getPublicUrl(BUCKET, storagePath)
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
  const extensions = ['webp', 'jpg', 'jpeg', 'png']
  let deleted = false

  for (const ext of extensions) {
    const storagePath = getStoragePath(barcode, ext)

    try {
      const result = await storageAdapter.remove(BUCKET, [storagePath])
      if (result.supabaseOk || result.minioOk) {
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
  const data = await storageAdapter.list(BUCKET, FOLDER, {
    limit,
    offset
  })

  const images = (data || []).map(file => {
    // Extraer barcode del nombre del archivo
    const barcode = file.name.replace(/\.[^.]+$/, '')
    const storagePath = `${FOLDER}/${file.name}`

    const publicUrl = storageAdapter.getPublicUrl(BUCKET, storagePath)

    return {
      barcode,
      url: publicUrl,
      path: storagePath
    }
  })

  return {
    images,
    total: images.length
  }
}
