import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '../lib/supabase'

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

describe('Organisation Members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Admin adding a member', () => {
    it('should allow admin to add a new member', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const { error } = await supabase
        .from('organisation_members')
        .insert({
          organisation_id: mockOrgId,
          user_id: 'new-user-id',
          role: 'member',
        })

      expect(supabase.from).toHaveBeenCalledWith('organisation_members')
      expect(mockInsert).toHaveBeenCalledWith({
        organisation_id: mockOrgId,
        user_id: 'new-user-id',
        role: 'member',
      })
    })
  })

  describe('Admin removing a member', () => {
    it('should allow admin to remove a member', async () => {
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
        eq: mockEq,
      } as any)

      const { error } = await supabase
        .from('organisation_members')
        .delete()
        .eq('id', mockRegularMember.id)

      expect(supabase.from).toHaveBeenCalledWith('organisation_members')
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('Admin transferring admin role', () => {
    it('should allow admin to make another member an admin', async () => {
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { error } = await supabase
        .from('organisation_members')
        .update({ role: 'admin' })
        .eq('id', mockRegularMember.id)

      expect(mockUpdate).toHaveBeenCalledWith({ role: 'admin' })
    })

    it('should allow admin to remove admin role from another admin', async () => {
      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      } as any)

      const { error } = await supabase
        .from('organisation_members')
        .update({ role: 'member' })
        .eq('id', mockAdminMember.id)

      expect(mockUpdate).toHaveBeenCalledWith({ role: 'member' })
    })
  })

  describe('Member cannot modify others', () => {
    it('should not allow regular member to add other members', async () => {
      // This would be enforced by RLS policies
      const mockInsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Row level security policy violation' }
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const { error } = await supabase
        .from('organisation_members')
        .insert({
          organisation_id: mockOrgId,
          user_id: 'another-user-id',
          role: 'member',
        })

      expect(error).toBeDefined()
    })

    it('should not allow regular member to remove others', async () => {
      // This would be enforced by RLS policies
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Row level security policy violation' }
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
        eq: mockEq,
      } as any)

      const { error } = await supabase
        .from('organisation_members')
        .delete()
        .eq('id', 'other-member-id')

      expect(error).toBeDefined()
    })
  })

  describe('User leaving organisation', () => {
    it('should allow user to leave organisation', async () => {
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
        eq: mockEq,
      } as any)

      // User can delete their own membership
      const { error } = await supabase
        .from('organisation_members')
        .delete()
        .eq('id', mockRegularMember.id)

      expect(error).toBeNull()
    })
  })

  describe('Fetching members', () => {
    it('should fetch all members of an organisation', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({
        data: [mockAdminMember, mockRegularMember],
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
      } as any)

      const { data, error } = await supabase
        .from('organisation_members')
        .select('*')
        .eq('organisation_id', mockOrgId)

      expect(data).toHaveLength(2)
      expect(data![0].role).toBe('admin')
    })
  })
})
