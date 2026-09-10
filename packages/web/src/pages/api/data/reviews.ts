import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      // A review may only be stamped with an organisation the author belongs to,
      // otherwise anyone could inject content into a private org's feed and stats.
      const isMemberOf = async (organisationId: unknown, userId: string) => {
        const { rowCount } = await pool.query(
          'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2',
          [organisationId, userId]
        )
        return (rowCount ?? 0) > 0
      }

      if (method === 'GET') {
        const userIds = params.get('user_ids')
        if (!userIds) return error('user_ids parameter is required')

        const ids = userIds.split(',').map((id) => id.trim())
        const { rows } = await pool.query(
          'SELECT user_id, rating FROM reviews WHERE user_id = ANY($1)',
          [ids]
        )
        return json(rows)
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.restaurant_id || body.rating == null) {
          return error('restaurant_id and rating are required')
        }

        const organisationId = body.organisation_id ?? null
        if (organisationId !== null && !(await isMemberOf(organisationId, user.id))) {
          return error('You are not a member of that organisation', 403)
        }

        const { rows } = await pool.query(
          `INSERT INTO reviews (restaurant_id, user_id, rating, value_rating, taste_rating, comment, dish, organisation_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            body.restaurant_id,
            user.id,
            body.rating,
            body.value_rating ?? null,
            body.taste_rating ?? null,
            body.comment ?? null,
            body.dish ?? null,
            organisationId,
          ]
        )
        return json(rows[0], 201)
      }

      if (method === 'PUT') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        if (body.organisation_id != null && !(await isMemberOf(body.organisation_id, user.id))) {
          return error('You are not a member of that organisation', 403)
        }

        // Only update the fields the caller actually sent, so omitted
        // columns keep their current values instead of being nulled out.
        const updatable = ['rating', 'value_rating', 'taste_rating', 'comment', 'dish', 'photo_url', 'organisation_id']
        const fields = updatable.filter((f) => f in body)
        if (fields.length === 0) return error('No updatable fields provided')

        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ')
        const values = fields.map((f) => body[f])

        const { rows } = await pool.query(
          `UPDATE reviews SET ${setClause}
           WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2}
           RETURNING *`,
          [...values, body.id, user.id]
        )
        if (rows.length === 0) return error('Review not found or not owned by user', 404)
        return json(rows[0])
      }

      if (method === 'PATCH') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id || !body?.photo_url) return error('id and photo_url are required')

        const { rows } = await pool.query(
          'UPDATE reviews SET photo_url = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [body.photo_url, body.id, user.id]
        )
        if (rows.length === 0) return error('Review not found or not owned by user', 404)
        return json(rows[0])
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        await pool.query(
          'DELETE FROM review_tags WHERE review_id = $1 AND EXISTS (SELECT 1 FROM reviews WHERE id = $1 AND user_id = $2)',
          [body.id, user.id]
        )
        const { rowCount } = await pool.query(
          'DELETE FROM reviews WHERE id = $1 AND user_id = $2',
          [body.id, user.id]
        )
        if (rowCount === 0) return error('Review not found or not owned by user', 404)
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
