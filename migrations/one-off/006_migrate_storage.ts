/**
 * Copies Supabase Storage objects into the R2 bucket `tastefull-media`, then
 * rewrites the database URLs that pointed at Supabase.
 *
 * Keys mirror the old Supabase layout, so
 *   review-photos/<userId>/<reviewId>.jpg
 * is served by the worker at
 *   /api/media/review-photos/<userId>/<reviewId>.jpg
 *
 * Idempotent: re-uploading an object simply overwrites it, and the URL rewrite
 * only touches rows that still contain 'supabase.co/storage'.
 *
 * Needs R2 S3 credentials in addition to the usual .env values:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 */
import { Pool } from '@neondatabase/serverless'
import { AwsClient } from 'aws4fetch'
import * as dotenv from 'dotenv'

dotenv.config()

const { SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL } = process.env as Record<string, string>
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env

const BUCKETS = ['review-photos', 'avatars']
const R2_BUCKET = 'tastefull-media'

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error(`Missing R2 S3 credentials.

Create them in the Cloudflare dashboard:
  1. R2 > Manage R2 API Tokens > Create API token
  2. Permissions: "Object Read & Write"
  3. Scope it to the bucket "${R2_BUCKET}" (or all buckets)
  4. Create, then copy the Access Key ID and Secret Access Key (shown once)
  5. Your Account ID is on the R2 overview page

Then set these before re-running (in ${process.cwd()}/.env or the shell):
  R2_ACCOUNT_ID=<cloudflare account id>
  R2_ACCESS_KEY_ID=<access key id>
  R2_SECRET_ACCESS_KEY=<secret access key>

No database changes were made.`)
  process.exit(1)
}

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  region: 'auto',
  service: 's3',
})
const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`

type StorageEntry = { name: string; id: string | null }

/** One page of a bucket listing. Entries with a null id are folders. */
async function listPrefix(bucket: string, prefix: string): Promise<StorageEntry[]> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 1000 }),
  })
  if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`)
  return (await res.json()) as StorageEntry[]
}

/** Walks a bucket recursively and returns every file path relative to the bucket. */
async function listFiles(bucket: string, prefix = ''): Promise<string[]> {
  const paths: string[] = []

  for (const entry of await listPrefix(bucket, prefix)) {
    const path = `${prefix}${entry.name}`
    if (entry.id === null) {
      paths.push(...(await listFiles(bucket, `${path}/`)))
    } else {
      paths.push(path)
    }
  }

  return paths
}

async function copyObject(bucket: string, path: string) {
  const key = `${bucket}/${path}`

  const download = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
  )
  if (!download.ok) throw new Error(`download ${key}: ${download.status} ${await download.text()}`)
  const body = await download.arrayBuffer()

  const upload = await r2.fetch(`${r2Endpoint}/${key}`, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': download.headers.get('content-type') ?? 'application/octet-stream',
    },
  })
  if (!upload.ok) throw new Error(`upload ${key}: ${upload.status} ${await upload.text()}`)

  console.log(`  copied ${key} (${body.byteLength} bytes)`)
}

/**
 * Strips the Supabase origin off a stored URL, leaving a same-origin worker path.
 * Any ?t=... cache-busting suffix survives because only the prefix is replaced.
 */
async function rewriteUrls(pool: Pool, table: string, column: string) {
  const { rowCount } = await pool.query(
    `UPDATE ${table}
        SET ${column} = regexp_replace(
              ${column},
              '^https://[^/]+\\.supabase\\.co/storage/v1/object/public/',
              '/api/media/'
            )
      WHERE ${column} LIKE '%supabase.co/storage%'`,
  )
  console.log(`  ${table}.${column}: ${rowCount ?? 0} rows rewritten`)
}

async function main() {
  console.log('Copying storage objects into R2...')

  let copied = 0
  for (const bucket of BUCKETS) {
    const files = await listFiles(bucket)
    console.log(`  ${bucket}: ${files.length} file(s)`)
    for (const path of files) {
      await copyObject(bucket, path)
      copied += 1
    }
  }
  console.log(`${copied} object(s) copied.`)

  console.log('\nRewriting database URLs...')
  const pool = new Pool({ connectionString: DATABASE_URL })
  await rewriteUrls(pool, 'reviews', 'photo_url')
  await rewriteUrls(pool, 'profiles', 'avatar_url')
  await pool.end()

  console.log('\nStorage migration complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
