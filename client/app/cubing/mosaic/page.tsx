import MosaicTool from '@/components/cubing/MosaicTool'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function MosaicPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <Link
          href="/cubing"
          className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cubing
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2">Mosaic Generator</h1>
        <p className="text-purple-200 max-w-2xl">
          Upload any image to generate a Rubik&apos;s cube mosaic. Each cell is mapped to one of the
          6 standard cube face colors using four different methods — compare the results to see how
          the algorithm choice changes the output.
        </p>
      </div>

      {/* Method descriptions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Nearest Neighbor',
            color: 'text-green-400',
            desc: 'Each pixel is independently mapped to its closest cube color by perceptual distance in LAB color space.',
          },
          {
            title: 'K-Means',
            color: 'text-yellow-400',
            desc: 'Pixels are grouped into 6 clusters. Each cluster centroid is mapped to a cube color, so entire regions share one color.',
          },
          {
            title: 'Smoothed OR',
            color: 'text-red-400',
            desc: 'Iterative local search that adds a bonus for matching the color of adjacent cells, producing more spatially coherent regions.',
          },
          {
            title: 'K-Means + Smoothed OR',
            color: 'text-blue-400',
            desc: 'K-means centroids define image-adaptive color costs, then spatial smoothing refines the result — combining the strengths of both methods.',
          },
        ].map(({ title, color, desc }) => (
          <div key={title} className="card bg-purple-900/20">
            <h3 className={`font-semibold mb-1 ${color}`}>{title}</h3>
            <p className="text-purple-200 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Tool */}
      <MosaicTool />
    </div>
  )
}
