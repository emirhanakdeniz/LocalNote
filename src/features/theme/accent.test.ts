import { describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  applyAccentColor,
  calculateContrastText,
  DEFAULT_ACCENT_COLOR,
  hexToRgb,
  isValidHex,
  normalizeHex,
} from "./accent";

describe("accent utilities", () => {
  it("includes all requested presets with Deep Purple default", () => {
    expect(DEFAULT_ACCENT_COLOR).toBe("#4c1d95");
    expect(ACCENT_PRESETS).toHaveLength(6);
    expect(ACCENT_PRESETS.map((p) => p.hex)).toEqual([
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
  });

  it("applies CSS custom properties to document.documentElement", () => {
    applyAccentColor("#14532d");
    const style = document.documentElement.style;

    expect(style.getPropertyValue("--color-accent")).toBe("#14532d");
    expect(style.getPropertyValue("--color-focus")).toBe("#14532d");
    expect(style.getPropertyValue("--color-accent-text")).toBe("#ffffff");
    expect(style.getPropertyValue("--color-accent-hover")).toContain("20, 83, 45");
    expect(style.getPropertyValue("--color-accent-subtle")).toContain("20, 83, 45");
    expect(document.documentElement.dataset.accent).toBe("#14532d");
  });
});
