import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const iconsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src-tauri/icons");

// Installer artwork uses the raster exported from the approved SVG master.
function readRgbaPng(filename) {
  const png = fs.readFileSync(filename);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) {
    throw new Error("Installer artwork requires a non-interlaced 8-bit RGBA PNG.");
  }
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error("Unsupported PNG filter.");
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const left = x >= 4 ? pixels[offset - 4] : 0;
      const up = y > 0 ? pixels[offset - stride] : 0;
      const corner = y > 0 && x >= 4 ? pixels[offset - stride - 4] : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

const icon = readRgbaPng(path.join(iconsDir, "icon.png"));

function createBmp(width, height, background, placement) {
  const stride = Math.ceil(width * 3 / 4) * 4;
  const buffer = Buffer.alloc(54 + stride * height);
  buffer.write("BM");
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(stride * height, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = [...background];
      if (x >= placement.x && y >= placement.y && x < placement.x + placement.size && y < placement.y + placement.size) {
        color.fill(0);
        // Area sampling composites transparent edges onto an opaque, uniform field.
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 4; sx++) {
            const ix = Math.min(icon.width - 1, Math.floor((x - placement.x + (sx + 0.5) / 4) / placement.size * icon.width));
            const iy = Math.min(icon.height - 1, Math.floor((y - placement.y + (sy + 0.5) / 4) / placement.size * icon.height));
            const source = (iy * icon.width + ix) * 4;
            const alpha = icon.pixels[source + 3] / 255;
            for (let channel = 0; channel < 3; channel++) {
              color[channel] += (icon.pixels[source + channel] * alpha + background[channel] * (1 - alpha)) / 16;
            }
          }
        }
      }
      const offset = 54 + (height - 1 - y) * stride + x * 3;
      buffer[offset] = Math.round(color[2]);
      buffer[offset + 1] = Math.round(color[1]);
      buffer[offset + 2] = Math.round(color[0]);
    }
  }
  return buffer;
}

fs.writeFileSync(path.join(iconsDir, "header.bmp"), createBmp(150, 57, [255, 255, 255], { x: 98, y: 4, size: 48 }));
fs.writeFileSync(path.join(iconsDir, "sidebar.bmp"), createBmp(164, 314, [26, 26, 29], { x: 26, y: 62, size: 112 }));
console.log("Generated flat NSIS header and sidebar artwork from the LocalNote icon.");
