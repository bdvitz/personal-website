/**
 * Color conversion utilities: RGB → LAB and LAB distance matrix.
 */

/** Convert a single RGB pixel (0-255) to CIE LAB. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rr = r / 255, gg = g / 255, bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  const X = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  const Y = (rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750) / 1.00000;
  const Z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883;

  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 distance between two LAB colors. */
export function labDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

/**
 * Compute distance matrix from N pixels to C cube colors.
 * Returns Float32Array of shape [N * C] (row-major: dist[i*C + j]).
 */
export function buildDistanceMatrix(
  pixelsLab: Array<[number, number, number]>,
  colorsLab: Array<[number, number, number]>,
): Float32Array {
  const N = pixelsLab.length;
  const C = colorsLab.length;
  const dist = new Float32Array(N * C);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < C; j++) {
      dist[i * C + j] = labDistance(pixelsLab[i], colorsLab[j]);
    }
  }
  return dist;
}
