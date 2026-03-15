/**
 * K-means solver (k=6) in LAB color space.
 *
 * Algorithm:
 *   1. Run k-means with k=6 to find cluster centroids.
 *   2. Map each centroid to a unique cube color (greedy by distance).
 *   3. All pixels in a cluster inherit their centroid's cube color.
 *
 * Produces visually distinct regions compared to nearest-neighbor because
 * entire areas share one centroid-derived color rather than being assigned
 * independently.
 */

import { CUBE_COLORS, COLOR_COUNT } from './cubeColors';
import { rgbToLab, labDistance, buildDistanceMatrix } from './colorConversion';

const MAX_ITER = 100;

export interface CentroidResult {
  /** Converged centroid LAB values, one per cluster (length = COLOR_COUNT). */
  centroids: Array<[number, number, number]>;
  /** Maps cluster index → cube color index (0–5). */
  centroidToCubeColor: Int32Array;
  /** Pixel-to-cluster label (length = N). */
  labels: Int32Array;
}

/**
 * Run k-means in LAB space and map each centroid to a unique cube color.
 * Exported so other solvers (e.g. kmeansSmoothedSolver) can reuse the centroids.
 */
export function computeCentroids(
  pixelsLab: Array<[number, number, number]>,
  randomSeed: number = 42,
): CentroidResult {
  const N = pixelsLab.length;
  const C = COLOR_COUNT;

  const centroids = initCentroids(pixelsLab, C, randomSeed);

  let labels = new Int32Array(N);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      let best = 0, bestD = labDistance(pixelsLab[i], centroids[0]);
      for (let k = 1; k < C; k++) {
        const d = labDistance(pixelsLab[i], centroids[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    if (!changed) break;

    const sums: Array<[number, number, number]> = Array.from({ length: C }, () => [0, 0, 0]);
    const counts = new Int32Array(C);
    for (let i = 0; i < N; i++) {
      const k = labels[i];
      sums[k][0] += pixelsLab[i][0];
      sums[k][1] += pixelsLab[i][1];
      sums[k][2] += pixelsLab[i][2];
      counts[k]++;
    }
    for (let k = 0; k < C; k++) {
      if (counts[k] > 0) {
        centroids[k] = [sums[k][0]/counts[k], sums[k][1]/counts[k], sums[k][2]/counts[k]];
      }
    }
  }

  const colorsLab = CUBE_COLORS.map(c => c.lab);
  const centroidDist = buildDistanceMatrix(centroids, colorsLab);
  const centroidToCubeColor = uniqueAssignment(centroidDist, C, C);

  return { centroids, centroidToCubeColor, labels };
}

export function solveKMeans(
  pixelsRgb: Uint8ClampedArray,
  cols: number,
  rows: number,
  randomSeed: number = 42,
): Int32Array {
  const N = cols * rows;

  const pixelsLab: Array<[number, number, number]> = Array.from({ length: N }, (_, i) =>
    rgbToLab(pixelsRgb[i * 4], pixelsRgb[i * 4 + 1], pixelsRgb[i * 4 + 2])
  );

  const { centroidToCubeColor, labels } = computeCentroids(pixelsLab, randomSeed);

  const assignment = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    assignment[i] = centroidToCubeColor[labels[i]];
  }
  return assignment;
}

/** Initialize centroids with k-means++ seeding (deterministic via seed). */
function initCentroids(
  pixels: Array<[number, number, number]>,
  k: number,
  seed: number,
): Array<[number, number, number]> {
  const N = pixels.length;
  // Simple seeded pseudo-random
  let rng = seed;
  const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };

  const centroids: Array<[number, number, number]> = [];
  centroids.push(pixels[Math.floor(rand() * N)]);

  for (let c = 1; c < k; c++) {
    // Distance of each point to nearest existing centroid
    const dists = pixels.map(p => Math.min(...centroids.map(cen => labDistance(p, cen) ** 2)));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let chosen = N - 1;
    for (let i = 0; i < N; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push([...pixels[chosen]] as [number, number, number]);
  }
  return centroids;
}

/**
 * Greedily assign K rows to C columns uniquely (minimize cost).
 * Returns Int32Array of length K with column assignments.
 */
function uniqueAssignment(costMatrix: Float32Array, K: number, C: number): Int32Array {
  const assignment = new Int32Array(K).fill(-1);
  const usedCols = new Set<number>();

  // Collect all (cost, row, col) triples and sort by cost
  const triples: Array<[number, number, number]> = [];
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < C; j++) {
      triples.push([costMatrix[i * C + j], i, j]);
    }
  }
  triples.sort((a, b) => a[0] - b[0]);

  for (const [, row, col] of triples) {
    if (assignment[row] === -1 && !usedCols.has(col)) {
      assignment[row] = col;
      usedCols.add(col);
    }
    if (assignment.every(v => v !== -1)) break;
  }

  // Fallback: any unassigned row gets its nearest color (may repeat)
  for (let i = 0; i < K; i++) {
    if (assignment[i] === -1) {
      let best = 0, bestD = costMatrix[i * C];
      for (let j = 1; j < C; j++) {
        if (costMatrix[i * C + j] < bestD) { bestD = costMatrix[i * C + j]; best = j; }
      }
      assignment[i] = best;
    }
  }
  return assignment;
}
