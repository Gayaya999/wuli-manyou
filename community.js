import { hashString } from "./disk-compose.js";

// Community feed: posts with images, likes and comments.
// Inside a claude.ai artifact the feed is shared through the `db` capability;
// anywhere else it falls back to this browser's localStorage.

const THEME_KEY = "qo-alt-theme";
const PROFILE_KEY = "qo-visitor-profile";
const ALIAS_KEY = "qo-community-alias";
const LOCAL_ID_KEY = "qo-community-uid";
const LOCAL_POSTS_KEY = "qo-community-v2-posts";
const LOCAL_COMMENTS_KEY = "qo-community-v2-comments";
const LOCAL_LIKES_KEY = "qo-community-v2-likes";

const MAX_TEXT = 500;
const MAX_COMMENT = 200;
const MAX_IMAGES = 4;
const INLINE_BUDGET = 180_000; // bytes of data: URLs per post when assets are unavailable
const ASSET_ID = /^[A-Za-z0-9]{32}$/;
// Images that ship with the site itself (used by the demo posts).
const SITE_IMAGE = /^\.\/(assets|experiences|published-modules|theme-packs)\/[\w\-/]+\.(png|jpe?g|webp)$/;

const TOPICS = [
  { id: "free", name: "随想" },
  { id: "newton", name: "牛顿" },
  { id: "einstein", name: "爱因斯坦" },
  { id: "maxwell", name: "麦克斯韦" },
  { id: "bohr", name: "玻尔" },
  { id: "schrodinger", name: "薛定谔" },
  { id: "dirac", name: "狄拉克" },
  { id: "debroglie", name: "德布罗意" },
  { id: "feynman", name: "费曼" },
  { id: "yang", name: "杨振宁" },
];
const topicById = new Map(TOPICS.map((topic) => [topic.id, topic]));

// Shown only while the feed is empty, so a new community never opens on a blank wall.
const EXAMPLES = [
  {
    id: "example-apple",
    alias: "陈麦",
    text: "看完《苹果之外》才反应过来：月亮其实一直在往下掉，只是它横着跑得够快，每次都“掉偏了”。",
    topic: "newton",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "example-clock",
    alias: "江河",
    text: "如果把怀表放进一部一直加速上升的电梯，表里的人能分清自己是在加速，还是站在更重的星球上吗？",
    topic: "einstein",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "example-box",
    alias: "木兰",
    text: "薛定谔的箱子，盖子先别开。今天在图鉴里点亮了第三位科学家。",
    topic: "schrodinger",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
  },
].map((post) => ({ ...post, example: true, images: [] }));

const $ = (selector) => document.querySelector(selector);
const appearance = $(".appearance");
const statsEl = $("#cmStats");
const composer = $("#composer");
const composeAvatar = $("#composeAvatar");
const composeText = $("#composeText");
const composeThumbs = $("#composeThumbs");
const composeTopics = $("#composeTopics");
const composeImages = $("#composeImages");
const composeAlias = $("#composeAlias");
const composeCount = $("#composeCount");
const composeSubmit = $("#composeSubmit");
const composeStatus = $("#composeStatus");
const feedEl = $("#feed");
const feedEmpty = $("#feedEmpty");
const tabs = document.querySelector(".cm-tabs");
const topicFilter = $("#topicFilter");
const topicList = $("#topicList");
const featuredEl = $("#featured");
const modeEl = $("#cmMode");
const lightbox = $("#lightbox");
const lightboxImage = $("#lightboxImage");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  posts: [],
  comments: [],
  likes: new Map(), // postId -> Set(userId)
  sort: "new",
  topic: "all",
  composeTopic: "free",
  pending: [], // { file, url }
  open: new Set(), // postIds with comments expanded
  busy: false,
};

let store = null;

