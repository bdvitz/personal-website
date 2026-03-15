'use client'

import { useRef, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'

const HANDLE_SIZE = 12
const MIN_CROP = 20
const DISPLAY_MAX_W = 560
const DISPLAY_MAX_H = 420

type Rect = { x: number; y: number; w: number; h: number }
type Corner = 'nw' | 'ne' | 'sw' | 'se'
type DragMode =
  | { type: 'move'; startX: number; startY: number; origRect: Rect }
  | { type: 'resize'; corner: Corner; startX: number; startY: number; origRect: Rect }
  | null

interface Props {
  imageUrl: string
  onApply: (croppedUrl: string) => void
  onSkip: () => void
}

export default function ImageCropper({ imageUrl, onApply, onSkip }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<DragMode>(null)
  const scaleRef = useRef(1)

  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null)
  const [cropRect, setCropRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 })

  // Load image, compute display size, initialize crop to full image
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const s = Math.min(DISPLAY_MAX_W / img.naturalWidth, DISPLAY_MAX_H / img.naturalHeight, 1)
      scaleRef.current = s
      const dw = Math.round(img.naturalWidth * s)
      const dh = Math.round(img.naturalHeight * s)
      setDisplaySize({ w: dw, h: dh })
      setCropRect({ x: 0, y: 0, w: dw, h: dh })
    }
    img.src = imageUrl
  }, [imageUrl])

  // Redraw canvas whenever crop or display size changes
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !displaySize) return

    const { w, h } = displaySize
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const s = scaleRef.current

    // Full image, darkened
    ctx.drawImage(img, 0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, w, h)

    // Crop region at full brightness
    ctx.drawImage(
      img,
      cropRect.x / s, cropRect.y / s, cropRect.w / s, cropRect.h / s,
      cropRect.x, cropRect.y, cropRect.w, cropRect.h,
    )

    // Crop border
    ctx.strokeStyle = '#a855f7'
    ctx.lineWidth = 2
    ctx.strokeRect(cropRect.x + 1, cropRect.y + 1, cropRect.w - 2, cropRect.h - 2)

    // Corner handles
    const hs = HANDLE_SIZE
    ctx.fillStyle = '#a855f7'
    ;[
      [cropRect.x, cropRect.y],
      [cropRect.x + cropRect.w - hs, cropRect.y],
      [cropRect.x, cropRect.y + cropRect.h - hs],
      [cropRect.x + cropRect.w - hs, cropRect.y + cropRect.h - hs],
    ].forEach(([cx, cy]) => ctx.fillRect(cx, cy, hs, hs))
  }, [cropRect, displaySize])

  if (!displaySize) return null

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (displaySize.w / rect.width),
      y: (e.clientY - rect.top) * (displaySize.h / rect.height),
    }
  }

  const hitCorner = (px: number, py: number, r: Rect): Corner | null => {
    const hs = HANDLE_SIZE
    if (px >= r.x && px <= r.x + hs && py >= r.y && py <= r.y + hs) return 'nw'
    if (px >= r.x + r.w - hs && px <= r.x + r.w && py >= r.y && py <= r.y + hs) return 'ne'
    if (px >= r.x && px <= r.x + hs && py >= r.y + r.h - hs && py <= r.y + r.h) return 'sw'
    if (px >= r.x + r.w - hs && px <= r.x + r.w && py >= r.y + r.h - hs && py <= r.y + r.h) return 'se'
    return null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = getPos(e)
    const corner = hitCorner(x, y, cropRect)
    if (corner) {
      dragRef.current = { type: 'resize', corner, startX: x, startY: y, origRect: { ...cropRect } }
    } else if (x >= cropRect.x && x <= cropRect.x + cropRect.w && y >= cropRect.y && y <= cropRect.y + cropRect.h) {
      dragRef.current = { type: 'move', startX: x, startY: y, origRect: { ...cropRect } }
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const { x, y } = getPos(e)
    const { w: dw, h: dh } = displaySize
    const o = drag.origRect
    const dx = x - drag.startX
    const dy = y - drag.startY

    if (drag.type === 'move') {
      setCropRect({
        ...o,
        x: Math.max(0, Math.min(dw - o.w, o.x + dx)),
        y: Math.max(0, Math.min(dh - o.h, o.y + dy)),
      })
      return
    }

    let { x: rx, y: ry, w: rw, h: rh } = o
    switch (drag.corner) {
      case 'nw':
        rx = Math.max(0, Math.min(o.x + o.w - MIN_CROP, o.x + dx))
        ry = Math.max(0, Math.min(o.y + o.h - MIN_CROP, o.y + dy))
        rw = o.x + o.w - rx
        rh = o.y + o.h - ry
        break
      case 'ne':
        ry = Math.max(0, Math.min(o.y + o.h - MIN_CROP, o.y + dy))
        rw = Math.max(MIN_CROP, Math.min(dw - o.x, o.w + dx))
        rh = o.y + o.h - ry
        break
      case 'sw':
        rx = Math.max(0, Math.min(o.x + o.w - MIN_CROP, o.x + dx))
        rw = o.x + o.w - rx
        rh = Math.max(MIN_CROP, Math.min(dh - o.y, o.h + dy))
        break
      case 'se':
        rw = Math.max(MIN_CROP, Math.min(dw - o.x, o.w + dx))
        rh = Math.max(MIN_CROP, Math.min(dh - o.y, o.h + dy))
        break
    }
    setCropRect({ x: rx, y: ry, w: rw, h: rh })
  }

  const handleApply = () => {
    const img = imgRef.current!
    const s = scaleRef.current
    const iw = Math.round(cropRect.w / s)
    const ih = Math.round(cropRect.h / s)
    const off = document.createElement('canvas')
    off.width = iw
    off.height = ih
    off.getContext('2d')!.drawImage(
      img,
      Math.round(cropRect.x / s), Math.round(cropRect.y / s), iw, ih,
      0, 0, iw, ih,
    )
    onApply(off.toDataURL())
  }

  return (
    <div className="card space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-purple-300">Crop image</p>
        <p className="text-xs text-purple-400">Drag inside to move · drag corners to resize</p>
      </div>
      <div className="flex justify-center overflow-auto">
        <canvas
          ref={canvasRef}
          width={displaySize.w}
          height={displaySize.h}
          className="rounded border border-white/10 max-w-full"
          style={{ cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null }}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onSkip}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-white/10 text-purple-200 hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" /> Use full image
        </button>
        <button
          onClick={handleApply}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-500 transition-colors"
        >
          <Check className="w-4 h-4" /> Apply crop
        </button>
      </div>
    </div>
  )
}
