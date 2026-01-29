import { create } from 'zustand'
import type { Organisation, OrganisationWithMembership, OfficeLocation } from './database.types'

export interface FilterState {
  selectedUserId: string | null
  selectedRating: number | null
  selectedBounds: [number, number, number, number] | null // [west, south, east, north]
  highlightedRestaurantId: string | null

  setSelectedUserId: (userId: string | null) => void
  setSelectedRating: (rating: number | null) => void
  setSelectedBounds: (bounds: [number, number, number, number] | null) => void
  setHighlightedRestaurantId: (id: string | null) => void
  clearFilters: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedUserId: null,
  selectedRating: null,
  selectedBounds: null,
  highlightedRestaurantId: null,

  setSelectedUserId: (userId) => set({ selectedUserId: userId }),
  setSelectedRating: (rating) => set({ selectedRating: rating }),
  setSelectedBounds: (bounds) => set({ selectedBounds: bounds }),
  setHighlightedRestaurantId: (id) => set({ highlightedRestaurantId: id }),
  clearFilters: () => set({
    selectedUserId: null,
    selectedRating: null,
    selectedBounds: null,
    highlightedRestaurantId: null,
  }),
}))

// Organisation store for managing current org context
export interface OrgState {
  currentOrg: Organisation | null
  currentOrgMembership: OrganisationWithMembership | null
  userOrgs: OrganisationWithMembership[]
  officeLocation: OfficeLocation | null

  setCurrentOrg: (org: Organisation | null) => void
  setCurrentOrgMembership: (membership: OrganisationWithMembership | null) => void
  setUserOrgs: (orgs: OrganisationWithMembership[]) => void
  setOfficeLocation: (location: OfficeLocation | null) => void
  clearOrgState: () => void
}

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: null,
  currentOrgMembership: null,
  userOrgs: [],
  officeLocation: null,

  setCurrentOrg: (org) => set({ currentOrg: org }),
  setCurrentOrgMembership: (membership) => set({ currentOrgMembership: membership }),
  setUserOrgs: (orgs) => set({ userOrgs: orgs }),
  setOfficeLocation: (location) => set({ officeLocation: location }),
  clearOrgState: () => set({
    currentOrg: null,
    currentOrgMembership: null,
    userOrgs: [],
    officeLocation: null,
  }),
}))
