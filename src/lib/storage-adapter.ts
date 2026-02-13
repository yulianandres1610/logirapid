/**
 * Storage Adapter - Dual-write abstraction for Supabase Storage + MinIO fallback
 *
 * Upload: writes to Supabase AND MinIO simultaneously (Promise.allSettled)
 * Read/URL: tries Supabase first, falls back to MinIO
 * Delete: removes from both
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy imports for S3 SDK (only loaded when MinIO is configured)
let S3Client: any = null;
let PutObjectCommand: any = null;
let GetObjectCommand: any = null;
let DeleteObjectCommand: any = null;
let ListObjectsV2Command: any = null;
let getSignedUrl: any = null;

async function loadS3SDK() {
  if (!S3Client) {
    const s3Module = await import('@aws-sdk/client-s3');
    S3Client = s3Module.S3Client;
    PutObjectCommand = s3Module.PutObjectCommand;
    GetObjectCommand = s3Module.GetObjectCommand;
    DeleteObjectCommand = s3Module.DeleteObjectCommand;
    ListObjectsV2Command = s3Module.ListObjectsV2Command;
    const presignerModule = await import('@aws-sdk/s3-request-presigner');
    getSignedUrl = presignerModule.getSignedUrl;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabasePublicStorageUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;

const minioEndpoint = process.env.MINIO_ENDPOINT;
const minioAccessKey = process.env.MINIO_ACCESS_KEY;
const minioSecretKey = process.env.MINIO_SECRET_KEY;
const storageFallbackEnabled = process.env.STORAGE_FALLBACK_ENABLED === 'true';

// ============================================================================
// CLIENTS (lazy-initialized)
// ============================================================================

let supabaseClient: SupabaseClient | null = null;
let s3Client: any = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabaseClient;
}

async function getMinioClient(): Promise<any | null> {
  if (!storageFallbackEnabled || !minioEndpoint || !minioAccessKey || !minioSecretKey) return null;

  if (!s3Client) {
    await loadS3SDK();
    const endpoint = minioEndpoint.replace(/\/$/, '');
    s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: minioAccessKey,
        secretAccessKey: minioSecretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

// ============================================================================
// TYPES
// ============================================================================

export interface UploadResult {
  success: boolean;
  path: string;
  publicUrl?: string;
  supabaseOk: boolean;
  minioOk: boolean;
  error?: string;
}

export interface StorageFile {
  name: string;
  size?: number;
  createdAt?: string;
  metadata?: any;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Upload file to both Supabase and MinIO simultaneously.
 * If one fails, the other still has the file (zero data loss).
 */
export async function upload(
  bucket: string,
  path: string,
  data: Buffer | ArrayBuffer,
  options?: { contentType?: string; upsert?: boolean }
): Promise<UploadResult> {
  const contentType = options?.contentType || 'application/octet-stream';
  const upsert = options?.upsert ?? true;
  const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : data;

  const supabase = getSupabaseClient();
  const minio = await getMinioClient();

  const promises: Promise<{ source: string; ok: boolean; error?: string }>[] = [];

  // Supabase upload
  if (supabase) {
    promises.push(
      (async () => {
        try {
          const { error } = await supabase.storage
            .from(bucket)
            .upload(path, buffer, { contentType, upsert });
          if (error) return { source: 'supabase', ok: false, error: error.message };
          return { source: 'supabase', ok: true };
        } catch (err: any) {
          return { source: 'supabase', ok: false, error: err.message };
        }
      })()
    );
  }

  // MinIO upload
  if (minio) {
    promises.push(
      (async () => {
        try {
          await minio.send(new PutObjectCommand({
            Bucket: bucket,
            Key: path,
            Body: buffer,
            ContentType: contentType,
          }));
          return { source: 'minio', ok: true };
        } catch (err: any) {
          return { source: 'minio', ok: false, error: err.message };
        }
      })()
    );
  }

  const results = await Promise.allSettled(promises);
  const outcomes = results.map(r => r.status === 'fulfilled' ? r.value : { source: 'unknown', ok: false, error: 'Promise rejected' });

  const supabaseResult = outcomes.find(o => o.source === 'supabase');
  const minioResult = outcomes.find(o => o.source === 'minio');

  const supabaseOk = supabaseResult?.ok ?? false;
  const minioOk = minioResult?.ok ?? false;
  const anyOk = supabaseOk || minioOk;

  // Log failures for monitoring
  if (!supabaseOk && supabaseResult) {
    console.warn(`[Storage] Supabase upload failed for ${bucket}/${path}: ${supabaseResult.error}`);
  }
  if (!minioOk && minioResult) {
    console.warn(`[Storage] MinIO upload failed for ${bucket}/${path}: ${minioResult.error}`);
  }

  // Generate public URL from whichever succeeded
  let publicUrl: string | undefined;
  if (supabaseOk && supabase) {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    publicUrl = urlData.publicUrl;
  } else if (minioOk && minioEndpoint) {
    publicUrl = `${minioEndpoint}/${bucket}/${path}`;
  }

  return {
    success: anyOk,
    path,
    publicUrl,
    supabaseOk,
    minioOk,
    error: anyOk ? undefined : `Both storage backends failed. Supabase: ${supabaseResult?.error}. MinIO: ${minioResult?.error}`,
  };
}

