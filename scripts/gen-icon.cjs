/**
 * 生成 AssetVault 应用图标
 * 运行: node scripts/gen-icon.cjs
 */
const { createCanvas } = require("canvas");
const toIco = require("to-ico");
const fs = require("fs");
const path = require("path");

const SIZES = [16, 32, 48, 64, 128, 256];

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background: gradient blue-purple
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#3b82f6");
  gradient.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Center "A" letter
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.55}px -apple-system, "Microsoft YaHei", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", size / 2, size / 2);

  // Small sparkle in corner
  const sparkSize = size * 0.22;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(size * 0.78, size * 0.22, sparkSize / 2, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

async function main() {
  const outDir = path.join(__dirname, "..", "public");
  const pngs = [];

  // Generate PNGs
  for (const size of SIZES) {
    const canvas = drawIcon(size);
    const buf = canvas.toBuffer("image/png");
    const file = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(file, buf);
    pngs.push(buf);
    console.log(`✓ ${size}x${size} PNG`);
  }

  // Generate ICO (combines 16, 32, 48)
  const icoBuf = await toIco(pngs.slice(0, 3));
  fs.writeFileSync(path.join(outDir, "icon.ico"), icoBuf);
  console.log("✓ icon.ico (16+32+48)");

  // Also overwrite favicon
  const small = drawIcon(32);
  fs.writeFileSync(path.join(outDir, "favicon.ico"), await toIco([small.toBuffer("image/png")]));
  console.log("✓ favicon.ico");

  console.log("\n图标生成完成！public/icon.ico");
}

main().catch(console.error);
