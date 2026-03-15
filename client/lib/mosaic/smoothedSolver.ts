/**
 * Smoothed OR solver using iterative local search with spatial adjacency bonus.
 *
 * Objective per pixel i assigned to color c:
 *   score(c) = -LAB_dist(pixel_i, c) + λ * (# 4-connected neighbors already assigned color c)
 *
 * λ = smoothingWeight * MAX_LAB_DIST, keeping the bonus in the same scale as the distance cost.
 *
 * This is equivalent to minimizing a Markov Random Field energy:
 *   E = Σ_i dist(pixel_i, color_i) - λ * Σ_(i,j)∈edges [color_i == color_j]
 *
 * Higher smoothingWeight → larger regions of the same color (more "blocky" but more coherent).
 * smoothingWeight = 0 → equivalent to nearest-neighbor.
 */

import { CUBE_COLORS, COLOR_COUNT } from './cubeColors';
import { rgbToLab, labDistance } from './colorConversion';

const MAX_ITER = 50;
// Approximate max LAB distance between any two colors in the cube palette
const MAX_LAB_DIST = 150;

export function solveSmoothed(
  pixelsRgb: Uint8ClampedArray,
  cols: number,
  rows: number,
  smoothingWeight: number, // 0.0 to 1.0
): Int32Array {
  const N = cols * rows;
  const C = COLOR_COUNT;
  const colorsLab = CUBE_COLORS.map(c => c.lab);
  const lambda = smoothingWeight * MAX_LAB_DIST;

  // Convert pixels to LAB
  const pixelsLab: Array<[number, number, number]> = Array.from({ length: N }, (_, i) =>
    rgbToLab(pixelsRgb[i * 4], pixelsRgb[i * 4 + 1], pixelsRgb[i * 4 + 2])
  );

  // Precompute pixel→color distances (static, doesn't change)
  const dist = new Float32Array(N * C);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < C; j++) {
      dist[i * C + j] = labDistance(pixelsLab[i], colorsLab[j]);
    }
  }

  // Warm start: nearest-neighbor assignment
  const assignment = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0, bestD = dist[i * C];
    for (let j = 1; j < C; j++) {
      if (dist[i * C + j] < bestD) { bestD = dist[i * C + j]; best = j; }
    }
    assignment[i] = best;
  }

  if (lambda === 0) return assignment;

  // Iterative local search
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Count neighbor colors (4-connected)
      const neighborCount = new Float32Array(C);
      if (row > 0)          neighborCount[assignment[i - cols]]++;
      if (row < rows - 1)   neighborCount[assignment[i + cols]]++;
      if (col > 0)          neighborCount[assignment[i - 1]]++;
      if (col < cols - 1)   neighborCount[assignment[i + 1]]++;

      // Pick color maximizing score = -dist + λ * neighbor_count
      let best = 0;
      let bestScore = -dist[i * C + 0] + lambda * neighborCount[0];
      for (let j = 1; j < C; j++) {
        const score = -dist[i * C + j] + lambda * neighborCount[j];
        if (score > bestScore) { bestScore = score; best = j; }
      }

      if (assignment[i] !== best) { assignment[i] = best; changed = true; }
    }
    if (!changed) break;
  }

  return assignment;
}
