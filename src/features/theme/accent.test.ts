import { describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  accessibleAccentInk,
  applyAccentColor,
  calculateContrastText,
  DEFAULT_ACCENT_COLOR,
  hexToRgb,
  isValidHex,
  normalizeHex,
} from "./accent";

describe("accent utilities", () => {
  it("includes all requested presets with Local Blue default", () => {
    expect(DEFAULT_ACCENT_COLOR).toBe("#3b6fe5");
    expect(ACCENT_PRESETS).toHaveLength(7);
    expect(ACCENT_PRESETS.map((p) => p.hex)).toEqual([
      "#3b6fe5",
      "#4c1d95",
      "#3b185f",
      "#14532d",
      "#0f4c5c",
      "#172554",
      "#1e3a5f",
    ]);
  });

  it("validates hex color strings accurately", () => {
    expect(isValidHex("#4c1d95")).toBe(true);
    expect(isValidHex("#4C1D95")).toBe(true);
    expect(isValidHex("4c1d95")).toBe(true);
    expect(isValidHex("#fff")).toBe(true);
    expect(isValidHex("abc")).toBe(true);

    expect(isValidHex("invalid")).toBe(false);
    expect(isValidHex("#12")).toBe(false);
    expect(isValidHex("#12345")).toBe(false);
    expect(isValidHex("#gggggg")).toBe(false);
  });

  it("normalizes hex colors to 6-digit lowercase", () => {
    expect(normalizeHex("#4C1D95")).toBe("#4c1d95");
    expect(normalizeHex("4C1D95")).toBe("#4c1d95");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex("invalid")).toBe(DEFAULT_ACCENT_COLOR);
  });

  it("converts hex to RGB channels", () => {
    expect(hexToRgb("#4c1d95")).toEqual({ r: 76, g: 29, b: 149 });
    expect(hexToRgb("#14532d")).toEqual({ r: 20, g: 83, b: 45 });
  });

  it("calculates accessible contrast text color", () => {
    // Dark colors get white text
    expect(calculateContrastText("#4c1d95")).toBe("#ffffff");
    expect(calculateContrastText("#14532d")).toBe("#ffffff");
    expect(calculateContrastText("#000000")).toBe("#ffffff");

    // Bright colors get dark text
    expect(calculateContrastText("#ffffff")).toBe("#18181b");
    expect(calculateContrastText("#facc15")).toBe("#18181b");
    expect(calculateContrastText("#b9845e")).toBe("#18181b");
    expect(calculateContrastText("#808080")).toBe("#000000");
    expect(calculateContrastText("#797979")).toBe("#000000");
  });

  it("applies CSS custom properties to document.documentElement", () => {
    applyAccentColor("#14532d");
    const style = document.documentElement.style;

    expect(style.getPropertyValue("--color-accent")).toBe("#14532d");
    expect(style.getPropertyValue("--color-focus")).toBe("var(--color-accent-ink)");
    expect(style.getPropertyValue("--color-accent-text")).toBe("#ffffff");
    expect(style.getPropertyValue("--color-accent-hover")).toContain("#14532d 88%, #000000");
    expect(style.getPropertyValue("--color-accent-subtle")).toContain("#14532d 12%");
    expect(document.documentElement.dataset.accent).toBe("#14532d");
  });

  it("keeps custom accent labels readable on the light and dark workbench", () => {
    const relativeLuminance = (hex: string) => {
      const { r, g, b } = hexToRgb(hex);
      const linear = [r, g, b].map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    for (const hex of ["#ffffff", "#000000", "#797979", "#808080", "#b9845e", ...ACCENT_PRESETS.map((preset) => preset.hex)]) {
      const fill = relativeLuminance(hex);
      const label = relativeLuminance(calculateContrastText(hex));
      expect((Math.max(fill, label) + 0.05) / (Math.min(fill, label) + 0.05)).toBeGreaterThanOrEqual(4.5);
      for (const dark of [false, true]) {
        const ink = relativeLuminance(accessibleAccentInk(hex, dark));
        const surface = relativeLuminance(dark ? "#4b4b4e" : "#c3bfb9");
        expect((Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
