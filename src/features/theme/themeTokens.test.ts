import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FINAL_TOKEN_NAMES = [
  "--color-canvas",
  "--color-sidebar",
  "--color-editor",
  "--color-raised",
  "--color-text",
  "--color-text-secondary",
  "--color-text-subtle",
  "--color-separator",
  "--color-border",
] as const;

function tokens(block: string) {
  return Object.fromEntries(
    FINAL_TOKEN_NAMES.map((name) => {
      const value = block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
      return [name, value];
    }),
  );
}

describe("final theme tokens", () => {
  it("keeps explicit Dark and System dark on the same final palette", () => {
    const css = readFileSync(resolve("src/styles.css"), "utf8");
    const finalOverrides = css.slice(css.lastIndexOf("/* Final LocalNote token"));
    const explicitDark = finalOverrides.match(
      /:root\[data-theme="dark"\]\s*\{([^}]+)\}/,
    )?.[1];
    const systemDark = finalOverrides.match(
      /:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\)\s*\{([^}]+)\}/,
    )?.[1];

    expect(explicitDark).toBeDefined();
    expect(systemDark).toBeDefined();
    expect(tokens(systemDark!)).toEqual(tokens(explicitDark!));
    expect(finalOverrides).toContain(':root[data-theme="dark"]');
    expect(finalOverrides).toContain(':root:not([data-theme="light"]):not([data-theme="dark"])');
  });
});
