import type { APIRoute } from 'astro'
import { json, error } from '../../../lib/api-helpers'
import { getPool } from '../../../lib/db'
import { getSessionUser } from '../../../lib/session'

export const prerender = false

const MAX_BYTES = 10 * 1024 * 1024
// multipart framing (boundaries + part headers) sits on top of the file bytes
const MAX_REQUEST_BYTES = MAX_BYTES + 64 * 1024
const KINDS = ['review-photos', 'avatars']
// SVG is deliberately absent — it is a script execution vector on our own origin
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const AVATAR_NAME = /^avatar\.(jpg|jpeg|png|webp|gif)$/
const REVIEW_PHOTO_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i

function buildKey(kind: unknown, name: unknown, userId: string): string | Response {
  if (typeof kind !== 'string' || !KINDS.includes(kind)) {
    return error('Invalid kind')
  }
  if (typeof name !== 'string' || !name || !/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) {
    return error('Invalid name')
  }
  return `${kind}/${userId}/${name}`
}

// The declared multipart Content-Type is a client claim; the bytes are not.
function sniffImageType(bytes: Uint8Array): string | null {
  const at = (offset: number, sig: number[]) =>
    bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b)

  if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (at(0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  return null
}

export const ALL: APIRoute = async (context) => {
  const env = context.locals.runtime.env
  const bucket = env.MEDIA
  const method = context.request.method

  if (method === 'GET') {
    const key = context.params.path
    if (!key) return error('Not found', 404)
    if (!KINDS.includes(key.split('/')[0])) return error('Not found', 404)

    const object = await bucket.get(key)
    if (!object) return error('Not found', 404)

    const etag = object.httpEtag
    if (context.request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } })
    }

    const stored = object.httpMetadata?.contentType
    const contentType = stored && ALLOWED_TYPES.includes(stored) ? stored : 'application/octet-stream'

    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        ETag: etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  }

  if (method === 'POST') {
    const user = await getSessionUser(context.request, env)
    if (!user) return error('Unauthorized', 401)

    // Bound what we buffer before formData() materialises the whole body
    const declaredLength = Number(context.request.headers.get('Content-Length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return error('File too large', 413)
    }

    let form: FormData
    try {
      form = await context.request.formData()
    } catch {
      return error('Invalid form data')
    }

    const file = form.get('file')
    if (!(file instanceof File)) return error('File is required')

    const kind = form.get('kind')
    const name = form.get('name')
    if (typeof kind !== 'string' || typeof name !== 'string') return error('Invalid form data')

    const key = buildKey(kind, name, user.id)
    if (key instanceof Response) return key

    if (kind === 'avatars' && !AVATAR_NAME.test(name)) return error('Invalid name')
    if (kind === 'review-photos' && !REVIEW_PHOTO_NAME.test(name)) return error('Invalid name')

    const contentType = file.type
    if (!ALLOWED_TYPES.includes(contentType)) return error('Only images are allowed')
    if (file.size > MAX_BYTES) return error('File too large', 413)

    if (kind === 'review-photos') {
      const reviewId = name.replace(/\.jpg$/i, '')
      const pool = getPool(env.DATABASE_URL)
      const { rowCount } = await pool.query(
        'SELECT 1 FROM reviews WHERE id = $1 AND user_id = $2',
        [reviewId, user.id]
      )
      if (!rowCount) return error('Forbidden', 403)
    }

    const body = await file.arrayBuffer()
    if (body.byteLength > MAX_BYTES) return error('File too large', 413)
    if (sniffImageType(new Uint8Array(body)) !== contentType) {
      return error('Only images are allowed')
    }

    await bucket.put(key, body, { httpMetadata: { contentType } })
    return json({ url: `/api/media/${key}` })
  }

  if (method === 'DELETE') {
    const user = await getSessionUser(context.request, env)
    if (!user) return error('Unauthorized', 401)

    let body: Record<string, unknown> | null = null
    try {
      body = await context.request.json()
    } catch {
      body = null
    }

    const key = buildKey(body?.kind, body?.name, user.id)
    if (key instanceof Response) return key

    await bucket.delete(key)
    return json({ success: true })
  }

  return error('Method not allowed', 405)
}
