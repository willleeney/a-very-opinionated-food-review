import { create } from 'zustand'

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
