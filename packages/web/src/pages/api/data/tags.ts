import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const { rows } = await pool.query('SELECT * FROM tags ORDER BY name')
        return json(rows)
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.name) return error('Name is required')

        const { rows } = await pool.query(
          'INSERT INTO tags (name) VALUES ($1) RETURNING *',
          [body.name]
        )
        return json(rows[0], 201)
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
