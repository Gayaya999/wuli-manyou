const THEME_KEY = "qo-alt-theme";
const STORAGE_KEY = "qo-visitor-disks";
const MAX_OWNED = 8;
const DISK_SIZE = 480;

const SHELLS = [
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

const SEEDS = [
  { id: "seed-lin", name: "林晓秋", latin: "X. LIN", years: "2024", keywords: "力学 · 课堂 · 演示", shell: "graphite" },
  { id: "seed-anon", name: "匿名参观者", latin: "ANON", years: "2026", keywords: "观察 · 提问 · 停留", shell: "ivory" },
  { id: "seed-chen", name: "陈予安", latin: "Y. CHEN", years: "高二甲", keywords: "量子 · 概率 · 实验", shell: "cobalt" },
  { id: "seed-zhou", name: "周衡", latin: "H. ZHOU", years: "2025", keywords: "电磁 · 场 · 光", shell: "forest" },
  { id: "seed-ma", name: "马小北", latin: "X. MA", years: "讲解员", keywords: "相对论 · 时空 · 讲解", shell: "orange" },
  { id: "seed-gu", name: "顾晚晴", latin: "W. GU", years: "2026", keywords: "好奇 · 陪看 · 档案", shell: "burgundy" },
  { id: "seed-jiang", name: "江一帆", latin: "Y. JIANG", years: "研究生", keywords: "轨道 · 引力 · 计算", shell: "mustard" },
  { id: "seed-none", name: "无名氏", latin: "VISITOR", years: "来访", keywords: "观看 · 记录 · 留下", shell: "violet" },
];

const appearance = document.querySelector(".appearance");
const cabinet = document.querySelector("#cabinet");
const bench = document.querySelector("#bench");
const openBench = document.querySelector("#openBench");
const closeBench = document.querySelector("#closeBench");
const drop = document.querySelector("#drop");
const portraitInput = document.querySelector("#portrait");
const dropHint = document.querySelector("#dropHint");
const dropPreview = document.querySelector("#dropPreview");
const diskName = document.querySelector("#diskName");
const diskLatin = document.querySelector("#diskLatin");
const diskYears = document.querySelector("#diskYears");
const diskKeywords = document.querySelector("#diskKeywords");
const shellsEl = document.querySelector("#shells");
const mintPreview = document.querySelector("#mintPreview");
const mintButton = document.querySelector("#mint");
const hangButton = document.querySelector("#hang");
const benchStatus = document.querySelector("#benchStatus");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const retrieveButton = document.querySelector("#retrieve");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let portraitImage = null;
let selectedShell = SHELLS[0].id;
let minted = null;
let inspectingId = null;
const seedCache = new Map();

function preferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem(THEME_KEY, theme);
  appearance?.querySelectorAll("[data-theme]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function loadOwned() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.image) : [];
  } catch {
    return [];
  }
}

