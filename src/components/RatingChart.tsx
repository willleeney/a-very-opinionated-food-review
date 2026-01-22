import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface RatingChartProps {
  restaurants: RestaurantWithReviews[]
}

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

// Gradient colors from red to green
const ratingColors = [
  'rgba(239, 68, 68, 0.8)',   // 1 - red
  'rgba(249, 115, 22, 0.8)',  // 2 - orange
  'rgba(245, 158, 11, 0.8)',  // 3 - amber
  'rgba(234, 179, 8, 0.8)',   // 4 - yellow
  'rgba(163, 230, 53, 0.8)',  // 5 - lime
  'rgba(132, 204, 22, 0.8)',  // 6 - lime-green
  'rgba(34, 197, 94, 0.8)',   // 7 - green
  'rgba(16, 185, 129, 0.8)',  // 8 - emerald
  'rgba(6, 182, 212, 0.8)',   // 9 - cyan
  'rgba(168, 85, 247, 0.8)',  // 10 - purple (perfect!)
]

const ratingBorderColors = [
  'rgba(239, 68, 68, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(234, 179, 8, 1)',
  'rgba(163, 230, 53, 1)',
  'rgba(132, 204, 22, 1)',
  'rgba(34, 197, 94, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(6, 182, 212, 1)',
  'rgba(168, 85, 247, 1)',
]

export function RatingChart({ restaurants }: RatingChartProps): JSX.Element {
  const { selectedUserId, selectedBounds, selectedRating, setSelectedRating } = useFilterStore()

  const chartData = useMemo(() => {
    const counts = new Array(10).fill(0)

    restaurants.forEach((r) => {
      if (selectedUserId && !r.reviews.some((rev) => rev.user_id === selectedUserId)) {
        return
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
          return
        }
      }

      if (r.avgRating !== null) {
        const bucket = Math.min(Math.max(Math.round(r.avgRating), 1), 10) - 1
        counts[bucket]++
      }
    })

    return {
      labels: Array.from({ length: 10 }, (_, i) => ratingLabels[i + 1]),
      datasets: [
        {
          label: 'Restaurants',
          data: counts,
          backgroundColor: ratingColors.map((color, i) =>
            selectedRating === i + 1 ? color : color.replace('0.8', '0.4')
          ),
          borderColor: ratingBorderColors,
          borderWidth: 1,
          borderRadius: 6,
          hoverBackgroundColor: ratingColors,
        },
      ],
    }
  }, [restaurants, selectedUserId, selectedBounds, selectedRating])

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(5, 5, 8, 0.95)',
        titleColor: 'rgba(255, 255, 255, 0.95)',
        bodyColor: 'rgba(255, 255, 255, 0.7)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 10,
        displayColors: false,
        titleFont: {
          family: "'Space Grotesk', sans-serif",
          weight: 600 as const,
          size: 13,
        },
        bodyFont: {
          family: "'JetBrains Mono', monospace",
          weight: 500 as const,
          size: 12,
        },
        callbacks: {
          title: (items: any[]) => {
            const idx = items[0].dataIndex + 1
            return `${idx}/10 - ${ratingLabels[idx]}`
          },
          label: (item: any) => `${item.raw} restaurant${item.raw !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.02)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.35)',
          stepSize: 1,
          font: {
            family: "'JetBrains Mono', monospace",
            weight: 500 as const,
            size: 10,
          },
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: {
            family: "'Space Grotesk', sans-serif",
            weight: 600 as const,
            size: 11,
          },
        },
      },
    },
    onClick: (_event: unknown, elements: { index: number }[]) => {
      if (elements.length === 0) return
      const clickedRating = elements[0].index + 1
      setSelectedRating(selectedRating === clickedRating ? null : clickedRating)
    },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-white tracking-tight">Rating Distribution</h3>
        {selectedRating && (
          <button
            onClick={() => setSelectedRating(null)}
            className="text-xs text-white/50 hover:text-white/80 transition-colors font-semibold uppercase tracking-wide"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="h-[320px]">
        <Bar data={chartData} options={options} />
      </div>
      <p className="text-xs text-white/25 mt-4 text-center font-medium uppercase tracking-wider">Click a bar to filter</p>
    </motion.div>
  )
}
