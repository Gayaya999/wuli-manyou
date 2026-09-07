import {
  SHELLS,
  pixelate,
  generatedFace,
  composeDisk,
  waitForFonts,
} from "./disk-compose.js";
import { api, apiEnabled, mediaUrl, migrateLocalIfNeeded } from "./api.js";

const STORAGE_KEY = "qo-community-posts";
const MAX_POSTS = 18;

const SEEDS = [
  {
    id: "seed-chen",
    name: "陈麦",
    latin: "Chen Mai",
    years: "2026",
    keywords: "苹果 · 下落",
    note: "苹果落下的时候，我也在场。",
    when: "昨日",
    shellId: "ivory",
  },
  {
    id: "seed-jiang",
    name: "江河",
    latin: "Jiang He",
    years: "2026",
    keywords: "电梯 · 时间",
    note: "把怀表放进电梯，指针还在走。",
    when: "三日前",
    shellId: "cobalt",
  },
  {
    id: "seed-mulan",
    name: "木兰",
    latin: "Mu Lan",
    years: "2026",
    keywords: "箱子 · 猫",
    note: "薛定谔的箱子，盖子先别开。",
    when: "上周",
    shellId: "forest",
  },
  {
    id: "seed-alo",
    name: "阿洛",
    latin: "Alo",
    years: "2026",
    keywords: "相互作用",
    note: "费曼图画在手心，洗不掉。",
    when: "上周",
    shellId: "orange",
  },
  {
    id: "seed-lin",
    name: "林晓秋",
    latin: "Lin Xiaoqiu",
    years: "2026",
    keywords: "左右",
    note: "镜子里的左右，和这边不一样。",
    when: "更早",
    shellId: "burgundy",
  },
];

const wall = document.querySelector("#communityWall");
const openUpload = document.querySelector("#openUpload");
const uploadRoom = document.querySelector("#uploadRoom");
const uploadLeave = document.querySelector("#uploadLeave");
const uploadForm = document.querySelector("#uploadForm");
const uploadName = document.querySelector("#uploadName");
const uploadNote = document.querySelector("#uploadNote");
const uploadPortrait = document.querySelector("#uploadPortrait");
const uploadHint = document.querySelector("#uploadHint");
const uploadPreview = document.querySelector("#uploadPreview");
const uploadShells = document.querySelector("#uploadShells");
const uploadStatus = document.querySelector("#uploadStatus");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const retrieveButton = document.querySelector("#retrieve");

let portraitImage = null;
let selectedShell = "graphite";
let wallInspectId = null;
let usingServer = false;

function displayImage(post) {
  if (post.image) return post.image;
  if (post.imageUrl) return mediaUrl(post.imageUrl);
  return composeDisk({
    name: post.name,
    latin: post.latin || (post.name || "?").slice(0, 1).toUpperCase(),
    years: post.years || "2026",
    keywords: post.keywords || "观察 · 停留",
    archive: post.archiveLabel || post.archive || "BOARD",
    shellId: post.shellId || "graphite",
    portrait: generatedFace(post.name),
  });
}

function adaptServerPost(post) {
  return {
    ...post,
    owned: Boolean(post.mine),
    image: post.imageUrl ? mediaUrl(post.imageUrl) : "",
    when: post.when ?? "刚刚",
  };
}
function loadPosts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.image) : [];
  } catch {
    return [];
  }
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.slice(0, MAX_POSTS)));
}

function mintPost(entry, index) {
  return {
    ...entry,
    owned: Boolean(entry.owned),
    archive: entry.archive ?? `BOARD ${String(index + 1).padStart(2, "0")}`,
    image: composeDisk({
      name: entry.name,
      latin: entry.latin,
      years: entry.years,
      keywords: entry.keywords,
      archive: entry.archive ?? `BOARD ${String(index + 1).padStart(2, "0")}`,
      shellId: entry.shellId,
      portrait: entry.portrait ?? generatedFace(entry.name),
    }),
  };
}

async function ensureSeeds() {
  const existing = loadPosts();
  if (existing.length) return existing;
  await waitForFonts();
  const seeded = SEEDS.map((seed, index) => mintPost(seed, index));
  savePosts(seeded);
  return seeded;
}

