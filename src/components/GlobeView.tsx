import { useEffect, useRef, useMemo, useState } from 'react'
import createGlobe from 'cobe'
import type { RestaurantWithReviews } from '../lib/database.types'
import { useFilterStore } from '../lib/store'

interface GlobeViewProps {
  restaurants: RestaurantWithReviews[]
}

// Runway East London Bridge
const OFFICE_LAT = 51.5045
const OFFICE_LNG = -0.0865

// Convert lat/lng to globe coordinates (phi/theta)
function locationToAngles(lat: number, lng: number): [number, number] {
  return [
    Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2),
    (lat * Math.PI) / 180
  ]
}

function getRatingColor(rating: number | null): [number, number, number] {
  if (rating === null) return [0.5, 0.5, 0.6]
  if (rating >= 8) return [0.2, 0.95, 0.6] // bright emerald
  if (rating >= 6) return [1, 0.75, 0.2] // warm amber
  return [1, 0.35, 0.35] // soft red
}

export function GlobeView({ restaurants }: GlobeViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<number | null>(null)
  const pointerInteractionMovement = useRef(0)
  const phiRef = useRef(0)
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null)

  const { highlightedRestaurantId } = useFilterStore()

  // Prepare markers - make them bigger and more visible
  const markers = useMemo(() => {
    const points: Array<{ location: [number, number]; size: number; color: [number, number, number] }> = []

    // Add restaurants
    restaurants
      .filter(r => r.latitude !== null && r.longitude !== null)
      .forEach(restaurant => {
        const isHighlighted = highlightedRestaurantId === restaurant.id
        points.push({
          location: [restaurant.latitude!, restaurant.longitude!],
          size: isHighlighted ? 0.15 : 0.08,
          color: getRatingColor(restaurant.avgRating)
        })
      })

    // Add office marker (purple pulse)
    points.push({
      location: [OFFICE_LAT, OFFICE_LNG],
      size: 0.12,
      color: [0.66, 0.33, 0.97]
    })

    return points
  }, [restaurants, highlightedRestaurantId])

  useEffect(() => {
    if (!canvasRef.current) return

    let width = 0
    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth
      }
    }
    window.addEventListener('resize', onResize)
    onResize()

    // Focus tightly on London
    const [focusPhi, focusTheta] = locationToAngles(OFFICE_LAT, OFFICE_LNG)
    phiRef.current = focusPhi

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: 500 * 2,
      phi: focusPhi,
      theta: focusTheta - 0.15, // Tilt to see London better
      dark: 1,
      diffuse: 3,
      mapSamples: 40000, // Higher detail
      mapBrightness: 6,
      baseColor: [0.08, 0.08, 0.12],
      markerColor: [0.66, 0.33, 0.97],
      glowColor: [0.15, 0.1, 0.25],
      scale: 4.5, // Zoomed in on London!
      offset: [0, 0],
      markers,
      onRender: (state) => {
        // Slow auto-rotate when not interacting
        if (!pointerInteracting.current) {
          phiRef.current += 0.001
        }
        state.phi = phiRef.current + pointerInteractionMovement.current
        state.width = width * 2
        state.height = 500 * 2
        state.scale = scaleRef.current * 4.5
      }
    })

    globeRef.current = globe

    // Interaction handlers
    const handlePointerDown = (e: PointerEvent) => {
      pointerInteracting.current = e.clientX - pointerInteractionMovement.current
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    }

    const handlePointerUp = () => {
      pointerInteracting.current = null
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    }

    const handlePointerOut = () => {
      pointerInteracting.current = null
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        const delta = e.clientX - pointerInteracting.current
        pointerInteractionMovement.current = delta / 200 // Slower rotation
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY * -0.002
      scaleRef.current = Math.min(Math.max(scaleRef.current + delta, 0.5), 3)
      setScale(scaleRef.current)
    }

    const canvas = canvasRef.current
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerout', handlePointerOut)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      globe.destroy()
      globeRef.current = null
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerout', handlePointerOut)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [markers])

  const handleZoom = (direction: 'in' | 'out') => {
    const delta = direction === 'in' ? 0.3 : -0.3
    scaleRef.current = Math.min(Math.max(scaleRef.current + delta, 0.5), 3)
    setScale(scaleRef.current)
  }

  return (
    <div className="globe-wrapper">
      <div className="globe-container glass">
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 500,
            cursor: 'grab',
            contain: 'layout paint size',
          }}
        />

        {/* Zoom controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button
            onClick={() => handleZoom('in')}
            className="w-10 h-10 glass-subtle flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all text-xl font-bold"
          >
            +
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="w-10 h-10 glass-subtle flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all text-xl font-bold"
          >
            −
          </button>
        </div>

        {/* Location badge */}
        <div className="absolute top-4 left-4 glass-subtle px-4 py-2 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
          <span className="text-xs font-bold text-white/80 uppercase tracking-wider">London Bridge</span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 glass-subtle p-4">
          <div className="text-[10px] font-bold text-white/50 mb-3 uppercase tracking-widest">Rating</div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgb(51, 242, 153)', boxShadow: '0 0 10px rgb(51, 242, 153)' }}></div>
              <span className="text-white/60 font-semibold">8-10</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgb(255, 191, 51)', boxShadow: '0 0 10px rgb(255, 191, 51)' }}></div>
              <span className="text-white/60 font-semibold">6-7</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgb(255, 89, 89)', boxShadow: '0 0 10px rgb(255, 89, 89)' }}></div>
              <span className="text-white/60 font-semibold">1-5</span>
            </div>
          </div>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-4 right-4 glass-subtle px-3 py-2">
          <span className="text-[10px] font-mono text-white/40">{(scale * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}
