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
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance({ r, g, b }: RgbColor): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrast(first: RgbColor, second: RgbColor): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function calculateContrastText(hex: string): string {
  const background = hexToRgb(hex);
  const preferred = contrast(background, hexToRgb("#18181b")) >
    contrast(background, hexToRgb("#ffffff"))
    ? "#18181b"
    : "#ffffff";
  return contrast(background, hexToRgb(preferred)) >= 4.5 ? preferred : "#000000";
}

// Preserve the selected fill; adapt small labels and focus rings to each theme.
export function accessibleAccentInk(hex: string, dark: boolean): string {
  const original = hexToRgb(hex);
  // Worst-case 18% black/white selection tint across the workbench surfaces.
  const background = hexToRgb(dark ? "#4b4b4e" : "#c3bfb9");
  const target = dark ? 255 : 0;
  for (let step = 0; step <= 100; step += 1) {
    const amount = step / 100;
    const adjusted = {
      r: Math.round(original.r + (target - original.r) * amount),
      g: Math.round(original.g + (target - original.g) * amount),
      b: Math.round(original.b + (target - original.b) * amount),
    };
    if (contrast(adjusted, background) >= 4.5) {
      return `#${[adjusted.r, adjusted.g, adjusted.b]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
    }
  }
  return dark ? "#ffffff" : "#000000";
}

export function applyAccentColor(hex: string): void {
  if (typeof document === "undefined") return;

  const normalized = isValidHex(hex) ? normalizeHex(hex) : DEFAULT_ACCENT_COLOR;
  const { r, g, b } = hexToRgb(normalized);
  const contrastText = calculateContrastText(normalized);

  const style = document.documentElement.style;
  style.setProperty("--color-accent", normalized);
  const hoverTarget = contrastText === "#ffffff" ? "#000000" : "#ffffff";
  style.setProperty("--color-accent-hover", `color-mix(in srgb, ${normalized} 88%, ${hoverTarget})`);
  style.setProperty("--color-accent-subtle", `color-mix(in srgb, ${normalized} 12%, var(--color-editor))`);
  style.setProperty("--color-accent-ink-light", accessibleAccentInk(normalized, false));
  style.setProperty("--color-accent-ink-dark", accessibleAccentInk(normalized, true));
  style.setProperty("--color-accent-text", contrastText);
  style.setProperty("--color-selected", `color-mix(in srgb, ${normalized} 14%, var(--color-sidebar))`);
  style.setProperty("--color-search-selected", `color-mix(in srgb, ${normalized} 18%, var(--color-raised))`);
  style.setProperty("--color-focus", "var(--color-accent-ink)");
  style.setProperty("--color-selection", `rgba(${r}, ${g}, ${b}, 0.25)`);

  document.documentElement.dataset.accent = normalized;
}
