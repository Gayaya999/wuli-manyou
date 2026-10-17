import { worksForScientist } from "./work-catalog.mjs";
const list = document.querySelector("#worksList");
const requestedFigure = new URLSearchParams(location.search).get("figure");
if (list?.dataset.worksScope === "scientist" && requestedFigure) list.dataset.scientistId = requestedFigure;
if (!list) {
  /* this page has no works wall */
}

const LIKES_KEY = "qo-feed-likes";
const COMMENTS_KEY = "qo-feed-comments";
const MAX_TEXT = 140;
const MAX_NICK = 12;

function readStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function likedPosts() {
  const stored = readStore(LIKES_KEY, []);
  return new Set(Array.isArray(stored) ? stored.filter((item) => typeof item === "string") : []);
}

function localComments() {
  const stored = readStore(COMMENTS_KEY, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function stripUrls(text) {
  return String(text)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function likeCount(post) {
  const base = Number(post.likes);
  return (Number.isFinite(base) ? base : 0) + (likedPosts().has(post.id) ? 1 : 0);
}

function commentCount(post) {
  return (Array.isArray(post.comments) ? post.comments.length : 0) + ((localComments()[post.id]) || []).length;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function commentList(post) {
  const merged = [
    ...(Array.isArray(post.comments) ? post.comments : []).map((item) => ({ ...item, tag: "展板" })),
    ...((localComments()[post.id]) || []).map((item) => ({ ...item, tag: "本机" })),
  ].sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  const ol = el("ol", "works-notes");
  if (!merged.length) ol.append(el("li", "works-note-empty", "还没有留言。"));
  merged.forEach((item) => {
    const li = el("li", "works-note");
    const head = el("p", "works-note-head");
    head.append(el("strong", null, item.nick || "访客"), el("span", null, item.tag), el("time", null, item.at || ""));
    li.append(head, el("p", "works-note-text", item.text));
    ol.append(li);
  });
  return ol;
}

function entry(post, index) {
  const article = el("article", "works-item");
  article.dataset.kind = post.kind || "game";
  article.id = `experiment-${post.id}`;
  const media = el("a", "works-media");
  media.href = post.play;
  media.setAttribute("aria-label", `${post.kind === "film" ? "观看" : "试玩"}《${post.title}》`);
  if (post.kind === "film") media.dataset.experience = "film";
  const image = el("img", "works-cover");
  image.src = post.cover;
  image.alt = "";
  image.loading = "lazy";
  media.append(image);
  const badge = el("span", "works-badge", `${String(index + 1).padStart(2, "0")} / ${post.label || "互动体验"}`);
  const launch = el("span", "works-launch", "▶");
  launch.setAttribute("aria-hidden", "true");
  media.append(badge, launch);
  // The cover and its stills read as one picture column; the copy sits beside it.
  const visual = el("div", "works-visual");
  visual.append(media);
  article.append(visual);

  const body = el("div", "works-copy");
  const titleRow = el("div", "works-title-row");
  titleRow.append(el("h3", null, post.title));
  if (post.download) {
    const dl = el("a", "works-download", "↓");
    dl.href = post.download;
    dl.download = "";
    dl.setAttribute("aria-label", `下载《${post.title}》完整作品`);
    titleRow.append(dl);
  }
  body.append(titleRow, el("p", "works-caption", post.summary));
  if (post.stills?.length) {
    const strip = el("div", "works-stills");
    post.stills.forEach((still) => {
      const shot = el("figure");
      const img = el("img");
      img.src = still.src;
      img.alt = "";
      img.loading = "lazy";
      shot.append(img, el("figcaption", null, still.label));
      strip.append(shot);
    });
    visual.append(strip);
  }
  const community = el("details", "works-community");
  community.append(el("summary", null, "收藏与留言"));
  const actions = el("div", "works-actions");
  const like = el("button", "works-like");
  like.type = "button";
  const renderLike = () => {
    const liked = likedPosts().has(post.id);
    like.classList.toggle("is-liked", liked);
    like.setAttribute("aria-pressed", String(liked));
    like.textContent = liked ? `已记下 ${likeCount(post)}` : `记下 ${likeCount(post)}`;
  };
  renderLike();
  like.addEventListener("click", () => {
    const set = likedPosts();
    if (set.has(post.id)) set.delete(post.id);
    else set.add(post.id);
    localStorage.setItem(LIKES_KEY, JSON.stringify([...set]));
    renderLike();
  });
  actions.append(like);
  const noteBtn = el("button");
  noteBtn.type = "button";
  noteBtn.textContent = `留言 ${commentCount(post)}`;
  noteBtn.setAttribute("aria-expanded", "false");
  actions.append(noteBtn);
  community.append(actions);

  const drawer = el("div", "works-drawer");
  drawer.hidden = true;
  const form = el("form", "works-note-form");
  const nick = el("input");
  nick.maxLength = MAX_NICK;
  nick.placeholder = "署名（可空）";
  nick.setAttribute("aria-label", "留言署名");
  nick.autocomplete = "off";
  const text = el("input");
  text.maxLength = MAX_TEXT;
  text.required = true;
  text.placeholder = "写一句观察";
  text.setAttribute("aria-label", "留言内容");
  text.autocomplete = "off";
  const submit = el("button");
  submit.type = "submit";
  submit.textContent = "留下";
  form.append(nick, text, submit);
  const status = el("p", "works-status");
  status.setAttribute("aria-live", "polite");
  const rebuild = () => {
    drawer.replaceChildren(commentList(post), form, status);
    noteBtn.textContent = `留言 ${commentCount(post)}`;
  };
  rebuild();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const clean = stripUrls(text.value).slice(0, MAX_TEXT);
    if (!clean) {
      status.textContent = "留言不能为空，链接会被去掉。";
      return;
    }
    const all = localComments();
    (all[post.id] ||= []).push({
      nick: stripUrls(nick.value).slice(0, MAX_NICK),
      text: clean,
      at: new Date().toISOString().slice(0, 10),
    });
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    text.value = "";
    status.textContent = "已留下，保存在这台机器上。";
    rebuild();
  });
  noteBtn.addEventListener("click", () => {
    drawer.hidden = !drawer.hidden;
    noteBtn.setAttribute("aria-expanded", String(!drawer.hidden));
  });
  community.append(drawer);
  body.append(community);
  article.append(body);
  return article;
}

let catalogue = [];
function renderWorks() {
  if (!list) return;
  const scoped = list.dataset.worksScope === "scientist";
  const posts = scoped ? worksForScientist(catalogue, list.dataset.scientistId) : catalogue.filter((post) => post.play && !post.hidden);
  const section = list.closest(".works");
  if (section) section.hidden = posts.length === 0;
  list.replaceChildren(...posts.map(entry));
  document.dispatchEvent(new CustomEvent("wuli:works-rendered"));
}

document.addEventListener("wuli:scientist-change", renderWorks);
async function loadWorks() {
  if (!list) return;
  const feedUrl = list.dataset.worksFeed || "./data/community-feed.json";
  try {
    const response = await fetch(feedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    catalogue = Array.isArray(data.posts) ? data.posts : [];
    renderWorks();
  } catch {
    catalogue = [];
    renderWorks();
  }
}

loadWorks();
