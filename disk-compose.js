export const DISK_SIZE = 480;

export const SHELLS = [
  { id: "graphite", label: "石墨", body: "#1c1c1c", dark: "#0d0d0d", light: "#3a3a3a" },
  { id: "ivory", label: "象牙", body: "#e4dcc6", dark: "#b8af96", light: "#f3eee0" },
  { id: "cobalt", label: "钴蓝", body: "#2a4a8c", dark: "#173064", light: "#3d63b0" },
  { id: "orange", label: "橙", body: "#d15d24", dark: "#8f3a12", light: "#e0783c" },
  { id: "forest", label: "森林绿", body: "#1d4a3c", dark: "#102c24", light: "#2c6552" },
  { id: "burgundy", label: "酒红", body: "#6a2436", dark: "#3c121e", light: "#83344a" },
  { id: "mustard", label: "芥末", body: "#c49a3c", dark: "#8a6a22", light: "#d4b056" },
  { id: "violet", label: "紫", body: "#4a3568", dark: "#2a1e40", light: "#5e457e" },
  { id: "teal", label: "青绿", body: "#1f5a5a", dark: "#123838", light: "#2d7272" },
];

export function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function floppyPath(ctx, x, y, w, h, r, cut) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, family, weight, start) {
  let size = start;
  while (size > 10) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  ctx.font = `${weight} 10px ${family}`;
  return 10;
}

export function pixelate(source) {
  const cells = 34;
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = cells;
  const tinyCtx = tiny.getContext("2d");
  const size = Math.min(source.width, source.height);
  const sx = (source.width - size) / 2;
  const sy = (source.height - size) / 2;
  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.drawImage(source, sx, sy, size, size, 0, 0, cells, cells);
  const data = tinyCtx.getImageData(0, 0, cells, cells);
  for (let i = 0; i < data.data.length; i += 4) {
    const gray = data.data[i] * 0.3 + data.data[i + 1] * 0.59 + data.data[i + 2] * 0.11;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = gray;
  }
  tinyCtx.putImageData(data, 0, 0);
  const out = document.createElement("canvas");
  out.width = out.height = 220;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(tiny, 0, 0, 220, 220);
  return out;
}

export function generatedFace(seed) {
  const n = hashString(seed);
  const cells = 32;
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = cells;
  const ctx = tiny.getContext("2d");
  ctx.fillStyle = `hsl(${n % 360} 12% 16%)`;
  ctx.fillRect(0, 0, cells, cells);
  ctx.fillStyle = `hsl(${(n >> 8) % 360} 18% 28%)`;
  ctx.fillRect(3, 22, 26, 10);
  const skin = 168 + (n % 40);
  ctx.fillStyle = `rgb(${skin}, ${skin - 18}, ${skin - 36})`;
  ctx.fillRect(9, 8, 14, 15);
  ctx.fillRect(8, 10, 16, 12);
  ctx.fillStyle = `rgb(${28 + (n % 40)}, ${22 + (n % 24)}, ${18 + (n % 18)})`;
  ctx.fillRect(8, 5, 16, 7 + (n % 3));
  if (n & 1) ctx.fillRect(7, 8, 3, 11);
  if (n & 2) ctx.fillRect(22, 8, 3, 11);
  ctx.fillStyle = "#141414";
  ctx.fillRect(11, 14, 2, 2);
  ctx.fillRect(19, 14, 2, 2);
  if (n & 4) {
    ctx.fillRect(10, 13, 5, 1);
    ctx.fillRect(17, 13, 5, 1);
    ctx.fillRect(14, 14, 4, 1);
  }
  ctx.fillRect(13, 19, 6, 1);
  return pixelate(tiny);
}

