import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const name = params.get('name')

        if (name) {
          const { rows } = await pool.query(
            'SELECT id, name FROM restaurants WHERE LOWER(name) LIKE LOWER($1) LIMIT 1',
            [`%${name}%`]
          )
          return json(rows[0] ?? null)
        }

        // Ratings are public, but reviewer identity and comments are not sent to
        // anonymous clients at all. Signed-in callers get the full payload and the
        // app layer decides what to show based on shared org membership.
        const reviewFields = user
          ? `
                  'id', rv.id,
                  'user_id', rv.user_id,
                  'rating', rv.rating,
                  'value_rating', rv.value_rating,
                  'taste_rating', rv.taste_rating,
                  'comment', rv.comment,
                  'dish', rv.dish,
                  'photo_url', rv.photo_url,
                  'organisation_id', rv.organisation_id,
                  'created_at', rv.created_at,
                  'restaurant_id', rv.restaurant_id`
          : `
                  'id', rv.id,
                  'rating', rv.rating,
                  'value_rating', rv.value_rating,
                  'taste_rating', rv.taste_rating,
                  'created_at', rv.created_at,
                  'restaurant_id', rv.restaurant_id`

        const { rows } = await pool.query(`
          SELECT r.*,
            COALESCE(
              json_agg(
                json_build_object(${reviewFields}
                )
              ) FILTER (WHERE rv.id IS NOT NULL),
              '[]'
            ) as reviews
          FROM restaurants r
          LEFT JOIN reviews rv ON rv.restaurant_id = r.id
          GROUP BY r.id
          ORDER BY r.name
        `)
        return json(rows)
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.name) return error('Name is required')

        const { rows } = await pool.query(
          `INSERT INTO restaurants (name, cuisine, categories, latitude, longitude, address, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            body.name,
            body.cuisine ?? null,
            body.categories ?? null,
            body.latitude ?? null,
            body.longitude ?? null,
            body.address ?? null,
            user.id,
          ]
        )
        return json(rows[0], 201)
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