/* ---------- small helpers ---------- */

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A small coloured pixel portrait per person, so the feed reads as many different people.
const SKINS = ["#f1c9a5", "#e8b48c", "#d79c74", "#c68863", "#f5d6bc", "#a8704e"];
const HAIRS = ["#2a211c", "#4a3226", "#6b4a32", "#1d1d24", "#8a5a3c", "#b9812f", "#5b5f6b", "#7a2f2a"];
const SHIRTS = ["#3c6e8f", "#8f3c4e", "#3f7a52", "#c27a2c", "#5a4a8a", "#2f5f5f", "#a8483a", "#41506b"];
const faces = new Map();
function faceFor(seed) {
  const key = seed || "visitor";
  if (faces.has(key)) return faces.get(key);
  const n = hashString(key);
  const pick = (list, shift) => list[(n >>> shift) % list.length];
  const grid = 16;
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = grid;
  const ctx = tiny.getContext("2d");
  const box = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  box(`hsl(${n % 360} 42% 82%)`, 0, 0, grid, grid);
  const hair = pick(HAIRS, 3);
  const skin = pick(SKINS, 6);
  box(pick(SHIRTS, 9), 2, 13, 12, 3);
  box(skin, 6, 11, 4, 2);
  box(skin, 4, 4, 8, 8);
  const style = (n >>> 12) % 4;
  box(hair, 4, 2, 8, 3);
  if (style === 0) box(hair, 3, 3, 1, 6), box(hair, 12, 3, 1, 6); // long
  if (style === 1) box(hair, 3, 3, 10, 2); // fringe
  if (style === 2) box(hair, 5, 1, 6, 1); // tall
  if (style === 3) box(hair, 3, 3, 1, 3), box(hair, 12, 3, 1, 3);
  box("#1b1b1f", 6, 7, 1, 1);
  box("#1b1b1f", 9, 7, 1, 1);
  if ((n >>> 15) & 1) box("#1b1b1f", 5, 6, 3, 1), box("#1b1b1f", 8, 6, 3, 1), box("#1b1b1f", 7, 7, 2, 1); // glasses
  box((n >>> 16) & 1 ? "#b5574b" : "#8c5a48", 7, 10, 2, 1);
  const out = document.createElement("canvas");
  out.width = out.height = 64;
  const outCtx = out.getContext("2d");
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(tiny, 0, 0, 64, 64);
  const url = out.toDataURL("image/png");
  faces.set(key, url);
  return url;
}

function when(ms) {
  const diff = Date.now() - ms;
  const minute = 60_000;
  if (diff < minute) return "刚刚";
  if (diff < minute * 60) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < minute * 60 * 24) return `${Math.floor(diff / (minute * 60))} 小时前`;
  if (diff < minute * 60 * 24 * 7) return `${Math.floor(diff / (minute * 60 * 24))} 天前`;
  const date = new Date(ms);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function imageSrc(image) {
  if (!image || typeof image !== "object") return "";
  if (typeof image.id === "string" && ASSET_ID.test(image.id)) return `/_blob/${image.id}`;
  if (typeof image.src === "string" && image.src.startsWith("data:image/")) return image.src;
  if (typeof image.path === "string" && SITE_IMAGE.test(image.path)) return image.path;
  return "";
}

function createdAtOf(data) {
  if (Number(data.createdAt)) return Number(data.createdAt);
  if (Number(data.agoMinutes)) return Date.now() - Number(data.agoMinutes) * 60_000;
  return 0;
}

function cleanPost(id, data) {
  if (!data || typeof data.text !== "string") return null;
  return {
    id,
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    alias: typeof data.alias === "string" ? data.alias.slice(0, 16) : "",
    text: data.text.slice(0, MAX_TEXT),
    topic: topicById.has(data.topic) ? data.topic : "free",
    images: Array.isArray(data.images) ? data.images.slice(0, MAX_IMAGES) : [],
    createdAt: createdAtOf(data),
    demo: data.demo === true,
  };
}

function cleanComment(id, data) {
  if (!data || typeof data.text !== "string" || typeof data.postId !== "string") return null;
  return {
    id,
    postId: data.postId,
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    alias: typeof data.alias === "string" ? data.alias.slice(0, 16) : "",
    text: data.text.slice(0, MAX_COMMENT),
    createdAt: createdAtOf(data),
    demo: data.demo === true,
  };
}

/* ---------- image preparation ---------- */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    image.src = url;
  });
}

