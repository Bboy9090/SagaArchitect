export type PhoenixColorHarmony =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'monochrome';

interface HslColor {
  h: number;
  s: number;
  l: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function normalizeHexColor(value: string): string {
  const raw = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
  }
  return '#000000';
}

function hexToHsl(hex: string): HslColor {
  const normalized = normalizeHexColor(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: normalizeHue(h), s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: HslColor): string {
  const hue = normalizeHue(h);
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const channel = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

export function generateColorHarmony(baseHex: string, harmony: PhoenixColorHarmony): string[] {
  const base = hexToHsl(baseHex);
  const color = (hueOffset: number, saturationOffset = 0, lightnessOffset = 0) => hslToHex({
    h: base.h + hueOffset,
    s: base.s + saturationOffset,
    l: base.l + lightnessOffset,
  });
  const values = harmony === 'complementary'
    ? [color(0), color(180), color(0, -12, 18), color(180, -12, 18)]
    : harmony === 'analogous'
      ? [color(-60), color(-30), color(0), color(30), color(60)]
      : harmony === 'triadic'
        ? [color(0), color(120), color(240), color(120, -12, 16), color(240, -12, 16)]
        : harmony === 'split-complementary'
          ? [color(0), color(150), color(210), color(150, -12, 16), color(210, -12, 16)]
          : [color(0, 0, -24), color(0, 0, -12), color(0), color(0, 0, 12), color(0, 0, 24)];
  return [...new Set(values.map(normalizeHexColor))];
}
