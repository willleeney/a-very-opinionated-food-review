interface RatingSliderProps {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  compact?: boolean
}

export function RatingSlider({ label, value, onChange, compact = false }: RatingSliderProps) {
  // Convert value (1-10 or null) to slider value (0-10, where 0 = "Any")
  const sliderValue = value ?? 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value)
    onChange(val === 0 ? null : val)
  }

  const getDisplayValue = (v: number | null): string => {
    if (v === null || v === 0) return 'Any'
    return `${v}+`
  }

  // Calculate fill - goes from slider position to RIGHT (showing valid ratings)
  const fillPercent = (sliderValue / 10) * 100

  if (compact) {
    return (
      <div className="slider-container compact">
        <div className="slider-wrapper">
          <div className="slider-fill-bg" style={{ left: `${fillPercent}%`, right: 0, width: 'auto' }} />
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={sliderValue}
            onChange={handleChange}
            className="slider-input"
          />
        </div>
        <span className="slider-value-inline">{getDisplayValue(value)}</span>
      </div>
    )
  }

  return (
    <div className="slider-container">
      <label className="slider-label">{label}</label>
      <div className="slider-wrapper">
        <div className="slider-fill-bg" style={{ left: `${fillPercent}%`, right: 0, width: 'auto' }} />
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={sliderValue}
          onChange={handleChange}
          className="slider-input"
        />
      </div>
      <div className="slider-labels">
        <span>Any</span>
        <span className="slider-value">{getDisplayValue(value)}</span>
        <span>10</span>
      </div>
    </div>
  )
}
