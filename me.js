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

/* ---------- 演示档案：只在页面上展示，不读写真实档案 ---------- */
const DEMO_TALKS = {
  newton: ["苹果为什么会掉下来，月亮却不会？", "月亮其实也在下落，只是它横着跑得足够快，每一刻都落偏了一点。", "那如果把炮弹打得更快呢？", "快到一定程度，它就会一直绕着地球落下去——这就是轨道。", "那地球为什么也不会被太阳拉过去？", "它同样在绕着太阳“落”，只是落的方向一直在拐弯。"],
  einstein: ["光再强，频率不够也打不出电子吗？", "是的。光是一份一份的，每一份的能量只由频率决定。"],
  bohr: ["电子为什么不会掉进原子核？", "因为它只能待在几条特定的轨道上，就像楼梯只有固定的台阶。"],
  schrodinger: ["那只猫到底是死是活？", "我提出它，本来是想说明：把量子规则直接搬到猫身上，会多么荒谬。"],
  feynman: ["你画的那些小图到底在算什么？", "每一条线都是粒子走过的一种可能，把所有可能加起来，就是答案。", "听起来像在画漫画。", "好的物理常常就是一幅能算的漫画。"],
};
const DEMO = {
  profile: { name: "林晓秋", latin: "X. LIN", portrait: "" },
  talks: Object.fromEntries(
    Object.entries(DEMO_TALKS).map(([id, lines]) => [id, lines.map((text, i) => ({ role: i % 2 ? "scientist" : "visitor", text }))]),
  ),
};
let demo = null;

function demoPortrait() {
  // 16×16 像素头像，放大到 256；风格与社区头像一致。
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = 16;
  const ctx = tiny.getContext("2d");
  const box = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  box("#cfe0d6", 0, 0, 16, 16);
  box("#3c6e8f", 2, 13, 12, 3);
  box("#f1c9a5", 6, 11, 4, 2);
  box("#f1c9a5", 4, 4, 8, 8);
  box("#2a211c", 4, 2, 8, 3);
  box("#2a211c", 3, 3, 1, 7);
  box("#2a211c", 12, 3, 1, 7);
  box("#2a211c", 5, 5, 2, 1);
  box("#2a211c", 9, 5, 2, 1);
  box("#1b1b1f", 6, 7, 1, 1);
  box("#1b1b1f", 9, 7, 1, 1);
  box("#e9a99a", 5, 9, 1, 1);
  box("#e9a99a", 10, 9, 1, 1);
  box("#b5574b", 7, 10, 2, 1);
  const out = document.createElement("canvas");
  out.width = out.height = 256;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(tiny, 0, 0, 256, 256);
  return out.toDataURL("image/png");
}

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
  if (demo) return { ...demo.profile };
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
  if (demo) return demo.talks;
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
  if (!demo && serverMe?.ledger) {
    const { disks, talks, atlas } = serverMe.ledger;
    ledger.textContent = `通信 ${talks} 人`;
    return;
  }
  const disks = loadOwnedDisks().length;
  const talks = talkRows().length;
  ledger.textContent = `通信 ${talks} 人`;
}

// Each scientist is an achievement card: lit after the first exchange, gold after six lines.
const ACHIEVEMENTS = {
  newton: { title: "苹果之问", task: "和牛顿聊聊苹果与月亮" },
  einstein: { title: "追光少年", task: "问爱因斯坦光和时间" },
  dirac: { title: "方程之美", task: "听狄拉克讲一个方程" },
  feynman: { title: "画图的人", task: "让费曼画一张图给你" },
  yang: { title: "镜中左右", task: "和杨振宁聊聊对称" },
  bohr: { title: "能级台阶", task: "问玻尔电子为何不坠落" },
  debroglie: { title: "物质之波", task: "问德布罗意你是不是波" },
  schrodinger: { title: "箱中之猫", task: "掀开薛定谔的箱子" },
  maxwell: { title: "电磁合一", task: "听麦克斯韦讲光的来历" },
};
const MASTER_LINES = 6;
const MILESTONES = [
  { need: 1, title: "初来乍到", note: "点亮第 1 张" },
  { need: 5, title: "半程旅人", note: "点亮 5 张" },
  { need: 9, title: "九人全齐", note: "集齐 9 张" },
];

