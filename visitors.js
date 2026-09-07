import {
  SHELLS,
  hashString,
  pixelate,
  generatedFace,
  composeDisk,
  waitForFonts,
} from "./disk-compose.js";
import { api, apiEnabled, migrateLocalIfNeeded, fromServerDisk } from "./api.js";

const THEME_KEY = "qo-alt-theme";
const STORAGE_KEY = "qo-visitor-disks";
const PROFILE_KEY = "qo-visitor-profile";
const MAX_OWNED = 8;

const ARCHIVE_DISKS = [
  { id: "newton", name: "牛顿", image: "./assets/disks/newton.png" },
  { id: "einstein", name: "爱因斯坦", image: "./assets/disks/einstein.png" },
  { id: "dirac", name: "狄拉克", image: "./assets/disks/dirac.png" },
  { id: "feynman", name: "费曼", image: "./assets/disks/feynman.png" },
  { id: "yang", name: "杨振宁", image: "./assets/disks/yang.png" },
  { id: "bohr", name: "玻尔", image: "./assets/disks/bohr.png" },
  { id: "debroglie", name: "德布罗意", image: "./assets/disks/debroglie.png" },
  { id: "schrodinger", name: "薛定谔", image: "./assets/disks/schrodinger.png" },
  { id: "maxwell", name: "麦克斯韦", image: "./assets/disks/maxwell.png" },
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
let portraitFromProfile = false;
let selectedShell = SHELLS[0].id;
let minted = null;
let inspectingId = null;

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
  return `VISITOR ${String(ARCHIVE_DISKS.length + ownedCount + 1).padStart(2, "0")}`;
}

function latinFrom(name) {
  const trimmed = name.trim();
  if (!trimmed) return "VISITOR";
  return trimmed.slice(0, 1).toUpperCase();
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
  return [
    ...owned,
    ...ARCHIVE_DISKS.map((disk) => ({
      ...disk,
      owned: false,
    })),
  ];
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

function loadVisitorProfile() {
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

function applyVisitorProfile() {
  const profile = loadVisitorProfile();
  if (profile.name && !diskName.value.trim()) diskName.value = profile.name;
  if (profile.latin && !diskLatin.value.trim()) diskLatin.value = profile.latin;
  if (!profile.portrait || portraitImage) return;
  const image = new Image();
  image.onload = () => {
    portraitImage = image;
    portraitFromProfile = true;
    dropPreview.src = profile.portrait;
    dropPreview.hidden = false;
    dropHint.hidden = true;
    dropHint.textContent = "已用你的像素形象";
  };
  image.src = profile.portrait;
}

function showPortrait(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    portraitImage = image;
    portraitFromProfile = false;
    dropPreview.src = url;
    dropPreview.hidden = false;
    dropHint.hidden = true;
    dropHint.textContent = "放进一张肖像";
  };
  image.src = url;
}

async function mintDisk() {
  if (!portraitImage) {
    setStatus("先放进一张肖像。");
    return;
  }
  if (!diskName.value.trim()) {
    setStatus("写下名字再制盘。");
    diskName.focus();
    return;
  }
  await waitForFonts();
  const form = readForm();
  const owned = loadOwned();
  const archive = nextArchive(owned.length);
  minted = {
    id: `user-${Date.now()}`,
    owned: true,
    ...form,
    archive,
    image: composeDisk({
      ...form,
      archive,
      portrait: portraitFromProfile ? portraitImage : pixelate(portraitImage),
    }),
    createdAt: Date.now(),
  };
  mintPreview.src = minted.image;
  mintPreview.hidden = false;
  hangButton.disabled = false;
  setStatus("盘已制成。放入展墙，或再改一版。");
}

async function hangDisk() {
  if (!minted) return;
  const owned = loadOwned();
  if (owned.length >= MAX_OWNED) {
    setStatus("档案柜已满，先取回一张。");
    return;
  }
  let arrivingId = minted.id;
  if (apiEnabled()) {
    try {
      const created = await api("/api/disks", {
        method: "POST",
        json: {
          name: minted.name,
          latin: minted.latin,
          years: minted.years,
          keywords: minted.keywords,
          shellId: minted.shellId,
          archive: minted.archive,
          image: minted.image,
        },
      });
      arrivingId = created.id;
      const payload = await api("/api/disks");
      saveOwned((payload.disks ?? []).map(fromServerDisk));
    } catch (error) {
      if (error.status === 409) {
        setStatus("档案柜已满，先取回一张。");
        return;
      }
      try {
        saveOwned([minted, ...owned]);
      } catch {
        setStatus("这台机器写不下了，先取回一张。");
        return;
      }
      setStatus("展墙暂时离线，先存在这台机器。");
    }
  } else {
    try {
      saveOwned([minted, ...owned]);
    } catch {
      setStatus("这台机器写不下了，先取回一张。");
      return;
    }
  }
  minted = null;
  hangButton.disabled = true;
  mintPreview.hidden = true;
  bench.hidden = true;
  if (!benchStatus.textContent.includes("离线")) setStatus("");
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
  if (retrieveButton) retrieveButton.dataset.scope = disk.owned ? "cabinet" : "";
  lightbox.showModal();
}

async function retrieveDisk() {
  if (!inspectingId || retrieveButton?.dataset.scope !== "cabinet") return;
  const id = inspectingId;
  if (apiEnabled()) {
    try {
      await api(`/api/disks/${id}`, { method: "DELETE" });
      const payload = await api("/api/disks");
      saveOwned((payload.disks ?? []).map(fromServerDisk));
    } catch {
      saveOwned(loadOwned().filter((item) => item.id !== id));
    }
  } else {
    saveOwned(loadOwned().filter((item) => item.id !== id));
  }
  inspectingId = null;
  lightbox.close();
  renderCabinet();
  setStatus("已取回这张盘。");
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
  applyVisitorProfile();
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

lightbox.addEventListener("close", () => {
  inspectingId = null;
});

applyTheme(preferredTheme(), false);
renderSwatches();

async function bootCabinet() {
  if (apiEnabled()) {
    try {
      await migrateLocalIfNeeded();
      const payload = await api("/api/disks");
      saveOwned((payload.disks ?? []).map(fromServerDisk));
    } catch {
      /* keep local disks */
    }
  }
  renderCabinet();
}

bootCabinet();