/**
 * Get public URL for a file. Tries Supabase first, falls back to MinIO.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getSupabaseClient();

  // Try Supabase first
  if (supabase) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (data.publicUrl) return data.publicUrl;
  }

  // Fallback to MinIO
  if (minioEndpoint) {
    return `${minioEndpoint}/${bucket}/${path}`;
  }

  // Last resort: use the stored public URL pattern
  if (supabasePublicStorageUrl) {
    return `${supabasePublicStorageUrl}/${bucket}/${path}`;
  }

  throw new Error(`Cannot generate public URL for ${bucket}/${path}: no storage backend available`);
}

/**
 * Create a signed/temporary URL for private files.
 * Tries Supabase first, falls back to MinIO presigned URL.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const supabase = getSupabaseClient();

  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {
      // Fall through to MinIO
    }
  }

  // Fallback to MinIO presigned URL
  const minio = await getMinioClient();
  if (minio) {
    try {
      await loadS3SDK();
      const command = new GetObjectCommand({ Bucket: bucket, Key: path });
      const url = await getSignedUrl(minio, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (err: any) {
      console.error(`[Storage] MinIO signed URL failed for ${bucket}/${path}:`, err.message);
    }
  }

  throw new Error(`Cannot create signed URL for ${bucket}/${path}: no storage backend available`);
}

/**
 * List files in a bucket/folder. Tries Supabase first, falls back to MinIO.
 */
export async function list(
  bucket: string,
  folder: string,
  options?: { limit?: number; offset?: number; search?: string }
): Promise<StorageFile[]> {
  const supabase = getSupabaseClient();

  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
          limit: options?.limit || 100,
          offset: options?.offset || 0,
          search: options?.search,
        });
      if (!error && data) {
        return data.map(f => ({
          name: f.name,
          size: f.metadata?.size,
          createdAt: f.created_at,
          metadata: f.metadata,
        }));
      }
    } catch {
      // Fall through to MinIO
    }
  }

  // Fallback to MinIO
  const minio = await getMinioClient();
  if (minio) {
    try {
      await loadS3SDK();
      const prefix = folder ? `${folder}/` : '';
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix + (options?.search || ''),
        MaxKeys: options?.limit || 100,
      });
      const response = await minio.send(command);
      return (response.Contents || []).map((obj: any) => ({
        name: obj.Key?.replace(prefix, '') || '',
        size: obj.Size,
        createdAt: obj.LastModified?.toISOString(),
      }));
    } catch (err: any) {
      console.error(`[Storage] MinIO list failed for ${bucket}/${folder}:`, err.message);
    }
  }

  return [];
}

/**
 * Download a file's contents. Tries Supabase first, falls back to MinIO.
 */
export async function download(
  bucket: string,
  path: string
): Promise<{ data: Blob | null; error: string | null }> {
  const supabase = getSupabaseClient();

  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (!error && data) return { data, error: null };
    } catch {
      // Fall through to MinIO
    }
  }

  // Fallback to MinIO
  const minio = await getMinioClient();
  if (minio) {
    try {
      await loadS3SDK();
      const command = new GetObjectCommand({ Bucket: bucket, Key: path });
      const response = await minio.send(command);
      if (response.Body) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const blob = new Blob([buffer], { type: response.ContentType || 'application/octet-stream' });
        return { data: blob, error: null };
      }
    } catch (err: any) {
      console.error(`[Storage] MinIO download failed for ${bucket}/${path}:`, err.message);
    }
  }

  return { data: null, error: `Cannot download ${bucket}/${path}: no storage backend available` };
}

/**
 * Remove file(s) from both Supabase and MinIO.
 */
export async function remove(bucket: string, paths: string[]): Promise<{ supabaseOk: boolean; minioOk: boolean }> {
  const supabase = getSupabaseClient();
  const minio = await getMinioClient();

  let supabaseOk = false;
  let minioOk = false;

  // Remove from Supabase
  if (supabase) {
    try {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      supabaseOk = !error;
      if (error) console.warn(`[Storage] Supabase remove failed:`, error.message);
    } catch (err: any) {
      console.warn(`[Storage] Supabase remove error:`, err.message);
    }
  }

  // Remove from MinIO
  if (minio) {
    try {
      await loadS3SDK();
      for (const path of paths) {
        await minio.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
      }
      minioOk = true;
    } catch (err: any) {
      console.warn(`[Storage] MinIO remove failed:`, err.message);
    }
  }

  return { supabaseOk, minioOk };
}

/**
 * Check if storage adapter has any backend available.
 */
export function isConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey) || !!(storageFallbackEnabled && minioEndpoint);
}

/**
 * Get current storage status for monitoring.
 */
export function getStorageInfo(): {
  supabaseConfigured: boolean;
  minioConfigured: boolean;
  fallbackEnabled: boolean;
} {
  return {
    supabaseConfigured: !!(supabaseUrl && supabaseServiceKey),
    minioConfigured: !!(minioEndpoint && minioAccessKey && minioSecretKey),
    fallbackEnabled: storageFallbackEnabled,
  };
}
