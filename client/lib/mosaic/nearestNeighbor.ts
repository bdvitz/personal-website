/**
 * Nearest-neighbor solver: assign each pixel independently to its closest cube color.
 * Simple O(N*C) greedy baseline.
 */

import { CUBE_COLORS } from './cubeColors';
import { rgbToLab, buildDistanceMatrix } from './colorConversion';

/**
 * @param pixelsRgb - Flat Uint8ClampedArray from canvas ImageData (RGBA), length N*4
 * @param gridSize  - Width/height of the grid (N = gridSize²)
 * @returns Int32Array of length N with values 0-5 (cube color index per pixel)
 */
export function solveNearestNeighbor(
  pixelsRgb: Uint8ClampedArray,
  cols: number,
  rows: number,
): Int32Array {
  const N = cols * rows;
  const colorsLab = CUBE_COLORS.map(c => c.lab);
  const C = colorsLab.length;

  const pixelsLab = Array.from({ length: N }, (_, i) => {
    const r = pixelsRgb[i * 4];
    const g = pixelsRgb[i * 4 + 1];
    const b = pixelsRgb[i * 4 + 2];
    return rgbToLab(r, g, b);
  });

  const dist = buildDistanceMatrix(pixelsLab, colorsLab);
  const assignment = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0, bestDist = dist[i * C];
    for (let j = 1; j < C; j++) {
      if (dist[i * C + j] < bestDist) {
        bestDist = dist[i * C + j];
        best = j;
      }
    }
    assignment[i] = best;
  }
  return assignment;
}
