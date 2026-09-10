import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const { rows } = await pool.query(`
          SELECT rt.review_id, rt.tag_id, t.name as tag_name, t.id as "tag_id"
          FROM review_tags rt
          JOIN tags t ON t.id = rt.tag_id
        `)
        return json(rows)
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
          return error('items array is required')
        }

        const reviewIds = [...new Set(body.items.map((i: { review_id: string }) => i.review_id))]
        const { rows: owned } = await pool.query(
          'SELECT id FROM reviews WHERE id = ANY($1) AND user_id = $2',
          [reviewIds, user.id]
        )
        if (owned.length !== reviewIds.length) {
          return error('Cannot tag reviews you do not own', 403)
        }

        const values: string[] = []
        const queryParams: string[] = []
        let idx = 1
        for (const item of body.items as { review_id: string; tag_id: string }[]) {
          values.push(`($${idx}, $${idx + 1})`)
          queryParams.push(item.review_id, item.tag_id)
          idx += 2
        }

        const { rows } = await pool.query(
          `INSERT INTO review_tags (review_id, tag_id) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING RETURNING *`,
          queryParams
        )
        return json(rows, 201)
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.review_id) return error('review_id is required')

        const { rows: owned } = await pool.query(
          'SELECT id FROM reviews WHERE id = $1 AND user_id = $2',
          [body.review_id, user.id]
        )
        if (owned.length === 0) return error('Review not found or not owned by user', 403)

        await pool.query('DELETE FROM review_tags WHERE review_id = $1', [body.review_id])
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
