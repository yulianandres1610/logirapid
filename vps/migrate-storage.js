#!/usr/bin/env node
/**
 * Storage Migration Script: Supabase Storage → MinIO
 *
 * Lists all files in Supabase Storage buckets, downloads each file,
 * and uploads to MinIO via S3 SDK.
 *
 * Usage: node vps/migrate-storage.js
 *
 * Prerequisites:
 *   - .env.local with SUPABASE and MINIO credentials
 *   - MinIO running with buckets created
 */

const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Manual .env.local parsing
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
  console.error('Missing MINIO_ENDPOINT, MINIO_ACCESS_KEY, or MINIO_SECRET_KEY');
  process.exit(1);
}

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// MinIO S3 client
const s3Client = new S3Client({
  endpoint: MINIO_ENDPOINT.replace(/\/$/, ''),
  region: 'us-east-1',
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKETS = ['company-documents', 'company-private-documents'];

async function listAllFiles(bucket, folder = '', allFiles = []) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000 });

  if (error) {
    console.error(`  Error listing ${bucket}/${folder}:`, error.message);
    return allFiles;
  }

  if (!data || data.length === 0) return allFiles;

  for (const item of data) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;

    if (item.id) {
      // It's a file
      allFiles.push({
        path: itemPath,
        size: item.metadata?.size || 0,
        contentType: item.metadata?.mimetype || 'application/octet-stream',
      });
    } else {
      // It's a folder - recurse
      await listAllFiles(bucket, itemPath, allFiles);
    }
  }

  return allFiles;
}

async function fileExistsInMinio(bucket, key) {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function migrateFile(bucket, file) {
  try {
    // Check if already exists in MinIO
    const exists = await fileExistsInMinio(bucket, file.path);
    if (exists) {
      return { status: 'skipped', path: file.path };
    }

    // Download from Supabase
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(file.path);

    if (error || !data) {
      return { status: 'error', path: file.path, error: error?.message || 'No data' };
    }

    // Convert to buffer
    const buffer = Buffer.from(await data.arrayBuffer());

    // Upload to MinIO
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: file.path,
      Body: buffer,
      ContentType: file.contentType,
    }));

    return { status: 'migrated', path: file.path, size: buffer.length };
  } catch (err) {
    return { status: 'error', path: file.path, error: err.message };
  }
}

async function main() {
  console.log('🚀 Storage Migration: Supabase → MinIO\n');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`MinIO:    ${MINIO_ENDPOINT}\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalBytes = 0;

  for (const bucket of BUCKETS) {
    console.log(`📦 Processing bucket: ${bucket}`);

    // List all files
    const files = await listAllFiles(bucket);
    console.log(`  Found ${files.length} files`);

    if (files.length === 0) {
      console.log(`  ⏭️  No files to migrate\n`);
      continue;
    }

    // Migrate in batches of 5 (to avoid overwhelming connections)
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(f => migrateFile(bucket, f)));

      for (const result of results) {
        if (result.status === 'migrated') {
          totalMigrated++;
          totalBytes += result.size || 0;
          if (totalMigrated % 50 === 0) {
            console.log(`  📤 Migrated ${totalMigrated} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB)...`);
          }
        } else if (result.status === 'skipped') {
          totalSkipped++;
        } else {
          totalErrors++;
          console.error(`  ❌ ${result.path}: ${result.error}`);
        }
      }
    }

    console.log(`  ✅ Bucket ${bucket} done\n`);
  }

  console.log('📊 Migration Summary:');
  console.log(`  Migrated: ${totalMigrated} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Skipped:  ${totalSkipped} (already in MinIO)`);
  console.log(`  Errors:   ${totalErrors}`);
  console.log('\n✅ Storage migration complete!');
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
