// Client-side storage module — replaces supabase.storage calls
// Media lives in R2 and is served by the Worker at /api/media/<key>
// Every fetch includes credentials: 'include' for Better Auth cookie sessions
// Uploads take no userId — the server derives the folder from the session

async function upload(
  kind: 'review-photos' | 'avatars',
  name: string,
  file: Blob,
): Promise<string> {
  const form = new FormData()
  form.set('kind', kind)
  form.set('name', name)
  form.set('file', file)
  const res = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  const { url } = (await res.json()) as { url: string }
  return url
}

export async function uploadReviewPhoto(
  reviewId: string,
  blob: Blob,
): Promise<string> {
  return upload('review-photos', `${reviewId}.jpg`, blob)
}

// Keyed off the MIME type rather than the filename: the server validates the
// declared type against the file's magic bytes, so an extension taken from the
// name (or a file with no extension at all) could disagree with the content.
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const ACCEPTED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE)

export async function uploadAvatar(file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type]
  if (!ext) {
    throw new Error(
      'Please choose a JPEG, PNG, WebP or GIF image.'
    )
  }
  return upload('avatars', `avatar.${ext}`, file)
}

export async function deleteAvatar(name: string): Promise<void> {
  const res = await fetch('/api/media', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ kind: 'avatars', name }),
  })
  if (!res.ok) throw new Error(await res.text())
}
