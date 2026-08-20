export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
}

export const DEFAULT_ACCENT_COLOR = "#3b6fe5";

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: "local-blue", name: "Local Blue", hex: "#3b6fe5" },
  { id: "deep-purple", name: "Deep Purple", hex: "#4c1d95" },
  { id: "royal-aubergine", name: "Royal Aubergine", hex: "#3b185f" },
  { id: "emerald-forest", name: "Emerald Forest", hex: "#14532d" },
  { id: "deep-teal", name: "Deep Teal", hex: "#0f4c5c" },
  { id: "midnight-navy", name: "Midnight Navy", hex: "#172554" },
  { id: "slate-blue", name: "Slate Blue", hex: "#1e3a5f" },
];

const HEX_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(color: string): boolean {
  return HEX_REGEX.test(color.trim());
}

export function normalizeHex(color: string): string {
  const trimmed = color.trim();
  const match = HEX_REGEX.exec(trimmed);
  if (!match) return DEFAULT_ACCENT_COLOR;
  const raw = match[1];
  if (raw.length === 3) {
    const [r, g, b] = raw.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return `#${raw}`.toLowerCase();
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

export function calculateContrastText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance =
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b);
  return luminance > 0.4 ? "#18181b" : "#ffffff";
}

export function applyAccentColor(hex: string): void {
  if (typeof document === "undefined") return;

  const normalized = isValidHex(hex) ? normalizeHex(hex) : DEFAULT_ACCENT_COLOR;
  const { r, g, b } = hexToRgb(normalized);
  const contrastText = calculateContrastText(normalized);

  const style = document.documentElement.style;
  style.setProperty("--color-accent", normalized);
  style.setProperty("--color-accent-hover", `rgba(${r}, ${g}, ${b}, 0.88)`);
  style.setProperty("--color-accent-subtle", `rgba(${r}, ${g}, ${b}, 0.12)`);
  style.setProperty("--color-accent-glow", `rgba(${r}, ${g}, ${b}, 0.25)`);
  style.setProperty("--color-accent-text", contrastText);
  style.setProperty("--color-selected", `rgba(${r}, ${g}, ${b}, 0.14)`);
  style.setProperty("--color-search-selected", `rgba(${r}, ${g}, ${b}, 0.18)`);
  style.setProperty("--color-focus", normalized);
  style.setProperty("--color-selection", `rgba(${r}, ${g}, ${b}, 0.25)`);

  document.documentElement.dataset.accent = normalized;
}
