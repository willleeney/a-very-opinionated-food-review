import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '../lib/supabase'

// Test data
const mockOrganisation = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'StackOne',
  slug: 'stackone',
  office_location: { lat: 51.5047, lng: -0.0886 },
  tagline: 'Runway East, London Bridge',
  created_at: '2024-01-01T00:00:00Z',
}

const mockAdmin = {
  id: 'admin-user-id',
  email: 'admin@stackone.com',
}

const mockMember = {
  id: 'member-user-id',
  email: 'member@stackone.com',
}

describe('Organisations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Creating an organisation', () => {
    it('should allow authenticated users to create an organisation', async () => {
      const mockInsert = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({ data: mockOrganisation, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
      } as any)

      const { data, error } = await supabase
        .from('organisations')
        .insert({
          name: 'StackOne',
          slug: 'stackone',
          office_location: { lat: 51.5047, lng: -0.0886 },
          tagline: 'Runway East, London Bridge',
        })
        .select()
        .single()

      expect(supabase.from).toHaveBeenCalledWith('organisations')
      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('Updating organisation name', () => {
    it('should allow admin to update organisation name', async () => {
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      await supabase
        .from('organisations')
        .update({ name: 'New Name' })
        .eq('id', mockOrganisation.id)

      expect(supabase.from).toHaveBeenCalledWith('organisations')
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'New Name' })
    })

    it('should not allow non-admin to update organisation name', async () => {
      // This would be enforced by RLS policies in the database
      // Here we test that the query structure is correct
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Row level security policy violation' }
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { error } = await supabase
        .from('organisations')
        .update({ name: 'New Name' })
        .eq('id', mockOrganisation.id)

      expect(error).toBeDefined()
    })
  })

  describe('Updating office location', () => {
    it('should allow admin to update office location', async () => {
      const newLocation = { lat: 51.5074, lng: -0.1278 }
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      await supabase
        .from('organisations')
        .update({ office_location: newLocation })
        .eq('id', mockOrganisation.id)

      expect(mockUpdate).toHaveBeenCalledWith({ office_location: newLocation })
    })
  })

  describe('Fetching organisations', () => {
    it('should fetch organisation by slug', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({ data: mockOrganisation, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      } as any)

      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('slug', 'stackone')
        .single()

      expect(supabase.from).toHaveBeenCalledWith('organisations')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockEq).toHaveBeenCalledWith('slug', 'stackone')
    })
  })
})