function shrink(image, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

async function prepareImages(files, canUpload) {
  const out = [];
  if (canUpload) {
    for (const file of files) {
      const blob = await toBlob(shrink(await loadImage(file), 1600), 0.85);
      out.push({ blob });
    }
    return out;
  }
  // No asset storage: keep small inline copies so the post stays under the document limit.
  const share = INLINE_BUDGET / Math.max(1, files.length);
  for (const file of files) {
    const image = await loadImage(file);
    let side = 960;
    let quality = 0.78;
    let data = shrink(image, side).toDataURL("image/jpeg", quality);
    while (data.length > share && side > 240) {
      side = Math.round(side * 0.8);
      quality = Math.max(0.5, quality - 0.06);
      data = shrink(image, side).toDataURL("image/jpeg", quality);
    }
    out.push({ src: data });
  }
  return out;
}

/* ---------- stores ---------- */

function localStore() {
  let uid = safeGet(LOCAL_ID_KEY, "");
  if (!uid) {
    uid = `local-${Math.random().toString(36).slice(2, 10)}`;
    safeSet(LOCAL_ID_KEY, uid);
  }
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());
  let demo = { posts: [], comments: [], likes: {} };
  fetch("./data/community-demo.json", { cache: "no-store" })
    .then((response) => response.json())
    .then((payload) => {
      demo = {
        posts: (payload.posts || []).map((p) => cleanPost(p.id, p)).filter(Boolean),
        comments: (payload.comments || []).map((c) => cleanComment(c.id, c)).filter(Boolean),
        likes: payload.likes || {},
      };
      emit();
    })
    .catch(() => {});
  const own = () => ({
    posts: (safeGet(LOCAL_POSTS_KEY, []) || []).map((p) => cleanPost(p.id, p)).filter(Boolean),
    comments: (safeGet(LOCAL_COMMENTS_KEY, []) || []).map((c) => cleanComment(c.id, c)).filter(Boolean),
    likes: safeGet(LOCAL_LIKES_KEY, {}) || {},
  });
  const read = () => {
    const mine = own();
    return {
      posts: [...mine.posts, ...demo.posts],
      comments: [...demo.comments, ...mine.comments],
      likes: { ...demo.likes, ...mine.likes },
    };
  };
  const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const writeOrFail = (key, value) => {
    if (!safeSet(key, value)) throw Object.assign(new Error("full"), { code: "quota_exceeded" });
  };
  return {
    mode: "local",
    uid,
    canWrite: true,
    canUpload: false,
    isOwner: false,
    subscribe(fn) {
      listeners.push(fn);
      addEventListener("storage", fn);
      fn();
    },
    snapshot: read,
    async addPost(post) {
      const { posts } = own();
      writeOrFail(LOCAL_POSTS_KEY, [{ ...post, id: newId() }, ...posts]);
      emit();
    },
    async deletePost(id) {
      const data = own();
      writeOrFail(LOCAL_POSTS_KEY, data.posts.filter((p) => p.id !== id));
      writeOrFail(LOCAL_COMMENTS_KEY, data.comments.filter((c) => c.postId !== id));
      emit();
    },
    async addComment(comment) {
      const { comments } = own();
      writeOrFail(LOCAL_COMMENTS_KEY, [...comments, { ...comment, id: newId() }]);
      emit();
    },
    async deleteComment(id) {
      const { comments } = own();
      writeOrFail(LOCAL_COMMENTS_KEY, comments.filter((c) => c.id !== id));
      emit();
    },
    async setLike(postId, liked) {
      const { likes } = own();
      const mine = { ...(likes[uid] || {}) };
      if (liked) mine[postId] = true;
      else delete mine[postId];
      writeOrFail(LOCAL_LIKES_KEY, { ...likes, [uid]: mine });
      emit();
    },
  };
}

