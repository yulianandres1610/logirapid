/**
 * Product Images Utilities
 * Maneja imagenes de productos en Supabase Storage usando codigo de barras
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BUCKET = 'company-documents'
const FOLDER = 'product-images'

/**
 * Crea cliente Supabase con service role key para bypassing RLS
 */
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Genera el path de storage para un barcode
 */
export function getStoragePath(barcode: string, extension: string = 'webp'): string {
  // Sanitizar barcode para uso seguro en path
  const safeBarcode = barcode.replace(/[^a-zA-Z0-9-_]/g, '')
  return `${FOLDER}/${safeBarcode}.${extension}`
}

/**
 * Sube una imagen de producto usando el barcode como nombre
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
  const { data, error } = await supabase.storage
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
 * Obtiene la URL de imagen de un producto por barcode
 */
export async function getProductImageByBarcode(barcode: string): Promise<string | null> {
  const supabase = getSupabaseClient()

  // Buscar en diferentes extensiones
  const extensions = ['webp', 'jpg', 'jpeg', 'png']

  for (const ext of extensions) {
    const storagePath = getStoragePath(barcode, ext)

    // Verificar si existe
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(FOLDER, {
        search: `${barcode.replace(/[^a-zA-Z0-9-_]/g, '')}.${ext}`
      })

    if (data && data.length > 0) {
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

      return publicUrlData.publicUrl
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