function renderWall(posts) {
  if (!wall) return;
  wall.replaceChildren(
    ...posts.map((post) => {
      const imageSrc = post.image || displayImage(post);
      const article = document.createElement("article");
      article.className = "board-post";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "board-disk";
      button.dataset.image = imageSrc;
      button.dataset.id = post.id || "";
      button.dataset.mine = post.owned || post.mine ? "1" : "";
      button.setAttribute("aria-label", `${post.name}的档案软盘`);
      const image = document.createElement("img");
      image.src = imageSrc;
      image.alt = `${post.name}的档案软盘`;
      button.append(image);
      const name = document.createElement("p");
      name.className = "board-name";
      name.textContent = post.name;
      const note = document.createElement("p");
      note.className = "board-note";
      note.textContent = post.note;
      const when = document.createElement("p");
      when.className = "board-when";
      when.textContent = post.when ?? "刚刚";
      article.append(button, name, note, when);
      return article;
    }),
  );
}

function renderSwatches() {
  if (!uploadShells) return;
  uploadShells.replaceChildren(
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
  if (uploadStatus) uploadStatus.textContent = text;
}

function openUploadRoom() {
  renderSwatches();
  setStatus("");
  uploadRoom?.showModal();
  uploadName?.focus();
}

function closeUploadRoom() {
  uploadRoom?.close();
}

function showPortrait(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    portraitImage = image;
    uploadPreview.src = url;
    uploadPreview.hidden = false;
    uploadHint.hidden = true;
  };
  image.src = url;
}

async function refreshWallFromServer() {
  const payload = await api("/api/community/posts");
  usingServer = true;
  await waitForFonts();
  renderWall((payload.posts ?? []).map(adaptServerPost));
}

async function submitUpload(event) {
  event.preventDefault();
  const name = uploadName?.value.trim();
  const note = uploadNote?.value.trim();
  if (!name) {
    setStatus("先写下名字。");
    uploadName?.focus();
    return;
  }
  if (!note) {
    setStatus("留下一句观察。");
    uploadNote?.focus();
    return;
  }
  await waitForFonts();
  const portrait = portraitImage ? pixelate(portraitImage) : generatedFace(name);
  const posts = loadPosts();
  const post = mintPost(
    {
      id: `user-${Date.now()}`,
      owned: true,
      name,
      latin: name.slice(0, 1).toUpperCase(),
      years: String(new Date().getFullYear()),
      keywords: "观察 · 停留",
      note,
      when: "刚刚",
      shellId: selectedShell,
      portrait,
      archive: `BOARD ${String(posts.length + 1).padStart(2, "0")}`,
    },
    0,
  );
  if (apiEnabled()) {
    try {
      await api("/api/community/posts", {
        method: "POST",
        json: {
          name,
          note,
          shellId: selectedShell,
          latin: name.slice(0, 1).toUpperCase(),
          image: post.image,
        },
      });
      await refreshWallFromServer();
    } catch {
      savePosts([post, ...posts]);
      renderWall(loadPosts());
      setStatus("展墙暂时离线，先存在这台机器。");
    }
  } else {
    savePosts([post, ...posts]);
    renderWall(loadPosts());
  }
  uploadForm?.reset();
  portraitImage = null;
  if (uploadPreview) {
    uploadPreview.hidden = true;
    uploadPreview.removeAttribute("src");
  }
  if (uploadHint) uploadHint.hidden = false;
  closeUploadRoom();
}

openUpload?.addEventListener("click", openUploadRoom);
uploadLeave?.addEventListener("click", closeUploadRoom);
uploadRoom?.addEventListener("click", (event) => {
  if (event.target === uploadRoom) closeUploadRoom();
});
uploadForm?.addEventListener("submit", submitUpload);
uploadPortrait?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) showPortrait(file);
});
uploadShells?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shell]");
  if (!button) return;
  selectedShell = button.dataset.shell;
  renderSwatches();
});
wall?.addEventListener("click", (event) => {
  const button = event.target.closest(".board-disk");
  if (!button || !lightbox || !lightboxImage) return;
  wallInspectId = button.dataset.id || null;
  lightboxImage.src = button.dataset.image;
  lightboxImage.alt = button.getAttribute("aria-label") ?? "";
  if (retrieveButton) {
    retrieveButton.hidden = !button.dataset.mine;
    retrieveButton.dataset.scope = button.dataset.mine ? "wall" : "";
  }
  lightbox.showModal();
});

retrieveButton?.addEventListener("click", async () => {
  if (!wallInspectId || !usingServer || retrieveButton?.dataset.scope !== "wall") return;
  const id = wallInspectId;
  try {
    await api(`/api/community/posts/${id}`, { method: "DELETE" });
    wallInspectId = null;
    lightbox.close();
    await refreshWallFromServer();
  } catch {
    wallInspectId = null;
  }
});

async function bootWall() {
  renderSwatches();
  if (apiEnabled()) {
    try {
      await migrateLocalIfNeeded();
      await refreshWallFromServer();
      return;
    } catch {
      usingServer = false;
    }
  }
  ensureSeeds().then(renderWall);
}

bootWall();
