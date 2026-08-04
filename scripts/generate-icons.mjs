/**
 * generate-icons.mjs
 * Generates placeholder PWA icons from the existing favicon.png using sharp.
 * Run: node scripts/generate-icons.mjs
 *
 * Install sharp first: npm install -D sharp
 */
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, "../public/icons");

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [192, 256, 384, 512];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0f1117";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.18);
  ctx.fill();

  // Glow
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
  glow.addColorStop(0, "rgba(99,102,241,0.35)");
  glow.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Letter J
  ctx.fillStyle = "#6366f1";
  ctx.font = `bold ${Math.round(size * 0.52)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("J", size / 2, size / 2 + size * 0.03);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buffer);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}-maskable.png`), buffer);
  console.log(`✅ Generated icon-${size}.png`);
}

console.log("✅ All PWA icons generated in public/icons/");
