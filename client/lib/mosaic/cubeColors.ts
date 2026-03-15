/**
 * Standard Rubik's cube face colors (WCA color scheme).
 * LAB values are pre-computed from the RGB values for use in distance calculations.
 */

export interface CubeColor {
  name: string;
  rgb: [number, number, number]; // 0-255
  lab: [number, number, number]; // CIE LAB
  hex: string;
}

// RGB values matching the WCA standard cube color scheme
const RAW: Array<[string, [number, number, number], string]> = [
  ['white',  [255, 255, 255], '#ffffff'],
  ['yellow', [255, 213,   0], '#ffd500'],
  ['red',    [196,  30,  58], '#c41e3a'],
  ['orange', [255,  88,   0], '#ff5800'],
  ['blue',   [  0,  70, 173], '#0046ad'],
  ['green',  [  0, 155,  72], '#009b48'],
];

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Step 1: linearize sRGB
  let rr = r / 255, gg = g / 255, bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  // Step 2: RGB → XYZ (D65)
  const X = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  const Y = (rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750) / 1.00000;
  const Z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883;

  // Step 3: XYZ → LAB
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const CUBE_COLORS: CubeColor[] = RAW.map(([name, rgb, hex]) => ({
  name,
  rgb,
  hex,
  lab: rgbToLab(...rgb),
}));

export const COLOR_COUNT = CUBE_COLORS.length; // 6
