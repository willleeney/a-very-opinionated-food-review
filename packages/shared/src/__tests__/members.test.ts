import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from '../lib/api'

// Test data
const mockOrgId = '11111111-1111-1111-1111-111111111111'

const mockAdminMember = {
  id: 'member-1',
  organisation_id: mockOrgId,
  user_id: 'admin-user-id',
  role: 'admin',
  created_at: '2024-01-01T00:00:00Z',
}

const mockRegularMember = {
  id: 'member-2',
  organisation_id: mockOrgId,
  user_id: 'regular-user-id',
  role: 'member',
  created_at: '2024-01-01T00:00:00Z',
}

/** Stub global fetch with a single JSON response. */
function mockFetch(body: unknown, ok = true) {
  const text = body === undefined ? '' : JSON.stringify(body)
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
    text: async () => text,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Organisation Members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Admin adding a member', () => {
    it('should allow admin to add a new member', async () => {
      const fetchMock = mockFetch(mockRegularMember)

      await api.addOrgMember({
        organisation_id: mockOrgId,
        user_id: 'new-user-id',
        role: 'member',
      })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/data/org-members',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            organisation_id: mockOrgId,
            user_id: 'new-user-id',
            role: 'member',
          }),
        }),
      )
    })
  })

  describe('Admin removing a member', () => {
    it('should allow admin to remove a member', async () => {
      const fetchMock = mockFetch(undefined)

      await api.removeOrgMember(mockRegularMember.id)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/data/org-members',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ id: mockRegularMember.id }),
        }),
      )
    })
  })

  describe('Admin transferring admin role', () => {
    it('should allow admin to make another member an admin', async () => {
      const fetchMock = mockFetch(undefined)

      await api.updateOrgMember(mockRegularMember.id, 'admin')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/data/org-members',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ id: mockRegularMember.id, role: 'admin' }),
        }),
      )
    })

    it('should allow admin to remove admin role from another admin', async () => {
      const fetchMock = mockFetch(undefined)

      await api.updateOrgMember(mockAdminMember.id, 'member')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/data/org-members',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ id: mockAdminMember.id, role: 'member' }),
        }),
      )
    })
  })

  describe('Member cannot modify others', () => {
    it('should not allow regular member to add other members', async () => {
      // Authorisation is enforced server-side; the client surfaces the error
      mockFetch('Forbidden', false)

      await expect(
        api.addOrgMember({
          organisation_id: mockOrgId,
          user_id: 'another-user-id',
          role: 'member',
        }),
      ).rejects.toThrow()
    })

    it('should not allow regular member to remove others', async () => {
      mockFetch('Forbidden', false)

      await expect(api.removeOrgMember('other-member-id')).rejects.toThrow()
    })
  })

  describe('User leaving organisation', () => {
    it('should allow user to leave organisation', async () => {
      mockFetch(undefined)

      // User can delete their own membership
      await expect(
        api.removeOrgMember(mockRegularMember.id),
      ).resolves.toBeUndefined()
    })
  })

  describe('Fetching members', () => {
    it('should fetch all members of an organisation', async () => {
      const fetchMock = mockFetch([mockAdminMember, mockRegularMember])

      const data = await api.getOrgMembers(mockOrgId)

      expect(data).toHaveLength(2)
      expect(data[0].role).toBe('admin')
      expect(fetchMock.mock.calls[0][0]).toContain(
        `/api/data/org-members?org_id=${mockOrgId}`,
      )
    })
  })
})
