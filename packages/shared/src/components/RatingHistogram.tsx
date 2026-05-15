import { useMemo } from 'react'
import type { RestaurantWithReviews } from '../lib/database.types'

interface RatingHistogramProps {
  restaurants: RestaurantWithReviews[]
}

const ratingLabels: Record<number, string> = {
  1: 'Avoid',
  2: 'Poor',
  3: 'Bad',
  4: 'Meh',
  5: 'Ok',
  6: 'Decent',
  7: 'Good',
  8: 'Great',
  9: 'Excellent',
  10: 'Perfect',
}

function getRatingColor(rating: number): string {
  if (rating >= 8) return '#2d7a4f'
  if (rating >= 6) return '#5a8a3c'
  return '#a64d4d'
}

export function RatingHistogram({ restaurants }: RatingHistogramProps) {
  const distribution = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let i = 1; i <= 10; i++) counts[i] = 0

    restaurants.forEach(r => {
      if (r.avgRating !== null) {
        const bucket = Math.round(r.avgRating)
        if (bucket >= 1 && bucket <= 10) {
          counts[bucket]++
        }
      }
    })

    return counts
  }, [restaurants])

  const maxCount = Math.max(...Object.values(distribution), 1)
  const totalReviewed = Object.values(distribution).reduce((a, b) => a + b, 0)

  return (
    <div data-testid="rating-histogram">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Rating Distribution</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          {totalReviewed} reviewed
        </span>
      </div>

      {/* Histogram — bars + labels in unified columns for perfect alignment */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gap: '3px',
        overflow: 'hidden',
        padding: '0 2px',
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => {
          const count = distribution[rating]
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

          return (
            <div
              key={rating}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Bar area */}
              <div style={{
                height: '100px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}>
                {count > 0 && (
                  <span
                    className="mono"
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginBottom: '3px',
                      lineHeight: 1,
                    }}
                  >
                    {count}
                  </span>
                )}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '28px',
                    height: `${percentage}%`,
                    minHeight: count > 0 ? '4px' : '0',
                    background: getRatingColor(rating),
                    opacity: count > 0 ? 1 : 0.15,
                    transition: 'height 0.5s ease',
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              </div>

              {/* Divider */}
              <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />

              {/* Label */}
              <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, marginTop: '6px', lineHeight: 1 }}>
                {rating}
              </span>
              <span className="histogram-labels" style={{ fontSize: '7px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.01em', marginTop: '2px', lineHeight: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ratingLabels[rating]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