async function claudeStore() {
  if (typeof window.claude?.use !== "function") return null;
  const db = await window.claude.use("db");
  if (!db) return null;
  const [user, assets] = await Promise.all([window.claude.use("user"), window.claude.use("assets")]);
  const uid = user ? await user.id() : null;
  const canWriteFlag = user ? await user.can("data.write") : null;
  const isOwner = user ? await user.isOwner() : false;

  const posts = db.collection("posts");
  const comments = db.collection("comments");
  const likes = db.collection("likes");
  let snap = { posts: [], comments: [], likes: {} };
  let myLikes = {};
  let likeWrite = Promise.resolve();

  return {
    mode: "shared",
    uid,
    user,
    canWrite: Boolean(uid) && canWriteFlag !== false,
    canUpload: Boolean(assets),
    isOwner,
    subscribe(fn) {
      const fail = (error) => {
        if (error?.code === "revoked") store.canWrite = false;
        setStatus(statsEl, "社区暂时连不上，稍后刷新试试。");
      };
      posts.orderBy("createdAt", "desc").limit(300).onSnapshot((qs) => {
        snap.posts = qs.docs.map((d) => cleanPost(d.id, d.data())).filter(Boolean);
        fn();
      }, fail);
      comments.orderBy("createdAt", "asc").limit(1000).onSnapshot((qs) => {
        snap.comments = qs.docs.map((d) => cleanComment(d.id, d.data())).filter(Boolean);
        fn();
      }, fail);
      likes.onSnapshot((qs) => {
        const next = {};
        qs.docs.forEach((d) => {
          const body = d.data();
          if (body && typeof body.posts === "object" && body.posts) next[d.id] = body.posts;
        });
        snap.likes = next;
        if (uid && next[uid]) myLikes = { ...next[uid] };
        fn();
      }, fail);
    },
    snapshot: () => snap,
    async uploadImage(blob) {
      const result = await assets.upload(blob, { type: "image/jpeg" });
      return { id: result.id };
    },
    async addPost(post) {
      await posts.add(post);
    },
    async deletePost(id) {
      const post = snap.posts.find((p) => p.id === id);
      await posts.doc(id).delete();
      for (const comment of snap.comments.filter((c) => c.postId === id)) {
        await comments.doc(comment.id).delete().catch(() => {});
      }
      for (const image of post?.images || []) {
        if (assets && image?.id) await assets.delete(image.id).catch(() => {});
      }
    },
    async addComment(comment) {
      await comments.add(comment);
    },
    async deleteComment(id) {
      await comments.doc(id).delete();
    },
    async setLike(postId, liked) {
      if (liked) myLikes[postId] = true;
      else delete myLikes[postId];
      const body = { posts: { ...myLikes } };
      // One write at a time to this viewer's own likes document.
      likeWrite = likeWrite.catch(() => {}).then(() => likes.doc(uid).set(body));
      return likeWrite;
    },
  };
}

/* ---------- derived data ---------- */

function refresh() {
  const snap = store.snapshot();
  state.posts = snap.posts;
  state.comments = snap.comments;
  const likes = new Map();
  Object.entries(snap.likes || {}).forEach(([userId, map]) => {
    Object.keys(map || {}).forEach((postId) => {
      if (!map[postId]) return;
      if (!likes.has(postId)) likes.set(postId, new Set());
      likes.get(postId).add(userId);
    });
  });
  state.likes = likes;
  renderComposerAccess();
  render();
}

const likeCount = (postId) => state.likes.get(postId)?.size || 0;
const likedByMe = (postId) => Boolean(store.uid && state.likes.get(postId)?.has(store.uid));
const commentsFor = (postId) => state.comments.filter((c) => c.postId === postId);

function visiblePosts() {
  const real = state.posts;
  let list = real.length ? real : EXAMPLES;
  if (state.topic !== "all") list = list.filter((p) => p.topic === state.topic);
  if (state.sort === "mine") list = real.filter((p) => p.authorId && p.authorId === store.uid);
  if (state.sort === "hot") {
    const score = (p) => {
      const ageHours = (Date.now() - p.createdAt) / 3_600_000;
      return (likeCount(p.id) * 3 + commentsFor(p.id).length * 2 + 1) / Math.pow(ageHours + 2, 0.8);
    };
    list = [...list].sort((a, b) => score(b) - score(a));
  } else {
    list = [...list].sort((a, b) => b.createdAt - a.createdAt);
  }
  return list;
}

/* ---------- names ---------- */

let profiles = {};
async function resolveNames(ids) {
  if (!store.user || !ids.length) return;
  try {
    const next = await store.user.profiles(ids);
    const changed = ids.some((id) => (profiles[id]?.name || "") !== (next[id]?.name || ""));
    profiles = { ...profiles, ...next };
    if (changed) render();
  } catch {}
}

function displayName(item) {
  if (item.alias) return item.alias;
  return profiles[item.authorId]?.name || "来访者";
}

/* ---------- render ---------- */

function setStatus(node, text) {
  node.textContent = text;
}

function renderStats() {
  const posts = state.posts.length;
  const likes = [...state.likes.values()].reduce((sum, set) => sum + set.size, 0);
  const comments = state.comments.length;
  statsEl.textContent = posts
    ? `${posts} 条帖子 · ${likes} 个赞 · ${comments} 条评论`
    : "还没有人发帖，下面是几条示例。";
}

function heartIcon(filled) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 9 8");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  // Pixel heart, drawn on a 9×8 grid.
  path.setAttribute(
    "d",
    filled
      ? "M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1V0z"
      : "M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1V0zm0 1v3h1v1h1v1h1v1h1V6h1V5h1V4h1V1H6v1H5v1H4V2H3V1H1z",
  );
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  return svg;
}

function bubbleIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 9 8");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M1 0h7v1h1v4H8v1H4v1H3v1H2V6H1V5H0V1h1V0zm0 1v4h2v1h1V5h4V1H1z");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  return svg;
}

function topicChip(topicId) {
  const topic = topicById.get(topicId) || TOPICS[0];
  const chip = el("button", "cm-chip");
  chip.type = "button";
  chip.dataset.filter = topic.id;
  if (topic.id !== "free") {
    const disk = el("img", "cm-chip-disk");
    disk.src = `./assets/disks/${topic.id}.png`;
    disk.alt = "";
    chip.append(disk);
  }
  chip.append(document.createTextNode(`# ${topic.name}`));
  return chip;
}

function renderComments(post) {
  const wrap = el("div", "cm-comments");
  const list = el("ul", "cm-comment-list");
  for (const comment of commentsFor(post.id)) {
    const item = el("li", "cm-comment");
    const face = el("img", "cm-avatar cm-avatar-sm");
    face.src = faceFor(comment.authorId || comment.alias);
    face.alt = "";
    const body = el("div", "cm-comment-body");
    const head = el("p", "cm-comment-head");
    head.append(el("strong", "", displayName(comment)), el("span", "cm-time", when(comment.createdAt)));
    body.append(head, el("p", "cm-comment-text", comment.text));
    item.append(face, body);
    if (canRemove(comment)) {
      const remove = el("button", "cm-link", "删除");
      remove.type = "button";
      remove.dataset.action = "delete-comment";
      remove.dataset.id = comment.id;
      item.append(remove);
    }
    list.append(item);
  }
  wrap.append(list);
  if (store.canWrite) {
    const form = el("form", "cm-comment-form");
    form.dataset.postId = post.id;
    const input = el("input");
    input.type = "text";
    input.name = "comment";
    input.maxLength = MAX_COMMENT;
    input.autocomplete = "off";
    input.placeholder = "写下你的回应…";
    input.setAttribute("aria-label", "评论");
    const send = el("button", "cm-send", "回复");
    send.type = "submit";
    form.append(input, send);
    wrap.append(form);
  }
  return wrap;
}

function canRemove(item) {
  return store.canWrite && Boolean(item.authorId) && (item.authorId === store.uid || store.isOwner);
}

