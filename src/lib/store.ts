import { create } from 'zustand'
import type { Organisation, OrganisationWithMembership, OfficeLocation, RestaurantCategory, SocialFilter } from './database.types'

export interface FilterState {
  // Existing filters
  selectedUserIds: string[]
  selectedRating: number | null
  selectedBounds: [number, number, number, number] | null // [west, south, east, north]
  highlightedRestaurantId: string | null

  // New filters
  selectedCategories: RestaurantCategory[]
  minOverallRating: number | null
  minValueRating: number | null
  minTasteRating: number | null
  socialFilter: SocialFilter

  // Existing actions
  setSelectedUserIds: (userIds: string[]) => void
  toggleSelectedUserId: (userId: string) => void
  setSelectedRating: (rating: number | null) => void
  setSelectedBounds: (bounds: [number, number, number, number] | null) => void
  setHighlightedRestaurantId: (id: string | null) => void

  // New actions
  setSelectedCategories: (categories: RestaurantCategory[]) => void
  toggleCategory: (category: RestaurantCategory) => void
  setMinOverallRating: (rating: number | null) => void
  setMinValueRating: (rating: number | null) => void
  setMinTasteRating: (rating: number | null) => void
  setSocialFilter: (filter: SocialFilter) => void

  clearFilters: () => void
  hasActiveFilters: () => boolean
}

export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
  selectedUserIds: [],
  selectedRating: null,
  selectedBounds: null,
  highlightedRestaurantId: null,
  selectedCategories: [],
  minOverallRating: null,
  minValueRating: null,
  minTasteRating: null,
  socialFilter: 'everyone',

  // Existing actions
  setSelectedUserIds: (userIds) => set({ selectedUserIds: userIds }),
  toggleSelectedUserId: (userId) => set((state) => ({
    selectedUserIds: state.selectedUserIds.includes(userId)
      ? state.selectedUserIds.filter(id => id !== userId)
      : [...state.selectedUserIds, userId]
  })),
  setSelectedRating: (rating) => set({ selectedRating: rating }),
  setSelectedBounds: (bounds) => set({ selectedBounds: bounds }),
  setHighlightedRestaurantId: (id) => set({ highlightedRestaurantId: id }),

  // New actions
  setSelectedCategories: (categories) => set({ selectedCategories: categories }),
  toggleCategory: (category) => set((state) => ({
    selectedCategories: state.selectedCategories.includes(category)
      ? state.selectedCategories.filter((c) => c !== category)
      : [...state.selectedCategories, category]
  })),
  setMinOverallRating: (rating) => set({ minOverallRating: rating }),
  setMinValueRating: (rating) => set({ minValueRating: rating }),
  setMinTasteRating: (rating) => set({ minTasteRating: rating }),
  setSocialFilter: (filter) => set({ socialFilter: filter }),

  clearFilters: () => set({
    selectedUserIds: [],
    selectedRating: null,
    selectedBounds: null,
    highlightedRestaurantId: null,
    selectedCategories: [],
    minOverallRating: null,
    minValueRating: null,
    minTasteRating: null,
    socialFilter: 'everyone',
  }),

  hasActiveFilters: () => {
    const state = get()
    return (
      state.selectedCategories.length > 0 ||
      state.minOverallRating !== null ||
      state.minValueRating !== null ||
      state.minTasteRating !== null ||
      state.socialFilter !== 'everyone' ||
      state.selectedUserIds.length > 0
    )
  },
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
