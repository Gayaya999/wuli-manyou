import { api, apiEnabled, mediaUrl, migrateLocalIfNeeded, fromServerDisk } from "./api.js";

const THEME_KEY = "qo-alt-theme";
const PROFILE_KEY = "qo-visitor-profile";
const DISKS_KEY = "qo-visitor-disks";
const TALKS_KEY = "qo-visitor-talks";

const SCIENTISTS = [
  { id: "newton", name: "牛顿", latin: "Isaac Newton", disk: "./assets/disks/newton.png" },
  { id: "einstein", name: "爱因斯坦", latin: "Albert Einstein", disk: "./assets/disks/einstein.png" },
  { id: "dirac", name: "狄拉克", latin: "Paul Dirac", disk: "./assets/disks/dirac.png" },
  { id: "feynman", name: "费曼", latin: "Richard Feynman", disk: "./assets/disks/feynman.png" },
  { id: "yang", name: "杨振宁", latin: "Chen-Ning Yang", disk: "./assets/disks/yang.png" },
  { id: "bohr", name: "玻尔", latin: "Niels Bohr", disk: "./assets/disks/bohr.png" },
  { id: "debroglie", name: "德布罗意", latin: "Louis de Broglie", disk: "./assets/disks/debroglie.png" },
  { id: "schrodinger", name: "薛定谔", latin: "Erwin Schrödinger", disk: "./assets/disks/schrodinger.png" },
  { id: "maxwell", name: "麦克斯韦", latin: "James Clerk Maxwell", disk: "./assets/disks/maxwell.png" },
];

const appearance = document.querySelector(".appearance");
const identityName = document.querySelector("#roomTitle");
const identityLatin = document.querySelector("#identityLatin");
const visitorName = document.querySelector("#visitorName");
const visitorLatin = document.querySelector("#visitorLatin");
const signForm = document.querySelector("#signForm");
const signStatus = document.querySelector("#signStatus");
const pixelPortrait = document.querySelector("#pixelPortrait");
const portraitForm = document.querySelector("#portraitForm");
const portraitDrop = document.querySelector("#portraitDrop");
const portraitFile = document.querySelector("#portraitFile");
const portraitHint = document.querySelector("#portraitHint");
const clearPortrait = document.querySelector("#clearPortrait");
const ledger = document.querySelector("#ledger");
let sourceImage = null;
const mineCabinet = document.querySelector("#mineCabinet");
const disksNote = document.querySelector("#disksNote");
const talkList = document.querySelector("#talkList");
const talksNote = document.querySelector("#talksNote");
const atlasGrid = document.querySelector("#atlasGrid");
const atlasCount = document.querySelector("#atlasCount");
let serverMe = null;
let serverAtlas = null;
let serverTalks = null;

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

function loadProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}");
    return {
      name: typeof parsed?.name === "string" ? parsed.name : "",
      latin: typeof parsed?.latin === "string" ? parsed.latin : "",
      portrait: typeof parsed?.portrait === "string" ? parsed.portrait : "",
    };
  } catch {
    return { name: "", latin: "", portrait: "" };
  }
}

function saveProfile(patch) {
  const current = loadProfile();
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...current, ...patch, updatedAt: Date.now() }),
  );
}

function loadOwnedDisks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISKS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.image) : [];
  } catch {
    return [];
  }
}

function loadTalks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TALKS_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function talkRows() {
  const talks = loadTalks();
  return SCIENTISTS.flatMap((scientist) => {
    const log = talks[scientist.id];
    if (!Array.isArray(log) || log.length === 0) return [];
    const last = [...log].reverse().find((item) => item?.text);
    if (!last) return [];
    return [{ scientist, last, count: log.length }];
  });
}

