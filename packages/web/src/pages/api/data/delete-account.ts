import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

async function deletePrefix(bucket: Env['MEDIA'], prefix: string) {
  let cursor: string | undefined
  do {
    const listed = await bucket.list({ prefix, cursor })
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map((o: { key: string }) => o.key))
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)
}

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user }) => {
      const method = context.request.method

      if (method !== 'POST') return error('Method not allowed', 405)
      if (!user) return error('Unauthorized', 401)

      const userId = user.id
      const env = context.locals.runtime.env
      const client = await pool.connect()

      try {
        await client.query('BEGIN')

        const { rows: reviews } = await client.query(
          'SELECT id FROM reviews WHERE user_id = $1',
          [userId]
        )
        const reviewIds = reviews.map((r) => r.id)

        if (reviewIds.length > 0) {
          await client.query('DELETE FROM review_tags WHERE review_id = ANY($1)', [reviewIds])
        }

        await client.query('DELETE FROM reviews WHERE user_id = $1', [userId])
        await client.query('DELETE FROM organisation_members WHERE user_id = $1', [userId])
        await client.query('DELETE FROM organisation_requests WHERE user_id = $1', [userId])
        await client.query('DELETE FROM organisation_invites WHERE email = $1', [user.email])
        await client.query('DELETE FROM user_follows WHERE follower_id = $1', [userId])
        await client.query('DELETE FROM user_follows WHERE following_id = $1', [userId])
        await client.query('DELETE FROM follow_requests WHERE requester_id = $1', [userId])
        await client.query('DELETE FROM follow_requests WHERE target_id = $1', [userId])
        await client.query('DELETE FROM push_tokens WHERE user_id = $1', [userId])

        // Restaurants they added stay — other users' reviews point at them. Drop
        // the attribution instead of the row.
        await client.query('UPDATE restaurants SET created_by = NULL WHERE created_by = $1', [userId])

        await client.query('DELETE FROM profiles WHERE id = $1', [userId])

        // Last: removes the auth identity. session, account and profiles cascade
        // off this, so any live session dies with it.
        await client.query('DELETE FROM "user" WHERE id = $1', [userId])

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      // R2 is not transactional, so this runs after the commit. A failure here
      // leaves orphaned objects rather than an undeletable account.
      try {
        await deletePrefix(env.MEDIA, `avatars/${userId}/`)
        await deletePrefix(env.MEDIA, `review-photos/${userId}/`)
      } catch (err) {
        console.error('Failed to delete R2 media for deleted account', userId, err)
      }

      return json({ success: true })
    },
    { requireAuth: true }
  )
