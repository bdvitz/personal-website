'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Crop } from 'lucide-react'
import { CUBE_COLORS } from '@/lib/mosaic/cubeColors'
import { solveNearestNeighbor } from '@/lib/mosaic/nearestNeighbor'
import { solveKMeans } from '@/lib/mosaic/kmeans'
import { solveSmoothed } from '@/lib/mosaic/smoothedSolver'
import { solveKMeansSmoothed } from '@/lib/mosaic/kmeansSmoothedSolver'
import ImageCropper from './ImageCropper'

type Method = 'nearest' | 'kmeans' | 'smoothed' | 'kmeansSmoothed'

const PRESETS = [
  { label: '30x30', cols: 30, rows: 30 },
  { label: '30x60', cols: 30, rows: 60 },
  { label: '60x30', cols: 60, rows: 30 },
  { label: '120x120', cols: 120, rows: 120 },
] as const
const GRID_LINE = 1   // px between cells
const MAX_PANEL = 560 // max canvas dimension in CSS px
const GRID_MIN = 1
const GRID_MAX = 120

export default function MosaicTool() {
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [gridCols, setGridCols] = useState(30)
  const [gridRows, setGridRows] = useState(30)
  const [colsInput, setColsInput] = useState('30')
  const [rowsInput, setRowsInput] = useState('30')
  const [method, setMethod] = useState<Method>('nearest')
  const [smoothing, setSmoothing] = useState(0.5)
  const [assignment, setAssignment] = useState<Int32Array | null>(null)
  const [colorPerm, setColorPerm] = useState<number[]>([0, 1, 2, 3, 4, 5])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const origCanvasRef = useRef<HTMLCanvasElement>(null)
  const mosaicCanvasRef = useRef<HTMLCanvasElement>(null)

  // Scale cell size so the larger dimension always fits within MAX_PANEL
  const cellPx = Math.max(2, Math.floor((MAX_PANEL - GRID_LINE) / Math.max(gridCols, gridRows)) - GRID_LINE)
  const panelW = gridCols * (cellPx + GRID_LINE) + GRID_LINE
  const panelH = gridRows * (cellPx + GRID_LINE) + GRID_LINE

  // Re-run solver whenever relevant inputs change
  useEffect(() => {
    if (!imageUrl) return
    runSolver(imageUrl, gridCols, gridRows, cellPx, method, smoothing)
  }, [imageUrl, gridCols, gridRows, cellPx, method, smoothing])

  // Draw mosaic whenever assignment, display size, or color permutation changes
  useEffect(() => {
    if (!assignment || !mosaicCanvasRef.current) return
    drawMosaic(mosaicCanvasRef.current, assignment, gridCols, gridRows, cellPx, colorPerm)
  }, [assignment, gridCols, gridRows, cellPx, colorPerm])

  const runSolver = useCallback(
    async (url: string, c: number, r: number, cp: number, m: Method, sw: number) => {
      setIsProcessing(true)
      await new Promise(resolve => setTimeout(resolve, 10))

      try {
        const pixels = await downsample(url, c, r, cp, origCanvasRef.current!)
        let result: Int32Array
        if (m === 'nearest') result = solveNearestNeighbor(pixels, c, r)
        else if (m === 'kmeans') result = solveKMeans(pixels, c, r)
        else if (m === 'smoothed') result = solveSmoothed(pixels, c, r, sw)
        else result = solveKMeansSmoothed(pixels, c, r, sw)
        setAssignment(result)
      } finally {
        setIsProcessing(false)
      }
    },
    [],
  )

  const commitGridInput = (cs: string, rs: string) => {
    const c = parseInt(cs, 10)
    const r = parseInt(rs, 10)
    if (c >= GRID_MIN && c <= GRID_MAX) setGridCols(c)
    if (r >= GRID_MIN && r <= GRID_MAX) setGridRows(r)
  }

  const applyPreset = (cols: number, rows: number) => {
    setColsInput(String(cols))
    setRowsInput(String(rows))
    setGridCols(cols)
    setGridRows(rows)
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setRawImageUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
    setImageUrl(null)
    setAssignment(null)
    setIsCropping(true)
  }

  const handleCropApply = (croppedUrl: string) => {
    setImageUrl(croppedUrl)
    setIsCropping(false)
  }

  const handleCropSkip = () => {
    setImageUrl(rawImageUrl)
    setIsCropping(false)
  }

  const randomizeColors = () => {
    const perm = [0, 1, 2, 3, 4, 5]
    for (let i = 5; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[perm[i], perm[j]] = [perm[j], perm[i]]
    }
    setColorPerm(perm)
  }

  const colorCounts = assignment
    ? CUBE_COLORS.map((c, i) => ({
        ...c,
        count: Array.from(assignment).filter(v => colorPerm[v] === i).length,
      }))
    : null

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Upload zone */}
      <div
        className={`card cursor-pointer transition-all duration-200 border-2 ${
          isDragging ? 'border-purple-400 bg-purple-900/30' : 'border-white/10 hover:border-purple-500/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault(); setIsDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) handleFile(f)
        }}
      >
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <Upload className="w-10 h-10 text-purple-400" />
          <p className="text-purple-200 text-sm">
            {imageUrl ? 'Click or drop to replace image' : 'Drop an image here or click to upload'}
          </p>
          {imageUrl && !isCropping && (
            <button
              onClick={e => { e.stopPropagation(); setIsCropping(true) }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-white/10 text-purple-300 hover:bg-white/20 transition-colors"
            >
              <Crop className="w-3 h-3" /> Re-crop
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {/* Crop UI */}
      {isCropping && rawImageUrl && (
        <ImageCropper
          imageUrl={rawImageUrl}
          onApply={handleCropApply}
          onSkip={handleCropSkip}
        />
      )}

      {/* Controls */}
      <div className="card space-y-5">

        {/* Grid size */}
        <div>
          <p className="text-sm text-purple-300 mb-2 font-medium">Grid size <span className="text-purple-500 font-normal">(max {GRID_MAX})</span></p>
          <div className="flex flex-wrap items-center gap-3">
            {/* Inputs */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={GRID_MIN} max={GRID_MAX}
                value={colsInput}
                onChange={e => setColsInput(e.target.value)}
                onBlur={() => commitGridInput(colsInput, rowsInput)}
                onKeyDown={e => e.key === 'Enter' && commitGridInput(colsInput, rowsInput)}
                className="w-16 px-2 py-1.5 rounded-lg text-sm text-white bg-white/10 border border-white/20 focus:border-purple-500 focus:outline-none text-center"
              />
              <span className="text-purple-400 text-sm">×</span>
              <input
                type="number"
                min={GRID_MIN} max={GRID_MAX}
                value={rowsInput}
                onChange={e => setRowsInput(e.target.value)}
                onBlur={() => commitGridInput(colsInput, rowsInput)}
                onKeyDown={e => e.key === 'Enter' && commitGridInput(colsInput, rowsInput)}
                className="w-16 px-2 py-1.5 rounded-lg text-sm text-white bg-white/10 border border-white/20 focus:border-purple-500 focus:outline-none text-center"
              />
            </div>
            {/* Presets */}
            <div className="flex gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.cols, p.rows)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    gridCols === p.cols && gridRows === p.rows
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Method */}
        <div>
          <p className="text-sm text-purple-300 mb-2 font-medium">Method</p>
          <div className="flex flex-wrap gap-2">
            {(['nearest', 'kmeans', 'smoothed', 'kmeansSmoothed'] as Method[]).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  method === m
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                {m === 'nearest' ? 'Nearest Neighbor'
                  : m === 'kmeans' ? 'K-Means'
                  : m === 'smoothed' ? 'Smoothed OR'
                  : 'K-Means + Smoothed OR'}
              </button>
            ))}
          </div>
        </div>

        {/* Smoothing slider — visible for both smoothed methods */}
        {(method === 'smoothed' || method === 'kmeansSmoothed') && (
          <div>
            <p className="text-sm text-purple-300 mb-2 font-medium">
              Smoothing weight: <span className="text-white">{smoothing.toFixed(2)}</span>
            </p>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={smoothing}
              onChange={e => setSmoothing(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-purple-400 mt-1">
              <span>0 — pixel-perfect</span>
              <span>1 — smooth regions</span>
            </div>
          </div>
        )}

        {/* Color permutation */}
        <div>
          <p className="text-sm text-purple-300 mb-2 font-medium">Color assignment</p>
          <div className="flex gap-2">
            <button
              onClick={randomizeColors}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-purple-200 hover:bg-white/20 transition-colors"
            >
              Randomize
            </button>
            <button
              onClick={() => setColorPerm([0, 1, 2, 3, 4, 5])}
              disabled={colorPerm.every((v, i) => v === i)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-purple-200 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Canvases */}
      {imageUrl && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-purple-300">Original ({gridCols}×{gridRows})</h3>
            <div className="flex justify-center">
              <canvas
                ref={origCanvasRef}
                width={panelW}
                height={panelH}
                className="rounded border border-white/10"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-purple-300">
              Mosaic Result
              {isProcessing && <span className="ml-2 text-purple-400 animate-pulse">computing…</span>}
            </h3>
            <div className="flex justify-center">
              <canvas
                ref={mosaicCanvasRef}
                width={panelW}
                height={panelH}
                className="rounded border border-white/10"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Color breakdown */}
      {colorCounts && (
        <div className="card">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">Color breakdown</h3>
          <div className="flex flex-wrap gap-4">
            {colorCounts.map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded-sm border border-white/20 flex-shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-purple-200 text-sm capitalize">{c.name}</span>
                <span className="text-white text-sm font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function downsample(
  url: string,
  cols: number,
  rows: number,
  cellPx: number,
  origCanvas: HTMLCanvasElement,
): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const step = cellPx + GRID_LINE
      const panelW = cols * step + GRID_LINE
      const panelH = rows * step + GRID_LINE
      origCanvas.width = panelW
      origCanvas.height = panelH
      const ctx = origCanvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Offscreen canvas for pixel extraction
      const off = document.createElement('canvas')
      off.width = cols
      off.height = rows
      const offCtx = off.getContext('2d')!
      offCtx.imageSmoothingEnabled = true
      offCtx.imageSmoothingQuality = 'high'
      offCtx.drawImage(img, 0, 0, cols, rows)

      const { data } = offCtx.getImageData(0, 0, cols, rows)

      // Draw zoomed-in version of the original
      ctx.fillStyle = '#282828'
      ctx.fillRect(0, 0, panelW, panelH)
      for (let i = 0; i < cols * rows; i++) {
        const row = Math.floor(i / cols), col = i % cols
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(GRID_LINE + col * step, GRID_LINE + row * step, cellPx, cellPx)
      }

      resolve(data)
    }
    img.onerror = reject
    img.src = url
  })
}

function drawMosaic(canvas: HTMLCanvasElement, assignment: Int32Array, cols: number, rows: number, cellPx: number, colorPerm: number[]) {
  const step = cellPx + GRID_LINE
  const panelW = cols * step + GRID_LINE
  const panelH = rows * step + GRID_LINE
  canvas.width = panelW
  canvas.height = panelH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#282828'
  ctx.fillRect(0, 0, panelW, panelH)

  for (let i = 0; i < assignment.length; i++) {
    const row = Math.floor(i / cols), col = i % cols
    ctx.fillStyle = CUBE_COLORS[colorPerm[assignment[i]]].hex
    ctx.fillRect(GRID_LINE + col * step, GRID_LINE + row * step, cellPx, cellPx)
  }
}