function renderPost(post) {
  const card = el("article", "cm-post");
  card.dataset.id = post.id;
  if (post.example) card.classList.add("is-example");

  const head = el("header", "cm-post-head");
  const face = el("img", "cm-avatar");
  face.src = faceFor(post.authorId || post.alias);
  face.alt = "";
  const who = el("div", "cm-who");
  const nameLine = el("p", "cm-name", displayName(post));
  if (post.example) nameLine.append(el("span", "cm-badge", "示例"));
  if (post.authorId && post.authorId === store.uid) nameLine.append(el("span", "cm-badge is-me", "我"));
  who.append(nameLine, el("p", "cm-time", when(post.createdAt)));
  head.append(face, who, topicChip(post.topic));
  card.append(head);

  card.append(el("p", "cm-text", post.text));

  const sources = post.images.map(imageSrc).filter(Boolean);
  if (sources.length) {
    const gallery = el("div", `cm-gallery is-${Math.min(sources.length, 4)}`);
    sources.forEach((src, index) => {
      const kind = /\/(stills|video)\//.test(src) ? " is-film" : /\/(relics|guides|disks)\//.test(src) ? " is-art" : "";
      const button = el("button", `cm-shot${kind}`);
      button.type = "button";
      button.dataset.action = "zoom";
      button.dataset.src = src;
      button.setAttribute("aria-label", `查看第 ${index + 1} 张图片`);
      const img = el("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => button.classList.add("is-missing");
      button.append(img);
      gallery.append(button);
    });
    card.append(gallery);
  }

  const actions = el("footer", "cm-actions");
  const liked = likedByMe(post.id);
  const like = el("button", `cm-act cm-like${liked ? " is-on" : ""}`);
  like.type = "button";
  like.dataset.action = "like";
  like.setAttribute("aria-pressed", String(liked));
  like.setAttribute("aria-label", liked ? "取消点赞" : "点赞");
  like.disabled = !store.canWrite;
  like.append(heartIcon(liked), el("span", "", String(likeCount(post.id) || "赞")));

  const count = commentsFor(post.id).length;
  const open = state.open.has(post.id);
  const talk = el("button", `cm-act${open ? " is-on" : ""}`);
  talk.type = "button";
  talk.dataset.action = "toggle-comments";
  talk.setAttribute("aria-expanded", String(open));
  talk.append(bubbleIcon(), el("span", "", count ? String(count) : "评论"));
  actions.append(like, talk);

  if (canRemove(post)) {
    const remove = el("button", "cm-link cm-remove", "删除");
    remove.type = "button";
    remove.dataset.action = "delete-post";
    actions.append(remove);
  }
  card.append(actions);
  if (open) card.append(renderComments(post));
  return card;
}

function renderFeed() {
  const posts = visiblePosts();
  const focused = document.activeElement;
  const draft =
    focused?.closest?.(".cm-comment-form") && {
      postId: focused.closest(".cm-comment-form").dataset.postId,
      value: focused.value,
      start: focused.selectionStart,
    };
  feedEl.replaceChildren(...posts.map(renderPost));
  feedEmpty.hidden = posts.length > 0;
  feedEmpty.textContent =
    state.sort === "mine" ? "你还没有发过帖子。" : "这个话题下还没有帖子，发第一条吧。";
  if (draft) {
    const input = feedEl.querySelector(`.cm-comment-form[data-post-id="${CSS.escape(draft.postId)}"] input`);
    if (input) {
      input.value = draft.value;
      input.focus();
      input.setSelectionRange(draft.start, draft.start);
    }
  }
  const ids = new Set();
  posts.forEach((post) => {
    if (post.authorId && !post.alias) ids.add(post.authorId);
    if (state.open.has(post.id)) commentsFor(post.id).forEach((c) => c.authorId && !c.alias && ids.add(c.authorId));
  });
  resolveNames([...ids]);
}

function renderTopicControls() {
  const counts = new Map();
  state.posts.forEach((post) => counts.set(post.topic, (counts.get(post.topic) || 0) + 1));

  const all = el("button", "cm-chip", "全部");
  all.type = "button";
  all.dataset.filter = "all";
  const chips = [all, ...TOPICS.map((topic) => topicChip(topic.id))];
  chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.filter === state.topic)));
  topicFilter.replaceChildren(...chips);

  topicList.replaceChildren(
    ...TOPICS.map((topic) => {
      const item = el("li");
      const button = el("button", "cm-topic-row");
      button.type = "button";
      button.dataset.filter = topic.id;
      button.setAttribute("aria-pressed", String(topic.id === state.topic));
      button.append(el("span", "", `# ${topic.name}`), el("span", "cm-topic-count", String(counts.get(topic.id) || 0)));
      item.append(button);
      return item;
    }),
  );
}

function renderComposeTopics() {
  composeTopics.replaceChildren(
    ...TOPICS.map((topic) => {
      const button = el("button", "cm-pick", topic.name);
      button.type = "button";
      button.dataset.topic = topic.id;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(topic.id === state.composeTopic));
      return button;
    }),
  );
}

function renderThumbs() {
  composeThumbs.replaceChildren(
    ...state.pending.map((item, index) => {
      const thumb = el("div", "cm-thumb");
      const img = el("img");
      img.src = item.url;
      img.alt = "";
      const remove = el("button", "cm-thumb-x", "×");
      remove.type = "button";
      remove.dataset.index = String(index);
      remove.setAttribute("aria-label", "移除这张图片");
      thumb.append(img, remove);
      return thumb;
    }),
  );
  composeThumbs.hidden = state.pending.length === 0;
}

function render() {
  renderStats();
  renderTopicControls();
  renderFeed();
  tabs.querySelectorAll("[data-sort]").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.sort === state.sort));
  });
}

function renderComposerAccess() {
  const off = !store.canWrite;
  [composeText, composeImages, composeAlias, composeSubmit].forEach((node) => (node.disabled = off));
  composer.classList.toggle("is-readonly", off);
  if (off) setStatus(composeStatus, "你目前只能浏览社区，需要编辑或贡献者权限才能发帖。");
  const base =
    store.mode === "shared"
      ? "帖子、点赞和评论对能打开这个页面的人共享。"
      : "当前为本机预览：帖子只保存在这台设备的浏览器里。";
  modeEl.textContent = state.posts.some((post) => post.demo) ? `${base}社区目前含演示数据。` : base;
}