function saveOwned(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function nextArchive(ownedCount) {
  return `VISITOR ${String(SEEDS.length + ownedCount + 1).padStart(2, "0")}`;
}

function latinFrom(name) {
  const trimmed = name.trim();
  if (!trimmed) return "VISITOR";
  return trimmed.slice(0, 1).toUpperCase();
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

function pixelate(source) {
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

function generatedFace(seed) {
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

function composeDisk({ name, latin, years, keywords, archive, shellId, portrait }) {
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

async function waitForFonts() {
  try {
    await document.fonts.ready;
    await document.fonts.load('16px "Noto Sans SC"');
    await document.fonts.load('12px "Fusion Pixel 12"');
  } catch {
    /* keep compositing with fallbacks */
  }
}

function tiltFor(id) {
  const n = hashString(id);
  return `${(n % 13) - 6}deg`;
}

function nudgeFor(id) {
  const n = hashString(`${id}-nudge`);
  return `${n % 16}px`;
}

function allDisks() {
  const owned = loadOwned();
  return [...owned, ...SEEDS.map((seed, index) => ({
    ...seed,
    owned: false,
    archive: `VISITOR ${String(index + 1).padStart(2, "0")}`,
    image: seedCache.get(seed.id),
  }))];
}

function renderCabinet(arrivingId) {
  const disks = allDisks().filter((disk) => disk.image);
  cabinet.replaceChildren(
    ...disks.map((disk) => {
      const button = document.createElement("button");
      button.className = "slot";
      button.type = "button";
      button.dataset.id = disk.id;
      if (disk.owned) button.classList.add("is-owned");
      if (disk.id === arrivingId && !reduceMotion) button.classList.add("is-arriving");
      button.style.setProperty("--tilt", tiltFor(disk.id));
      button.style.setProperty("--nudge", nudgeFor(disk.id));
      button.setAttribute("aria-label", `查看${disk.name}的档案软盘`);
      const image = document.createElement("img");
      image.src = disk.image;
      image.alt = `${disk.name}的档案软盘`;
      button.append(image);
      return button;
    }),
  );
}

function renderSwatches() {
  shellsEl.replaceChildren(
    ...SHELLS.map((shell) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.shell = shell.id;
      button.style.background = shell.body;
      button.setAttribute("aria-label", shell.label);
      button.setAttribute("aria-pressed", String(shell.id === selectedShell));
      return button;
    }),
  );
}

function setStatus(text) {
  benchStatus.textContent = text;
}

function readForm() {
  const name = diskName.value.trim() || "来访者";
  const latin = diskLatin.value.trim() || latinFrom(name);
  const years = diskYears.value.trim() || "2026";
  const keywords = diskKeywords.value.trim() || "观察 · 提问 · 停留";
  return { name, latin, years, keywords, shellId: selectedShell };
}

function showPortrait(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    portraitImage = image;
    dropPreview.src = url;
    dropPreview.hidden = false;
    dropHint.hidden = true;
  };
  image.src = url;
}

function mintDisk() {
  if (!portraitImage) {
    setStatus("先放进一张肖像。");
    return;
  }
  if (!diskName.value.trim()) {
    setStatus("写下名字再制盘。");
    diskName.focus();
    return;
  }
  const form = readForm();
  const owned = loadOwned();
  minted = {
    id: `user-${Date.now()}`,
    owned: true,
    ...form,
    archive: nextArchive(owned.length),
    image: composeDisk({
      ...form,
      archive: nextArchive(owned.length),
      portrait: pixelate(portraitImage),
    }),
    createdAt: Date.now(),
  };
  mintPreview.src = minted.image;
  mintPreview.hidden = false;
  hangButton.disabled = false;
  setStatus("盘已制成。放入展墙，或再改一版。");
}

function hangDisk() {
  if (!minted) return;
  const owned = loadOwned();
  if (owned.length >= MAX_OWNED) {
    setStatus("这台机器的档案柜已满，先取回一张。");
    return;
  }
  try {
    saveOwned([minted, ...owned]);
  } catch {
    setStatus("这台机器写不下了，先取回一张。");
    return;
  }
  const arrivingId = minted.id;
  minted = null;
  hangButton.disabled = true;
  mintPreview.hidden = true;
  bench.hidden = true;
  setStatus("");
  renderCabinet(arrivingId);
  cabinet.querySelector(`[data-id="${arrivingId}"]`)?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center",
  });
}

function inspectDisk(id) {
  const disk = allDisks().find((item) => item.id === id);
  if (!disk) return;
  inspectingId = disk.id;
  lightboxImage.src = disk.image;
  lightboxImage.alt = `${disk.name}的档案软盘`;
  retrieveButton.hidden = !disk.owned;
  lightbox.showModal();
}

function retrieveDisk() {
  if (!inspectingId) return;
  saveOwned(loadOwned().filter((item) => item.id !== inspectingId));
  inspectingId = null;
  lightbox.close();
  renderCabinet();
  setStatus("已取回这张盘。");
}

function prepareSeeds() {
  SEEDS.forEach((seed, index) => {
    seedCache.set(seed.id, composeDisk({
      name: seed.name,
      latin: seed.latin,
      years: seed.years,
      keywords: seed.keywords,
      archive: `VISITOR ${String(index + 1).padStart(2, "0")}`,
      shellId: seed.shell,
      portrait: generatedFace(seed.id),
    }));
  });
}

appearance?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme]");
  if (!button) return;
  applyTheme(button.dataset.theme, true);
});

window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
  if (localStorage.getItem(THEME_KEY)) return;
  applyTheme(event.matches ? "light" : "dark", false);
});

openBench.addEventListener("click", () => {
  bench.hidden = false;
  bench.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  diskName.focus();
});

closeBench.addEventListener("click", () => {
  bench.hidden = true;
});

drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("is-hot");
});

drop.addEventListener("dragleave", () => {
  drop.classList.remove("is-hot");
});

drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("is-hot");
  const file = event.dataTransfer?.files?.[0];
  if (file?.type.startsWith("image/")) showPortrait(file);
});

portraitInput.addEventListener("change", () => {
  const file = portraitInput.files?.[0];
  if (file) showPortrait(file);
});

shellsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shell]");
  if (!button) return;
  selectedShell = button.dataset.shell;
  renderSwatches();
});

mintButton.addEventListener("click", mintDisk);
hangButton.addEventListener("click", hangDisk);
retrieveButton.addEventListener("click", retrieveDisk);

cabinet.addEventListener("click", (event) => {
  const slot = event.target.closest(".slot");
  if (!slot) return;
  inspectDisk(slot.dataset.id);
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

applyTheme(preferredTheme(), false);
renderSwatches();
waitForFonts().then(() => {
  prepareSeeds();
  renderCabinet();
});