function renderAtlas() {
  const cells = demo ? null : serverAtlas?.cells;
  const counts = new Map(talkRows().map((row) => [row.scientist.id, row.count]));
  if (cells) cells.filter((cell) => cell.met && !counts.has(cell.id)).forEach((cell) => counts.set(cell.id, 1));
  const lit = SCIENTISTS.filter((scientist) => counts.has(scientist.id)).length;
  if (atlasCount) atlasCount.textContent = `已解锁 ${lit} / 9`;

  const bar = document.querySelector("#achBar");
  const fill = document.querySelector("#achBarFill");
  if (bar && fill) {
    bar.setAttribute("aria-valuenow", String(lit));
    fill.style.width = `${(lit / 9) * 100}%`;
  }
  const milestones = document.querySelector("#achMilestones");
  milestones?.replaceChildren(
    ...MILESTONES.map((m) => {
      const item = document.createElement("li");
      item.className = lit >= m.need ? "is-done" : "";
      const name = document.createElement("strong");
      name.textContent = m.title;
      const note = document.createElement("span");
      note.textContent = lit >= m.need ? "已达成" : m.note;
      item.append(name, note);
      return item;
    }),
  );

  atlasGrid.replaceChildren(
    ...SCIENTISTS.map((scientist, index) => {
      const count = counts.get(scientist.id) || 0;
      const state = count >= MASTER_LINES ? "is-master" : count > 0 ? "is-lit" : "is-locked";
      const achievement = ACHIEVEMENTS[scientist.id];
      const item = document.createElement("li");
      const card = document.createElement("a");
      card.className = `ach-card ${state}`;
      card.href = `./?figure=${scientist.id}&talk=1#stage`;
      card.setAttribute(
        "aria-label",
        count ? `${achievement.title}，已解锁，与${scientist.name}聊了 ${count} 句` : `${achievement.title}，未解锁：${achievement.task}`,
      );
      const no = document.createElement("span");
      no.className = "ach-no";
      no.textContent = `No.${String(index + 1).padStart(2, "0")}`;
      const image = document.createElement("img");
      image.src = scientist.disk;
      image.alt = "";
      const copy = document.createElement("div");
      copy.className = "ach-copy";
      const title = document.createElement("strong");
      title.textContent = achievement.title;
      const who = document.createElement("span");
      who.className = "ach-who";
      who.textContent = scientist.name;
      const task = document.createElement("p");
      task.className = "ach-task";
      task.textContent = count ? `已聊 ${count} 句${count >= MASTER_LINES ? " · 金边" : ` · 再聊 ${MASTER_LINES - count} 句升金边`}` : achievement.task;
      const badge = document.createElement("span");
      badge.className = "ach-badge";
      badge.textContent = count >= MASTER_LINES ? "金边" : count ? "已解锁" : "未解锁";
      copy.append(title, who, task);
      card.append(no, image, copy, badge);
      item.append(card);
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
      link.href = "./community.html";
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
  const rows = !demo && serverTalks?.rows?.length
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
  if (demo) {
    signStatus.textContent = "演示档案不会保存，先退出演示再编辑你自己的档案。";
    return;
  }
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
  if (demo) {
    signStatus.textContent = "演示档案不会保存，先退出演示再编辑你自己的档案。";
    return;
  }
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
  if (demo) {
    signStatus.textContent = "演示档案不会保存，先退出演示再编辑你自己的档案。";
    return;
  }
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

// The atlas folds away; the visitor's choice is remembered on this device.
const ATLAS_OPEN_KEY = "qo-atlas-open";
const atlasToggle = document.querySelector("#atlasToggle");
const atlasBody = document.querySelector("#atlasBody");

function setAtlasOpen(open, persist) {
  if (!atlasToggle || !atlasBody) return;
  atlasBody.dataset.open = String(open);
  atlasBody.inert = !open;
  atlasToggle.setAttribute("aria-expanded", String(open));
  atlasToggle.querySelector("span").textContent = open ? "收起" : "展开";
  if (persist) {
    try {
      localStorage.setItem(ATLAS_OPEN_KEY, open ? "1" : "0");
    } catch {}
  }
}

atlasToggle?.addEventListener("click", () => {
  setAtlasOpen(atlasBody.dataset.open !== "true", true);
});

let atlasStartsOpen = false;
try {
  atlasStartsOpen = localStorage.getItem(ATLAS_OPEN_KEY) === "1";
} catch {}
setAtlasOpen(atlasStartsOpen, false);

const demoBanner = document.querySelector("#demoBanner");
const demoOpen = document.querySelector("#demoOpen");
const demoExit = document.querySelector("#demoExit");

function setDemo(on) {
  if (on && !demo) demo = { ...DEMO, profile: { ...DEMO.profile, portrait: demoPortrait() } };
  if (!on) demo = null;
  document.body.classList.toggle("is-demo", Boolean(demo));
  demoBanner.hidden = !demo;
  demoOpen.hidden = Boolean(demo);
  [visitorName, visitorLatin, portraitFile].forEach((input) => (input.disabled = Boolean(demo)));
  signStatus.textContent = "";
  const lede = document.querySelector(".identity-lede");
  if (lede) lede.textContent = demo ? "一位来访者聊过五位科学家后的档案。" : "你的形象与探索足迹。";
  renderRoom();
  if (demo) setAtlasOpen(true, false);
  else setAtlasOpen(atlasStartsOpen, false);
  const url = new URL(location.href);
  if (demo) url.searchParams.set("demo", "1");
  else url.searchParams.delete("demo");
  history.replaceState(null, "", url);
}

demoOpen?.addEventListener("click", () => {
  setDemo(true);
  demoBanner.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
});
demoExit?.addEventListener("click", () => {
  setDemo(false);
  demoOpen.focus();
});
if (new URLSearchParams(location.search).has("demo")) setDemo(true);
