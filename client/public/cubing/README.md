# Rubik's Cube Mosaic Images

## Instructions for Adding Images

Place your Rubik's cube mosaic images in this folder (`client/public/cubing/`).

### Recommended Image Format
- **Format**: JPG, PNG, or WebP
- **Size**: Recommended max width 2000px (Next.js will automatically optimize)
- **Naming**: Use descriptive names (e.g., `mario-mosaic.jpg`, `starry-night.png`)

### Example File Structure
```
client/public/cubing/
├── README.md
├── mosaic1.jpg
├── mosaic2.jpg
├── mario-portrait.png
├── starry-night.jpg
└── ... (add more images here)
```

### After Adding Images

Edit the `mosaicImages` array in `client/app/cubing/page.tsx` to include your images:

```typescript
const mosaicImages: MosaicImage[] = [
  {
    src: '/cubing/mario-portrait.png',
    label: 'Super Mario Portrait',  // 20-40 characters
    alt: 'Rubik\'s cube mosaic of Super Mario'
  },
  {
    src: '/cubing/starry-night.jpg',
    label: 'Starry Night Recreation',  // 20-40 characters
    alt: 'Rubik\'s cube mosaic of Van Gogh\'s Starry Night'
  },
  // Add more images here...
]
```

### Notes
- Images are served from `/cubing/` path (automatically mapped to this folder)
- Next.js Image component will automatically optimize images for web
- Labels should be 20-40 characters as requested
- The gallery displays in a responsive 3-column grid (1 column on mobile, 2 on tablet, 3 on desktop)
- Clicking an image opens it in a lightbox modal view
