import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        const slug = params.get('slug')
        const ids = params.get('ids')
        const search = params.get('search')

        if (slug) {
          const { rows } = await pool.query(
            'SELECT * FROM organisations WHERE slug = $1',
            [slug]
          )
          return json(rows[0] ?? null)
        }

        if (ids) {
          const idList = ids.split(',').map((i) => i.trim())
          const { rows } = await pool.query(
            'SELECT * FROM organisations WHERE id = ANY($1)',
            [idList]
          )
          return json(rows)
        }

        if (search) {
          const { rows } = await pool.query(
            'SELECT * FROM organisations WHERE name ILIKE $1 LIMIT 10',
            [`%${search}%`]
          )
          return json(rows)
        }

        return error('slug, ids, or search parameter is required')
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.name || !body?.slug) return error('name and slug are required')

        // The org and its first admin must land together. Creating the org alone
        // leaves it memberless, and a memberless org is claimable as admin by
        // anyone via the first-member bootstrap path in can_add_org_member().
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const { rows } = await client.query(
            'INSERT INTO organisations (name, slug) VALUES ($1, $2) RETURNING *',
            [body.name, body.slug]
          )
          await client.query(
            `INSERT INTO organisation_members (organisation_id, user_id, role)
             VALUES ($1, $2, 'admin')
             ON CONFLICT (organisation_id, user_id) DO NOTHING`,
            [rows[0].id, user.id]
          )
          await client.query('COMMIT')
          return json(rows[0], 201)
        } catch (err) {
          await client.query('ROLLBACK')
          const message = err instanceof Error ? err.message : 'Could not create organisation'
          if (message.includes('duplicate') || message.includes('unique')) {
            return error('That slug is already taken', 409)
          }
          return error(message, 500)
        } finally {
          client.release()
        }
      }

      if (method === 'PUT') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        const { rows: admin } = await pool.query(
          'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
          [body.id, user.id, 'admin']
        )
        if (admin.length === 0) return error('Not an admin of this organisation', 403)

        // Partial update: only touch the fields actually sent, so saving a
        // homebase cannot blank the name and vice versa.
        const updates: string[] = []
        const values: unknown[] = []

        if (body.name !== undefined) {
          if (typeof body.name !== 'string' || !body.name.trim()) {
            return error('name cannot be empty')
          }
          values.push(body.name.trim())
          updates.push(`name = $${values.length}`)
        }

        if (body.office_location !== undefined) {
          const loc = body.office_location
          if (loc !== null) {
            // Existing rows carry a human-readable name and address alongside the
            // coordinates, so keep them rather than reducing the value to {lat,lng}.
            const { lat, lng, name, address } = (loc ?? {}) as {
              lat?: unknown; lng?: unknown; name?: unknown; address?: unknown
            }
            if (
              typeof lat !== 'number' || typeof lng !== 'number' ||
              Number.isNaN(lat) || Number.isNaN(lng) ||
              Math.abs(lat) > 90 || Math.abs(lng) > 180
            ) {
              return error('office_location must be {lat, lng} or null')
            }
            values.push(JSON.stringify({
              lat,
              lng,
              ...(typeof name === 'string' && name ? { name } : {}),
              ...(typeof address === 'string' && address ? { address } : {}),
            }))
          } else {
            values.push(null)
          }
          updates.push(`office_location = $${values.length}`)
        }

        if (updates.length === 0) return error('No updatable fields provided')

        values.push(body.id)
        const { rows } = await pool.query(
          `UPDATE organisations SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
          values
        )
        if (rows.length === 0) return error('Organisation not found', 404)
        return json(rows[0])
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        const { rows: admin } = await pool.query(
          'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
          [body.id, user.id, 'admin']
        )
        if (admin.length === 0) return error('Not an admin of this organisation', 403)

        await pool.query('DELETE FROM organisations WHERE id = $1', [body.id])
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