export function composeDisk({ name, latin, years, keywords, archive, shellId, portrait }) {
  const shell = SHELLS.find((item) => item.id === shellId) ?? SHELLS[0];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = DISK_SIZE;
  const ctx = canvas.getContext("2d");
  const x = 38;
  const y = 26;
  const w = 404;
  const h = 428;
  const cut = 34;

  floppyPath(ctx, x, y, w, h, 16, cut);
  ctx.fillStyle = shell.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const gloss = ctx.createLinearGradient(x, y, x + w, y + h);
  gloss.addColorStop(0, shell.light);
  gloss.addColorStop(0.45, shell.body);
  gloss.addColorStop(1, shell.dark);
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.strokeStyle = shell.dark;
  ctx.lineWidth = 3;
  floppyPath(ctx, x, y, w, h, 16, cut);
  ctx.stroke();

  const shutterX = x + 78;
  const shutterY = y + 16;
  const shutterW = 248;
  const shutterH = 68;
  const metal = ctx.createLinearGradient(shutterX, shutterY, shutterX, shutterY + shutterH);
  metal.addColorStop(0, "#ececec");
  metal.addColorStop(0.45, "#b8b8b8");
  metal.addColorStop(1, "#8d8d8d");
  roundRect(ctx, shutterX, shutterY, shutterW, shutterH, 6);
  ctx.fillStyle = metal;
  ctx.fill();
  roundRect(ctx, shutterX + 88, shutterY + 18, 72, 32, 3);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + 118, 28, 0, Math.PI * 2);
  ctx.fillStyle = shell.dark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 118, 12, 0, Math.PI * 2);
  ctx.fillStyle = "#cfcfc8";
  ctx.fill();

  ctx.fillStyle = shell.dark;
  roundRect(ctx, x + 28, y + h - 28, 22, 16, 3);
  ctx.fill();
  roundRect(ctx, x + w - 50, y + h - 28, 22, 16, 3);
  ctx.fill();

  const lx = x + 26;
  const ly = y + 158;
  const lw = w - 52;
  const lh = h - 196;
  roundRect(ctx, lx, ly, lw, lh, 5);
  ctx.fillStyle = "#e7d7bc";
  ctx.fill();

  const px = lx + 10;
  const py = ly + 10;
  const pw = 132;
  const ph = lh - 20;
  ctx.fillStyle = "#111";
  ctx.fillRect(px, py, pw, ph);
  const face = portrait ?? generatedFace(name);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(face, px + 5, py + 5, pw - 10, ph - 10);

  const tx = px + pw + 10;
  const ty = ly + 10;
  const tw = lw - pw - 30;
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(tx, ty, tw, 40);
  ctx.fillStyle = "#f4efe6";
  fitText(ctx, name, tw - 16, '"Noto Sans SC", sans-serif', 600, 16);
  ctx.fillText(name, tx + 8, ty + 26);

  ctx.fillStyle = "#1b1b1b";
  fitText(ctx, latin, tw - 12, '"Noto Sans SC", sans-serif', 700, 13);
  ctx.fillText(latin, tx + 8, ty + 64);

  ctx.strokeStyle = "#1b1b1b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx + 8, ty + 78);
  ctx.lineTo(tx + tw - 8, ty + 78);
  ctx.stroke();
  ctx.font = '12px "Noto Sans SC", sans-serif';
  ctx.fillText(years, tx + 8, ty + 98);
  ctx.beginPath();
  ctx.moveTo(tx + 8, ty + 108);
  ctx.lineTo(tx + tw - 8, ty + 108);
  ctx.stroke();

  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(tx, ty + 118, tw, 36);
  ctx.fillStyle = "#f4efe6";
  fitText(ctx, keywords, tw - 14, '"Noto Sans SC", sans-serif', 500, 12);
  ctx.fillText(keywords, tx + 8, ty + 141);

  ctx.fillStyle = "#c7d4ae";
  ctx.fillRect(tx, ty + 162, tw, 28);
  ctx.fillStyle = "#1b1b1b";
  ctx.font = '12px "Fusion Pixel 12", "Noto Sans SC", sans-serif';
  ctx.fillText(archive, tx + 8, ty + 181);

  return canvas.toDataURL("image/png");
}

export async function waitForFonts() {
  try {
    await document.fonts.ready;
    await document.fonts.load('16px "Noto Sans SC"');
    await document.fonts.load('12px "Fusion Pixel 12"');
  } catch {
    /* keep compositing with fallbacks */
  }
}
