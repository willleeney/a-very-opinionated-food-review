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
  if (rating >= 6) return '#b8860b'
  return '#a64d4d'
}

export function RatingHistogram({ restaurants }: RatingHistogramProps): JSX.Element {
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Rating Distribution</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          {totalReviewed} reviewed
        </span>
      </div>

      {/* Horizontal histogram - bars grow upward */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '120px',
        gap: '4px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)'
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => {
          const count = distribution[rating]
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

          return (
            <div
              key={rating}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end'
              }}
            >
              {/* Count label above bar */}
              {count > 0 && (
                <span
                  className="mono"
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '4px'
                  }}
                >
                  {count}
                </span>
              )}

              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '32px',
                  height: `${percentage}%`,
                  minHeight: count > 0 ? '4px' : '0',
                  background: getRatingColor(rating),
                  opacity: count > 0 ? 1 : 0.15,
                  transition: 'height 0.5s ease',
                  borderRadius: '2px 2px 0 0'
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Rating labels below */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '4px',
        marginTop: '8px'
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => (
          <div
            key={rating}
            style={{
              flex: 1,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
              {rating}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {ratingLabels[rating]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
