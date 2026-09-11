import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from '../lib/api'

// Test data
const mockOrganisation = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'StackOne',
  slug: 'stackone',
  office_location: { lat: 51.5047, lng: -0.0886 },
  tagline: 'Runway East, London Bridge',
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

describe('Organisations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Creating an organisation', () => {
    it('should allow authenticated users to create an organisation', async () => {
      const fetchMock = mockFetch(mockOrganisation)

      const data = await api.createOrg({ name: 'StackOne', slug: 'stackone' })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/data/organisations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'StackOne', slug: 'stackone' }),
        }),
      )
      expect(data).toEqual(mockOrganisation)
    })
  })

  describe('Updating organisation name', () => {
    it('should allow admin to update organisation name', async () => {
      const fetchMock = mockFetch(undefined)

      await api.updateOrg(mockOrganisation.id, { name: 'New Name' })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/data/organisations',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ id: mockOrganisation.id, name: 'New Name' }),
        }),
      )
    })

    it('should not allow non-admin to update organisation name', async () => {
      // Authorisation is enforced server-side; the client surfaces the error
      mockFetch('Forbidden', false)

      await expect(
        api.updateOrg(mockOrganisation.id, { name: 'New Name' }),
      ).rejects.toThrow()
    })
  })

  describe('Office location', () => {
    it('should expose the office location on the fetched organisation', async () => {
      mockFetch(mockOrganisation)

      const data = await api.getOrgBySlug('stackone')

      expect(data.office_location).toEqual({ lat: 51.5047, lng: -0.0886 })
    })
  })

  describe('Fetching organisations', () => {
    it('should fetch organisation by slug', async () => {
      const fetchMock = mockFetch(mockOrganisation)

      const data = await api.getOrgBySlug('stackone')

      expect(fetchMock.mock.calls[0][0]).toContain(
        '/api/data/organisations?slug=stackone',
      )
      expect(data).toEqual(mockOrganisation)
    })
  })
})
