import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

export interface PhotoUploadHandle {
  getCroppedBlob: () => Promise<Blob | null>
  hasNewPhoto: boolean
  reset: () => void
}

interface PhotoUploadProps {
  initialPreview?: string | null
  onError?: (message: string) => void
}

export const PhotoUpload = forwardRef<PhotoUploadHandle, PhotoUploadProps>(
  function PhotoUpload({ initialPreview = null, onError }, ref) {
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(initialPreview)
    const [dragOver, setDragOver] = useState(false)
    const [photoZoom, setPhotoZoom] = useState(1)
    const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [minZoom, setMinZoom] = useState(1)
    const [showCropEditor, setShowCropEditor] = useState(false)
    const [photoNaturalSize, setPhotoNaturalSize] = useState({ w: 0, h: 0 })
    const cropOverlayMouseDownTarget = useRef<EventTarget | null>(null)
    const photoContainerRef = useRef<HTMLDivElement>(null)
    const photoInputRef = useRef<HTMLInputElement>(null)
    const editorContainerWidthRef = useRef(368)

    // Sync initialPreview when review changes (only if no new file selected)
    useEffect(() => {
      if (!photoFile) {
        setPhotoPreview(initialPreview)
      }
    }, [initialPreview])

    const removePhoto = () => {
      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoZoom(1)
      setPhotoPan({ x: 0, y: 0 })
      setMinZoom(1)
      setPhotoNaturalSize({ w: 0, h: 0 })
      setShowCropEditor(false)
    }

    const handlePhotoSelect = (file: File) => {
      if (!file.type.startsWith('image/')) {
        onError?.('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        onError?.('Image must be under 5MB')
        return
      }
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      setPhotoNaturalSize({ w: 0, h: 0 })
      setPhotoZoom(1)
      setPhotoPan({ x: 0, y: 0 })
      setShowCropEditor(true)
    }

    const handlePhotoDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handlePhotoSelect(file)
    }

    const handlePhotoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      const container = photoContainerRef.current
      if (!container) return
      const containerSize = container.offsetWidth
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      const containZoom = Math.min(containerSize / nw, containerSize / nh)
      setPhotoNaturalSize({ w: nw, h: nh })
      setMinZoom(containZoom)
      // Only set default zoom/pan on first load
      if (photoNaturalSize.w === 0) {
        setPhotoZoom(containZoom)
        const scaledW = nw * containZoom
        const scaledH = nh * containZoom
        setPhotoPan({
          x: scaledW < containerSize ? (containerSize - scaledW) / 2 : 0,
          y: scaledH < containerSize ? (containerSize - scaledH) / 2 : 0,
        })
      }
    }

    const clampPan = (pan: { x: number; y: number }, zoom: number) => {
      const container = photoContainerRef.current
      if (!container || !photoNaturalSize.w) return pan
      const cs = container.offsetWidth
      const scaledW = photoNaturalSize.w * zoom
      const scaledH = photoNaturalSize.h * zoom
      let x = pan.x
      let y = pan.y
      if (scaledW <= cs) {
        x = (cs - scaledW) / 2
      } else {
        x = Math.min(0, Math.max(cs - scaledW, x))
      }
      if (scaledH <= cs) {
        y = (cs - scaledH) / 2
      } else {
        y = Math.min(0, Math.max(cs - scaledH, y))
      }
      return { x, y }
    }

    const handleCropMouseDown = (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - photoPan.x, y: e.clientY - photoPan.y })
    }

    const handleCropTouchStart = (e: React.TouchEvent) => {
      const t = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: t.clientX - photoPan.x, y: t.clientY - photoPan.y })
    }

    useEffect(() => {
      if (!isDragging) return
      const handleMove = (clientX: number, clientY: number) => {
        const newPan = { x: clientX - dragStart.x, y: clientY - dragStart.y }
        setPhotoPan(clampPan(newPan, photoZoom))
      }
      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
      const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY)
      const onEnd = () => setIsDragging(false)
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onEnd)
      document.addEventListener('touchmove', onTouchMove)
      document.addEventListener('touchend', onEnd)
      return () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onEnd)
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onEnd)
      }
    }, [isDragging, dragStart, photoZoom, photoNaturalSize])

    const handleZoomChange = (newZoom: number) => {
      const container = photoContainerRef.current
      if (container && photoNaturalSize.w) {
        const cs = container.offsetWidth
        const cx = cs / 2
        const cy = cs / 2
        const oldZoom = photoZoom
        const imgX = (cx - photoPan.x) / oldZoom
        const imgY = (cy - photoPan.y) / oldZoom
        const newPan = { x: cx - imgX * newZoom, y: cy - imgY * newZoom }
        setPhotoZoom(newZoom)
        setPhotoPan(clampPan(newPan, newZoom))
      } else {
        setPhotoZoom(newZoom)
      }
    }

    const drawCropToCanvas = (canvasSize: number, imgEl: HTMLImageElement, containerWidth: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvasSize
      canvas.height = canvasSize
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvasSize, canvasSize)
      const scale = canvasSize / containerWidth
      const dx = photoPan.x * scale
      const dy = photoPan.y * scale
      const dw = imgEl.naturalWidth * photoZoom * scale
      const dh = imgEl.naturalHeight * photoZoom * scale
      ctx.drawImage(imgEl, 0, 0, imgEl.naturalWidth, imgEl.naturalHeight, dx, dy, dw, dh)
      return canvas
    }

    const getCroppedBlob = (): Promise<Blob | null> => {
      if (!photoPreview || !photoNaturalSize.w) return Promise.resolve(null)
      return new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          const canvas = drawCropToCanvas(800, img, editorContainerWidthRef.current)
          if (!canvas) return resolve(null)
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9)
        }
        img.onerror = () => resolve(null)
        img.src = photoPreview
      })
    }

    const saveCropAndClose = () => {
      const container = photoContainerRef.current
      if (container) {
        editorContainerWidthRef.current = container.offsetWidth
      }
      setShowCropEditor(false)
    }

    useImperativeHandle(ref, () => ({
      getCroppedBlob,
      get hasNewPhoto() { return !!photoFile },
      reset: removePhoto,
    }))

    return (
      <>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePhotoSelect(file)
          }}
        />
        {photoPreview ? (
          <div
            className="receipt-photo-zone has-photo"
            onClick={() => { if (photoFile) setShowCropEditor(true) }}
            style={{ cursor: photoFile ? 'pointer' : 'default', background: '#000' }}
          >
            {photoFile && photoNaturalSize.w > 0 ? (
              <img
                src={photoPreview}
                alt="Preview"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${(photoNaturalSize.w * photoZoom / editorContainerWidthRef.current) * 100}%`,
                  height: `${(photoNaturalSize.h * photoZoom / editorContainerWidthRef.current) * 100}%`,
                  marginLeft: `${(photoPan.x / editorContainerWidthRef.current) * 100}%`,
                  marginTop: `${(photoPan.y / editorContainerWidthRef.current) * 100}%`,
                }}
              />
            ) : (
              <img src={photoPreview} alt="Preview" />
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removePhoto() }}
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: '18px',
                textAlign: 'center',
                padding: 0
              }}
            >
              &times;
            </button>
          </div>
        ) : (
          <div
            className={`receipt-photo-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => photoInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handlePhotoDrop}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" style={{ marginBottom: '2px' }}>
              <rect x="3" y="3" width="18" height="18" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <div className="hint">Drop photo or click</div>
          </div>
        )}

        {/* Crop editor overlay */}
        {showCropEditor && photoPreview && (
          <div
            className="modal-overlay"
            style={{ zIndex: 10001 }}
            onMouseDown={(e) => { cropOverlayMouseDownTarget.current = e.target }}
            onClick={(e) => { if (e.target === e.currentTarget && cropOverlayMouseDownTarget.current === e.currentTarget) { saveCropAndClose() } }}
          >
            <div style={{
              background: '#1a1a1a',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px',
            }}>
              <div
                ref={photoContainerRef}
                className="receipt-photo-crop"
                style={{ width: '100%', maxWidth: '368px', background: '#000' }}
                onMouseDown={handleCropMouseDown}
                onTouchStart={handleCropTouchStart}
              >
                <img
                  src={photoPreview}
                  alt="Crop preview"
                  onLoad={handlePhotoLoad}
                  style={{
                    width: photoNaturalSize.w * photoZoom + 'px',
                    height: photoNaturalSize.h * photoZoom + 'px',
                    transform: `translate(${photoPan.x}px, ${photoPan.y}px)`,
                  }}
                  draggable={false}
                />
              </div>
              <div style={{ width: '100%', maxWidth: '368px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zoom</span>
                <input
                  type="range"
                  min={minZoom}
                  max={minZoom * 2.5}
                  step={0.01}
                  value={photoZoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="receipt-btn"
                  style={{ color: '#ccc', borderColor: '#555' }}
                  onClick={removePhoto}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="receipt-btn primary"
                  onClick={saveCropAndClose}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
)