async function renderFeatured() {
  try {
    const response = await fetch("./data/community-feed.json", { cache: "no-store" });
    const payload = await response.json();
    const items = (payload.posts || []).filter((item) => !item.hidden).slice(0, 4);
    featuredEl.replaceChildren(
      ...items.map((item) => {
        const link = el("a", "cm-work");
        link.href = typeof item.play === "string" && item.play.startsWith("./") ? item.play : "./";
        if (item.cover) {
          const cover = el("img");
          cover.src = item.cover;
          cover.alt = "";
          cover.loading = "lazy";
          link.append(cover);
        }
        const copy = el("span", "cm-work-copy");
        copy.append(el("strong", "", item.title || "作品"), el("span", "", [item.label, item.author?.nick].filter(Boolean).join(" · ")));
        link.append(copy);
        return link;
      }),
    );
  } catch {
    featuredEl.replaceChildren(el("p", "cm-muted", "精选作品暂时读不到。"));
  }
}

/* ---------- actions ---------- */

function explain(error) {
  if (error?.code === "quota_exceeded" || error?.code === "quota_or_state") return "空间满了，删掉一些旧帖再试。";
  if (error?.code === "too_large") return "图片太大了，换一张小一点的。";
  if (error?.code === "rate_limited" || error?.code === "resource_exhausted") return "操作太快了，稍等一下。";
  if (error?.code === "invalid_argument" || error?.code === "not_granted") {
    store.canWrite = false;
    renderComposerAccess();
    render();
    return "你目前没有发帖权限。";
  }
  return "没能保存，稍后再试。";
}

async function submitPost(event) {
  event.preventDefault();
  if (state.busy || !store.canWrite) return;
  const text = composeText.value.trim();
  if (!text && !state.pending.length) {
    setStatus(composeStatus, "写点什么，或放一张图片。");
    composeText.focus();
    return;
  }
  state.busy = true;
  composeSubmit.disabled = true;
  setStatus(composeStatus, state.pending.length ? "正在处理图片…" : "正在发布…");
  try {
    const prepared = await prepareImages(
      state.pending.map((item) => item.file),
      store.canUpload,
    );
    const images = [];
    for (const item of prepared) {
      images.push(item.blob ? await store.uploadImage(item.blob) : { src: item.src });
    }
    const alias = composeAlias.value.trim().slice(0, 16);
    safeSet(ALIAS_KEY, alias);
    await store.addPost({
      authorId: store.uid || "",
      alias,
      text: text.slice(0, MAX_TEXT),
      topic: state.composeTopic,
      images,
      createdAt: Date.now(),
    });
    composeText.value = "";
    state.pending.forEach((item) => URL.revokeObjectURL(item.url));
    state.pending = [];
    renderThumbs();
    updateCount();
    state.sort = "new";
    state.topic = "all";
    setStatus(composeStatus, "已发布。");
    render();
    feedEl.firstElementChild?.classList.add("is-arriving");
  } catch (error) {
    setStatus(composeStatus, explain(error));
  } finally {
    state.busy = false;
    composeSubmit.disabled = !store.canWrite;
  }
}

function addFiles(files) {
  const images = [...files].filter((file) => file.type.startsWith("image/"));
  const room = MAX_IMAGES - state.pending.length;
  if (images.length > room) setStatus(composeStatus, `每条最多 ${MAX_IMAGES} 张图片。`);
  images.slice(0, Math.max(0, room)).forEach((file) => {
    state.pending.push({ file, url: URL.createObjectURL(file) });
  });
  renderThumbs();
}

function updateCount() {
  composeCount.textContent = `${composeText.value.length} / ${MAX_TEXT}`;
}

