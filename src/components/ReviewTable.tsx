import { Fragment, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'
import { formatDistance } from '../lib/distance'

interface ReviewTableProps {
  restaurants: RestaurantWithReviews[]
}

type SortKey = 'name' | 'type' | 'distance' | 'avgRating'
type SortDir = 'asc' | 'desc'

const ratingLabels: Record<number, string> = {
  1: 'Worst',
  2: 'Terrible',
  3: 'Bad',
  4: 'Poor',
  5: 'Average',
  6: 'Ok',
  7: 'Good',
  8: 'Great',
  9: 'Amazing',
  10: 'Perfect',
}

function getRatingClass(rating: number): string {
  if (rating >= 8) return 'rating-great'
  if (rating >= 6) return 'rating-good'
  return 'rating-poor'
}

export function ReviewTable({ restaurants }: ReviewTableProps): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('avgRating')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { selectedUserIds, selectedRating, selectedBounds, highlightedRestaurantId, setHighlightedRestaurantId } = useFilterStore()

  const filteredAndSorted = useMemo(() => {
    let filtered = restaurants.filter((r) => {
      if (selectedUserIds.length > 0 && !r.reviews.some((rev) => rev.user_id && selectedUserIds.includes(rev.user_id))) {
        return false
      }
      if (selectedRating !== null) {
        const avg = r.avgRating
        if (avg === null || Math.round(avg) !== selectedRating) return false
      }
      if (selectedBounds) {
        const [west, south, east, north] = selectedBounds
        if (
          r.latitude === null ||
          r.longitude === null ||
          r.longitude < west ||
          r.longitude > east ||
          r.latitude < south ||
          r.latitude > north
        ) {
          return false
        }
      }
      return true
    })

    return filtered.sort((a, b) => {
      let aVal: string | number | null
      let bVal: string | number | null

      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'type':
          aVal = a.type.toLowerCase()
          bVal = b.type.toLowerCase()
          break
        case 'distance':
          aVal = a.distance
          bVal = b.distance
          break
        case 'avgRating':
          aVal = a.avgRating
          bVal = b.avgRating
          break
      }

      if (aVal === null) return 1
      if (bVal === null) return -1
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [restaurants, selectedUserIds, selectedRating, selectedBounds, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'avgRating' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span className={`ml-1.5 transition-colors ${active ? 'text-purple-400' : 'text-white/20'}`}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="glass-table">
          <thead>
            <tr>
              {[
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'distance', label: 'Distance' },
                { key: 'avgRating', label: 'Rating' },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key as SortKey)}
                  className="cursor-pointer hover:text-white/60 transition-colors select-none"
                >
                  {label}
                  <SortIcon active={sortKey === key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filteredAndSorted.map((restaurant, index) => (
                <Fragment key={restaurant.id}>
                  <motion.tr
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => setExpandedId(expandedId === restaurant.id ? null : restaurant.id)}
                    onMouseEnter={() => setHighlightedRestaurantId(restaurant.id)}
                    onMouseLeave={() => setHighlightedRestaurantId(null)}
                    className={`cursor-pointer transition-all duration-200 ${
                      highlightedRestaurantId === restaurant.id
                        ? 'bg-purple-500/10'
                        : ''
                    }`}
                  >
                    <td>
                      <div className="font-semibold text-white tracking-tight">{restaurant.name}</div>
                    </td>
                    <td className="text-white/60 font-medium">
                      {restaurant.type}
                    </td>
                    <td className="font-mono text-white/60 text-sm">
                      {formatDistance(restaurant.distance)}
                    </td>
                    <td>
                      {restaurant.avgRating !== null ? (
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${getRatingClass(restaurant.avgRating)}`}>
                          <span className="font-mono">{restaurant.avgRating.toFixed(1)}</span>
                          <span className="mx-1.5 opacity-50">•</span>
                          {ratingLabels[Math.round(restaurant.avgRating)]}
                        </span>
                      ) : (
                        <span className="text-white/30 font-mono">—</span>
                      )}
                    </td>
                  </motion.tr>

                  <AnimatePresence>
                    {expandedId === restaurant.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={4} className="!p-0">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 bg-white/[0.02] border-t border-white/5"
                          >
                            {restaurant.notes && (
                              <p className="text-white/50 text-sm mb-3">
                                <span className="text-white/70 font-medium">Notes:</span> {restaurant.notes}
                              </p>
                            )}
                            {restaurant.reviews.length > 0 ? (
                              <div>
                                <span className="text-white/60 font-semibold text-xs uppercase tracking-wider">Reviews</span>
                                <div className="mt-3 space-y-2">
                                  {restaurant.reviews.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).map((review) => (
                                    <div key={review.id} className="flex items-center gap-3 text-sm">
                                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono ${
                                        review.rating && review.rating >= 8 ? 'rating-great' :
                                        review.rating && review.rating >= 6 ? 'rating-good' : 'rating-poor'
                                      }`}>
                                        {review.rating}/10
                                      </span>
                                      {review.comment && (
                                        <span className="text-white/50 font-medium">{review.comment}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-white/30 text-sm font-medium">No reviews yet</p>
                            )}
                          </motion.div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))}
            </AnimatePresence>

            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-white/30">
                  No restaurants match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