function pixelatePortrait(source, cells = 36) {
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = cells;
  const tinyCtx = tiny.getContext("2d");
  const size = Math.min(source.width, source.height);
  const sx = (source.width - size) / 2;
  const sy = (source.height - size) / 2;
  tinyCtx.imageSmoothingEnabled = true;
  tinyCtx.drawImage(source, sx, sy, size, size, 0, 0, cells, cells);
  const data = tinyCtx.getImageData(0, 0, cells, cells);
  const step = 32;
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = Math.round(data.data[i] / step) * step;
    data.data[i + 1] = Math.round(data.data[i + 1] / step) * step;
    data.data[i + 2] = Math.round(data.data[i + 2] / step) * step;
  }
  tinyCtx.putImageData(data, 0, 0);
  const out = document.createElement("canvas");
  out.width = out.height = 256;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(tiny, 0, 0, 256, 256);
  return out.toDataURL("image/png");
}

function readSource(file) {
  if (!file?.type.startsWith("image/")) {
    signStatus.textContent = "请放进一张图片。";
    return;
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    portraitHint.textContent = "照片已放入，可以生成";
    signStatus.textContent = "";
  };
  image.onerror = () => {
    sourceImage = null;
    signStatus.textContent = "这张照片读不出来，换一张。";
  };
  image.src = url;
}

function renderIdentity() {
  const profile = loadProfile();
  const name = profile.name.trim();
  const latin = profile.latin.trim();
  identityName.textContent = name || "尚未署名";
  identityLatin.textContent = latin || "Visitor";
  visitorName.value = name;
  visitorLatin.value = latin;
  if (profile.portrait) {
    pixelPortrait.src = profile.portrait;
    pixelPortrait.hidden = false;
    pixelPortrait.alt = `${name || "来访者"}的像素形象`;
    clearPortrait.hidden = false;
  } else {
    pixelPortrait.removeAttribute("src");
    pixelPortrait.hidden = true;
    clearPortrait.hidden = true;
  }
}

function renderLedger() {
  if (serverMe?.ledger) {
    const { disks, talks, atlas } = serverMe.ledger;
    ledger.textContent = `软盘 ${disks} 张 · 通信 ${talks} 人 · 图鉴 ${atlas} / 9`;
    return;
  }
  const disks = loadOwnedDisks().length;
  const talks = talkRows().length;
  ledger.textContent = `软盘 ${disks} 张 · 通信 ${talks} 人 · 图鉴 ${talks} / 9`;
}

function renderAtlas() {
  const cells = serverAtlas?.cells;
  const met = new Set(
    cells
      ? cells.filter((cell) => cell.met).map((cell) => cell.id)
      : talkRows().map((row) => row.scientist.id),
  );
  if (atlasCount) atlasCount.textContent = `走过 ${met.size} / 9`;
  atlasGrid.replaceChildren(
    ...SCIENTISTS.map((scientist) => {
      const known = met.has(scientist.id);
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = `atlas-cell${known ? " is-met" : " is-empty"}`;
      link.href = `./?figure=${scientist.id}&talk=1#stage`;
      link.setAttribute("aria-label", known ? `继续与${scientist.name}对话` : `去认识${scientist.name}`);
      const image = document.createElement("img");
      image.src = scientist.disk;
      image.alt = `${scientist.name}的档案软盘`;
      const who = document.createElement("span");
      who.textContent = scientist.name;
      link.append(image, who);
      item.append(link);
      return item;
    }),
  );
}

function renderDisks() {
  const disks = loadOwnedDisks();
  disksNote.hidden = disks.length > 0;
  mineCabinet.replaceChildren(
    ...disks.map((disk) => {
      const link = document.createElement("a");
      link.className = "slot";
      link.href = "./visitors.html";
      link.setAttribute("aria-label", `查看${disk.name}的档案软盘`);
      const image = document.createElement("img");
      image.src = disk.image;
      image.alt = `${disk.name}的档案软盘`;
      const caption = document.createElement("span");
      caption.textContent = disk.name;
      link.append(image, caption);
      return link;
    }),
  );
}