async function onFeedClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest(".cm-post");
  const postId = card?.dataset.id;
  const action = button.dataset.action;

  if (action === "zoom") {
    lightboxImage.src = button.dataset.src;
    lightbox.showModal();
    return;
  }
  if (action === "toggle-comments") {
    if (state.open.has(postId)) state.open.delete(postId);
    else state.open.add(postId);
    renderFeed();
    if (state.open.has(postId)) feedEl.querySelector(`[data-id="${CSS.escape(postId)}"] .cm-comment-form input`)?.focus();
    return;
  }
  if (action === "like") {
    if (!store.canWrite || !store.uid) return;
    const liked = !likedByMe(postId);
    // Optimistic: show the new state now, the snapshot confirms it.
    if (!state.likes.has(postId)) state.likes.set(postId, new Set());
    if (liked) state.likes.get(postId).add(store.uid);
    else state.likes.get(postId).delete(store.uid);
    renderFeed();
    renderStats();
    if (liked && !reduceMotion) feedEl.querySelector(`[data-id="${CSS.escape(postId)}"] .cm-like`)?.classList.add("is-pop");
    try {
      await store.setLike(postId, liked);
    } catch (error) {
      setStatus(statsEl, explain(error));
      refresh();
    }
    return;
  }
  if (action === "delete-post") {
    if (!confirm("删除这条帖子和它下面的评论？")) return;
    try {
      await store.deletePost(postId);
    } catch (error) {
      setStatus(statsEl, explain(error));
    }
    return;
  }
  if (action === "delete-comment") {
    try {
      await store.deleteComment(button.dataset.id);
    } catch (error) {
      setStatus(statsEl, explain(error));
    }
  }
}

async function onCommentSubmit(event) {
  const form = event.target.closest(".cm-comment-form");
  if (!form) return;
  event.preventDefault();
  const input = form.elements.comment;
  const text = input.value.trim();
  if (!text || !store.canWrite) return;
  input.disabled = true;
  try {
    await store.addComment({
      postId: form.dataset.postId,
      authorId: store.uid || "",
      alias: composeAlias.value.trim().slice(0, 16),
      text: text.slice(0, MAX_COMMENT),
      createdAt: Date.now(),
    });
    input.value = "";
  } catch (error) {
    setStatus(statsEl, explain(error));
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function onFilterClick(event) {
  const chip = event.target.closest("[data-filter]");
  if (!chip) return;
  state.topic = state.topic === chip.dataset.filter && chip.dataset.filter !== "all" ? "all" : chip.dataset.filter;
  if (state.sort === "mine") state.sort = "new";
  render();
}

/* ---------- theme ---------- */

function preferredTheme() {
  const saved = safeGet(THEME_KEY, null);
  if (saved === "light" || saved === "dark") return saved;
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {}
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
  appearance?.querySelectorAll("[data-theme]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  });
}

/* ---------- boot ---------- */

function wire() {
  appearance?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme]");
    if (button) applyTheme(button.dataset.theme, true);
  });
  composer.addEventListener("submit", submitPost);
  composeText.addEventListener("input", updateCount);
  composeImages.addEventListener("change", () => {
    addFiles(composeImages.files || []);
    composeImages.value = "";
  });
  composer.addEventListener("dragover", (event) => {
    if (!store?.canWrite) return;
    event.preventDefault();
    composer.classList.add("is-hot");
  });
  composer.addEventListener("dragleave", () => composer.classList.remove("is-hot"));
  composer.addEventListener("drop", (event) => {
    event.preventDefault();
    composer.classList.remove("is-hot");
    if (store?.canWrite) addFiles(event.dataTransfer?.files || []);
  });
  composeThumbs.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-index]");
    if (!remove) return;
    const [item] = state.pending.splice(Number(remove.dataset.index), 1);
    if (item) URL.revokeObjectURL(item.url);
    renderThumbs();
  });
  composeTopics.addEventListener("click", (event) => {
    const pick = event.target.closest("[data-topic]");
    if (!pick) return;
    state.composeTopic = pick.dataset.topic;
    renderComposeTopics();
  });
  tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-sort]");
    if (!tab) return;
    state.sort = tab.dataset.sort;
    render();
  });
  topicFilter.addEventListener("click", onFilterClick);
  topicList.addEventListener("click", onFilterClick);
  feedEl.addEventListener("click", onFeedClick);
  feedEl.addEventListener("submit", onCommentSubmit);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
}

async function boot() {
  applyTheme(preferredTheme(), false);
  wire();
  renderComposeTopics();
  renderThumbs();
  updateCount();
  renderFeatured();

  const profile = safeGet(PROFILE_KEY, {}) || {};
  composeAlias.value = safeGet(ALIAS_KEY, "") || (typeof profile.name === "string" ? profile.name : "");

  store = (await claudeStore().catch(() => null)) || localStore();
  composeAvatar.src = typeof profile.portrait === "string" && profile.portrait.startsWith("data:image/")
    ? profile.portrait
    : faceFor(store.uid || composeAlias.value);
  renderComposerAccess();
  store.subscribe(refresh);
}

boot();
