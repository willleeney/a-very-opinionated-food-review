import { motion } from 'framer-motion'
import { useFilterStore } from '../lib/store'

interface User {
  id: string
  email: string
}

interface FilterBarProps {
  users: User[]
}

export function FilterBar({ users }: FilterBarProps): JSX.Element {
  const {
    selectedUserId,
    selectedRating,
    selectedBounds,
    setSelectedUserId,
    clearFilters,
  } = useFilterStore()

  const hasFilters = selectedUserId || selectedRating || selectedBounds
  const activeFilterCount = [selectedUserId, selectedRating, selectedBounds].filter(Boolean).length

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-wrap items-center gap-4"
    >
      {/* User filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="user-filter" className="text-sm text-white/50">
          Reviewer
        </label>
        <select
          id="user-filter"
          value={selectedUserId || ''}
          onChange={(e) => setSelectedUserId(e.target.value || null)}
          className="min-w-[140px]"
        >
          <option value="">All reviewers</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email.split('@')[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Active filters indicator */}
      {hasFilters && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-2">
            {selectedRating && (
              <span className="px-3 py-1 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                Rating: {selectedRating}
              </span>
            )}
            {selectedBounds && (
              <span className="px-3 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                Map region
              </span>
            )}
            {selectedUserId && (
              <span className="px-3 py-1 text-xs font-medium bg-pink-500/20 text-pink-300 rounded-full border border-pink-500/30">
                Filtered by user
              </span>
            )}
          </div>

          <button
            onClick={clearFilters}
            className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <span>Clear {activeFilterCount > 1 ? 'all' : ''}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}
