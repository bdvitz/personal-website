/**
 * K-Means + Smoothed OR solver.
 *
 * Combines k-means centroid discovery with adjacency-aware local search:
 *   1. Run k-means to find 6 centroids representing the image's own color clusters.
 *   2. Map each centroid to a unique cube color.
 *   3. Build a distance matrix where cost(pixel, cube_color) = LAB_dist(pixel, centroid_for_that_cube_color).
 *      This anchors costs to the image's color distribution rather than fixed cube colors.
 *   4. Warm-start from the k-means assignment (already spatially coherent).
 *   5. Run the same iterative local search as smoothedSolver, refining with adjacency bonus.
 *
 * Result: image-adaptive color mapping + spatial smoothing — distinct from both k-means alone
 * (which locks entire clusters to one color) and smoothed OR alone (which uses fixed cube colors
 * as cost anchors).
 */

import { COLOR_COUNT } from './cubeColors';
import { rgbToLab, labDistance } from './colorConversion';
import { computeCentroids } from './kmeans';

const MAX_ITER = 50;
const MAX_LAB_DIST = 150;

export function solveKMeansSmoothed(
  pixelsRgb: Uint8ClampedArray,
  cols: number,
  rows: number,
  smoothingWeight: number, // 0.0 to 1.0
  randomSeed: number = 42,
): Int32Array {
  const N = cols * rows;
  const C = COLOR_COUNT;
  const lambda = smoothingWeight * MAX_LAB_DIST;

  // Convert pixels to LAB
  const pixelsLab: Array<[number, number, number]> = Array.from({ length: N }, (_, i) =>
    rgbToLab(pixelsRgb[i * 4], pixelsRgb[i * 4 + 1], pixelsRgb[i * 4 + 2])
  );

  // Run k-means to get image-adaptive centroids
  const { centroids, centroidToCubeColor, labels } = computeCentroids(pixelsLab, randomSeed);

  // Build centroidByCubeColor[cubeColorIdx] = centroid LAB
  // so we can look up "the centroid assigned to cube color j" by index j.
  const centroidByCubeColor: Array<[number, number, number]> = new Array(C);
  for (let k = 0; k < C; k++) {
    centroidByCubeColor[centroidToCubeColor[k]] = centroids[k];
  }

  // Precompute distance matrix: dist[i*C + j] = LAB_dist(pixel_i, centroid_for_cube_color_j)
  const dist = new Float32Array(N * C);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < C; j++) {
      dist[i * C + j] = labDistance(pixelsLab[i], centroidByCubeColor[j]);
    }
  }

  // Warm start from k-means assignment
  const assignment = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    assignment[i] = centroidToCubeColor[labels[i]];
  }

  if (lambda === 0) return assignment;

  // Iterative local search with adjacency bonus
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const neighborCount = new Float32Array(C);
      if (row > 0)          neighborCount[assignment[i - cols]]++;
      if (row < rows - 1)   neighborCount[assignment[i + cols]]++;
      if (col > 0)          neighborCount[assignment[i - 1]]++;
      if (col < cols - 1)   neighborCount[assignment[i + 1]]++;

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