function renderTalks() {
  const rows = serverTalks?.rows?.length
    ? serverTalks.rows.map((row) => ({
        scientist: {
          id: row.scientistId,
          name: row.name,
          latin: row.latin,
        },
        last: { text: row.lastText },
        count: row.count,
      }))
    : talkRows();
  talksNote.hidden = rows.length > 0;
  talkList.replaceChildren(
    ...rows.map(({ scientist, last, count }) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `./?figure=${scientist.id}&talk=1#stage`;
      const latin = document.createElement("p");
      latin.className = "latin";
      latin.textContent = scientist.latin;
      const who = document.createElement("p");
      who.className = "who";
      who.textContent = scientist.name;
      const line = document.createElement("p");
      line.className = "last";
      line.textContent = last.text;
      const meta = document.createElement("p");
      meta.className = "count";
      meta.textContent = `${count} 句`;
      link.append(latin, who, line, meta);
      item.append(link);
      return item;
    }),
  );
}

function renderRoom() {
  renderIdentity();
  renderLedger();
  renderAtlas();
  renderDisks();
  renderTalks();
}

signForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = visitorName.value.trim();
  const latin = visitorLatin.value.trim();
  if (!name) {
    signStatus.textContent = "先写下中文名。";
    visitorName.focus();
    return;
  }
  saveProfile({ name, latin });
  if (apiEnabled()) {
    try {
      serverMe = await api("/api/me", { method: "PUT", json: { name, latin } });
      serverAtlas = await api("/api/me/atlas");
    } catch {
      signStatus.textContent = "档案暂时离线，先写在这台机器上。";
      renderRoom();
      return;
    }
  }
  renderRoom();
  signStatus.textContent = "已写入档案。";
});

portraitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sourceImage) {
    signStatus.textContent = "先放进一张照片。";
    return;
  }
  try {
    const portrait = pixelatePortrait(sourceImage);
    saveProfile({ portrait });
    if (apiEnabled()) {
      try {
        const payload = await api("/api/me/portrait", { method: "POST", json: { image: portrait } });
        if (payload?.portraitUrl) saveProfile({ portrait: mediaUrl(payload.portraitUrl) });
        serverMe = await api("/api/me");
      } catch {
        signStatus.textContent = "形象已生成。档案暂时离线，先存在这台机器上。";
        renderRoom();
        return;
      }
    }
    renderRoom();
    signStatus.textContent = "像素形象已写入档案。";
  } catch {
    signStatus.textContent = "这张照片写不下了，换一张更小的。";
  }
});

clearPortrait.addEventListener("click", async () => {
  sourceImage = null;
  portraitHint.textContent = "放进一张照片";
  portraitFile.value = "";
  saveProfile({ portrait: "" });
  if (apiEnabled()) {
    try {
      await api("/api/me/portrait", { method: "DELETE" });
      serverMe = await api("/api/me");
    } catch {
      /* keep local clear */
    }
  }
  renderRoom();
  signStatus.textContent = "已取回像素形象。";
});

portraitDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  portraitDrop.classList.add("is-hot");
});

portraitDrop.addEventListener("dragleave", () => {
  portraitDrop.classList.remove("is-hot");
});

portraitDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  portraitDrop.classList.remove("is-hot");
  const file = event.dataTransfer?.files?.[0];
  if (file) readSource(file);
});

portraitFile.addEventListener("change", () => {
  const file = portraitFile.files?.[0];
  if (file) readSource(file);
});

appearance?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme]");
  if (!button) return;
  applyTheme(button.dataset.theme, true);
});

window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
  if (localStorage.getItem(THEME_KEY)) return;
  applyTheme(event.matches ? "light" : "dark", false);
});

applyTheme(preferredTheme(), false);

async function boot() {
  if (apiEnabled()) {
    try {
      await migrateLocalIfNeeded();
      serverMe = await api("/api/me");
      if (serverMe.name || serverMe.latin) {
        saveProfile({ name: serverMe.name, latin: serverMe.latin });
      }
      if (serverMe.portraitUrl) {
        saveProfile({ portrait: mediaUrl(serverMe.portraitUrl) });
      }
      const disksPayload = await api("/api/disks");
      localStorage.setItem(
        DISKS_KEY,
        JSON.stringify((disksPayload.disks ?? []).map(fromServerDisk)),
      );
      serverAtlas = await api("/api/me/atlas");
      serverTalks = await api("/api/me/talks");
    } catch {
      serverMe = null;
      serverAtlas = null;
      serverTalks = null;
    }
  }
  renderRoom();
}

boot();
