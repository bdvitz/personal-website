'use client'

import { useState } from 'react'
import { X, Wand2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface MosaicImage {
  src: string
  label: string
  alt: string
}

export default function CubingPage() {
  const [selectedImage, setSelectedImage] = useState<MosaicImage | null>(null)

  // Add your mosaic images here
  const mosaicImages: MosaicImage[] = [
    {
      src: '/cubing/calcifer.jpg',
      label: 'Calcifer from Howl\'s Moving Castle',
      alt: 'Calcifer from Howl\'s Moving Castle'
    },
    {
      src: '/cubing/hollow.jpg',
      label: 'Hollow Knight',
      alt: 'Hollow Knight'
    },
    {
      src: '/cubing/mario.jpg',
      label: 'Luigi, Mario, Peach, and Toad from Super Mario',
      alt: 'Luigi, Mario, Peach, and Toad from Super Mario'
    },
    {
      src: '/cubing/mushroom.jpg',
      label: 'Mushroom from MapleStory',
      alt: 'Mushroom from MapleStory'
    },
    {
      src: '/cubing/patrick.jpg',
      label: 'Patrick Star from SpongeBob SquarePants',
      alt: 'Patrick Star from SpongeBob SquarePants'
    },
    {
      src: '/cubing/pikachu.jpg',
      label: 'Pikachu from Pokémon',
      alt: 'Pikachu from Pokémon'
    },
    {
      src: '/cubing/tanjiro.jpg',
      label: 'Tanjiro Kamado from Demon Slayer',
      alt: 'Tanjiro Kamado from Demon Slayer'
    },
    {
      src: '/cubing/zenitsu.jpg',
      label: 'Zenitsu Agatsuma From Demon Slayer',
      alt: 'Zenitsu Agatsuma From Demon Slayer'
    },
    // Add more images here following the same pattern
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3">
          Rubik's Cube Mosaic Art
        </h1>
        <p className="text-xl text-purple-200">
          A collection of mosaic artwork created with Rubik's cubes
        </p>
      </div>

      {/* Mosaic Generator CTA */}
      <Link href="/cubing/mosaic">
        <div className="card group cursor-pointer bg-purple-900/20 border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300">
          <div className="flex items-center gap-4">
            <Wand2 className="w-10 h-10 text-purple-400 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Try the Mosaic Generator</h2>
              <p className="text-purple-200 text-sm">
                Upload any image and convert it to a Rubik's cube mosaic using nearest-neighbor,
                k-means, or a smoothed OR algorithm.
              </p>
            </div>
            <span className="ml-auto text-purple-400 font-semibold group-hover:translate-x-2 transition-transform duration-200 flex-shrink-0">
              Open →
            </span>
          </div>
        </div>
      </Link>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mosaicImages.map((image, index) => (
          <div
            key={index}
            className="relative card group cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:z-10"
            onClick={() => setSelectedImage(image)}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-purple-900/30 flex items-center justify-center">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-contain transition-transform duration-300 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-white text-center">
                {image.label}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center">
            <div className="relative w-full h-[80vh]">
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
            <h3 className="text-2xl font-bold text-white mt-6 text-center">
              {selectedImage.label}
            </h3>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="card bg-purple-900/40 mt-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">About the Mosaics</h2>
          <p className="text-purple-200 max-w-2xl mx-auto">
            These mosaic artworks are created using multiple Rubik's cubes arranged to form larger images.
            Each cube face contributes to the overall picture, creating a unique pixelated art style.
          </p>
        </div>
      </div>
    </div>
  )
}
