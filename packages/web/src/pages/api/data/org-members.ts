import type { APIRoute } from 'astro'
import { withApi, json, error } from '../../../lib/api-helpers'

export const prerender = false

export const ALL: APIRoute = (context) =>
  withApi(
    context,
    async ({ pool, user, params, body }) => {
      const method = context.request.method

      if (method === 'GET') {
        if (!user) return error('Unauthorized', 401)

        const orgId = params.get('org_id')
        const userId = params.get('user_id')

        if (orgId) {
          const { rows: membership } = await pool.query(
            'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2',
            [orgId, user.id]
          )
          if (membership.length === 0) {
            return error('Not a member of this organisation', 403)
          }

          const { rows } = await pool.query(
            'SELECT * FROM organisation_members WHERE organisation_id = $1',
            [orgId]
          )
          return json(rows)
        }

        if (userId) {
          if (userId !== user.id) {
            return error('Cannot read memberships for another user', 403)
          }

          const includeOrgs = params.get('include_orgs') === 'true'

          if (includeOrgs) {
            const { rows } = await pool.query(
              `SELECT om.*, row_to_json(o.*) as organisation
               FROM organisation_members om
               JOIN organisations o ON o.id = om.organisation_id
               WHERE om.user_id = $1`,
              [userId]
            )
            return json(rows)
          }

          const { rows } = await pool.query(
            'SELECT * FROM organisation_members WHERE user_id = $1',
            [userId]
          )
          return json(rows)
        }

        return error('org_id or user_id parameter is required')
      }

      if (method === 'POST') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.organisation_id || !body?.user_id || !body?.role) {
          return error('organisation_id, user_id, and role are required')
        }
        if (body.role !== 'admin' && body.role !== 'member') {
          return error('role must be admin or member')
        }

        const { rows: allowed } = await pool.query(
          'SELECT can_add_org_member($1, $2, $3) AS allowed',
          [body.organisation_id, body.user_id, user.id]
        )
        if (!allowed[0]?.allowed) {
          return error('Not allowed to add members to this organisation', 403)
        }

        // Never trust the requested role: only an existing admin, or the very
        // first member of an empty org (org creation), may set it.
        const { rows: roleCheck } = await pool.query(
          `SELECT is_org_admin($1, $2) AS is_admin,
                  NOT EXISTS (
                    SELECT 1 FROM organisation_members WHERE organisation_id = $1
                  ) AS is_empty`,
          [body.organisation_id, user.id]
        )
        const canSetRole = roleCheck[0]?.is_admin || roleCheck[0]?.is_empty
        const role = canSetRole ? body.role : 'member'

        const { rows } = await pool.query(
          `INSERT INTO organisation_members (organisation_id, user_id, role)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [body.organisation_id, body.user_id, role]
        )
        return json(rows[0], 201)
      }

      if (method === 'PUT') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id || !body?.role) return error('id and role are required')

        const { rows: member } = await pool.query(
          'SELECT organisation_id FROM organisation_members WHERE id = $1',
          [body.id]
        )
        if (member.length === 0) return error('Member not found', 404)

        const { rows: admin } = await pool.query(
          'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
          [member[0].organisation_id, user.id, 'admin']
        )
        if (admin.length === 0) return error('Not an admin of this organisation', 403)

        const { rows } = await pool.query(
          'UPDATE organisation_members SET role = $1 WHERE id = $2 RETURNING *',
          [body.role, body.id]
        )
        return json(rows[0])
      }

      if (method === 'DELETE') {
        if (!user) return error('Unauthorized', 401)
        if (!body?.id) return error('id is required')

        const { rows: member } = await pool.query(
          'SELECT organisation_id, user_id FROM organisation_members WHERE id = $1',
          [body.id]
        )
        if (member.length === 0) return error('Member not found', 404)

        const isSelf = member[0].user_id === user.id
        if (!isSelf) {
          const { rows: admin } = await pool.query(
            'SELECT 1 FROM organisation_members WHERE organisation_id = $1 AND user_id = $2 AND role = $3',
            [member[0].organisation_id, user.id, 'admin']
          )
          if (admin.length === 0) return error('Not an admin of this organisation', 403)
        }

        await pool.query('DELETE FROM organisation_members WHERE id = $1', [body.id])
        return json({ success: true })
      }

      return error('Method not allowed', 405)
    },
    { requireAuth: false }
  )
