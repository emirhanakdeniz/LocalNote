import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "localnote-icons-"));
const destination = path.join(root, "src-tauri/icons");
const master = path.join(root, "public/app-icon.svg");
const cli = path.join(root, "node_modules/@tauri-apps/cli/tauri.js");

function generate(output, sizes = []) {
  const result = spawnSync(process.execPath, [
    cli, "icon", master, "--output", output,
    ...sizes.flatMap((size) => ["--png", String(size)]),
  ], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Tauri icon generation failed.");
}

try {
  generate(temporary);
  // Refresh existing distribution assets without adding unused platform formats.
  for (const entry of fs.readdirSync(destination, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relative = path.relative(destination, path.join(entry.parentPath, entry.name));
    const generated = path.join(temporary, relative);
    if (fs.existsSync(generated)) fs.copyFileSync(generated, path.join(destination, relative));
  }
  fs.copyFileSync(path.join(temporary, "icon.png"), path.join(root, "public/app-icon.png"));
  const small = path.join(temporary, "small");
  generate(small, [16, 24, 48, 64]);
  for (const size of [16, 24, 48, 64]) {
    fs.copyFileSync(path.join(small, `${size}x${size}.png`), path.join(destination, `${size}x${size}.png`));
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

await import("./generate-nsis-bitmaps.mjs");
