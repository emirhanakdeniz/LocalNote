import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../src-tauri/icons');

function createBmp(width, height, pixelFn) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  // File Header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt32LE(54, 10);

  // DIB Header
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  // Fill pixels (bottom-up in BMP)
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    const visualY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, visualY, width, height);
      const pixelOffset = rowOffset + x * 3;
      buf[pixelOffset] = Math.max(0, Math.min(255, Math.round(b)));
      buf[pixelOffset + 1] = Math.max(0, Math.min(255, Math.round(g)));
      buf[pixelOffset + 2] = Math.max(0, Math.min(255, Math.round(r)));
    }
  }

  return buf;
}

// Generate Header Bitmap (150x57) - displayed on white NSIS header
function generateHeader() {
  const width = 150;
  const height = 57;

  return createBmp(width, height, (x, y) => {
    // Clean white background to seamlessly blend with NSIS header
    let r = 255;
    let g = 255;
    let b = 255;

    // Draw a sleek note icon on the right side (around center x = 112, y = 28)
    const iconCenterX = 112;
    const iconCenterY = 28;
    const dx = x - iconCenterX;
    const dy = y - iconCenterY;

    // Outer rounded card (size: 32x36)
    if (Math.abs(dx) <= 16 && Math.abs(dy) <= 18) {
      r = 30;
      g = 34;
      b = 42;

      // Note header line / accent
      if (dy >= -14 && dy <= -11 && Math.abs(dx) <= 11) {
        r = 59;
        g = 130;
        b = 246;
      }
      // Note text lines
      else if ((dy === -5 || dy === 0 || dy === 5) && dx >= -11 && dx <= 11) {
        r = 148;
        g = 163;
        b = 184;
      } else if (dy === 10 && dx >= -11 && dx <= 3) {
        r = 148;
        g = 163;
        b = 184;
      }
    }

    return [r, g, b];
  });
}

// Generate Sidebar Bitmap (164x314) - displayed on Welcome & Finish pages
function generateSidebar() {
  const width = 164;
  const height = 314;

  return createBmp(width, height, (x, y) => {
    // Vertical dark gradient: deep midnight blue to slate dark
    const t = y / height;
    let r = Math.round(15 + t * 15);
    let g = Math.round(20 + t * 18);
    let b = Math.round(28 + t * 24);

    // Subtle right vertical divider line
    if (x === width - 1) {
      r = 45;
      g = 52;
      b = 64;
    } else if (x === width - 2) {
      r = 25;
      g = 30;
      b = 38;
    }

    // Centered LocalNote Icon in upper third (centerX = 82, centerY = 110)
    const cx = 82;
    const cy = 110;
    const dx = x - cx;
    const dy = y - cy;

    // Glowing background aura
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 55) {
      const glow = (1 - dist / 55) * 0.25;
      r += Math.round(59 * glow);
      g += Math.round(130 * glow);
      b += Math.round(246 * glow);
    }

    // App Icon Shape: Notebook card (width = 54, height = 64)
    if (Math.abs(dx) <= 27 && Math.abs(dy) <= 32) {
      const cardGrad = (dy + 32) / 64;
      r = Math.round(30 + cardGrad * 10);
      g = Math.round(38 + cardGrad * 12);
      b = Math.round(52 + cardGrad * 16);

      // Card border
      if (Math.abs(dx) === 27 || Math.abs(dy) === 32) {
        r = 71;
        g = 85;
        b = 105;
      }

      // Top Accent bar
      if (dy >= -26 && dy <= -20 && Math.abs(dx) <= 20) {
        r = 59;
        g = 130;
        b = 246; // Blue accent
      }

      // Content preview lines
      const lineY = [-10, -2, 6, 14, 22];
      for (let i = 0; i < lineY.length; i++) {
        const ly = lineY[i];
        const lw = i === lineY.length - 1 ? 10 : 20;
        if (dy >= ly && dy <= ly + 2 && dx >= -20 && dx <= -20 + lw * 2) {
          r = 148;
          g = 163;
          b = 184;
        }
      }
    }

    // Subtle bottom badge / dots decoration
    if (y >= 260 && y <= 263) {
      const dotX = [70, 82, 94];
      for (const d of dotX) {
        if (Math.abs(x - d) <= 2) {
          r = 59;
          g = 130;
          b = 246;
        }
      }
    }

    return [r, g, b];
  });
}

fs.writeFileSync(path.join(iconsDir, 'header.bmp'), generateHeader());
fs.writeFileSync(path.join(iconsDir, 'sidebar.bmp'), generateSidebar());

console.log('Successfully generated NSIS bitmaps in src-tauri/icons/:');
console.log('- header.bmp (150x57)');
console.log('- sidebar.bmp (164x314)');
