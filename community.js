const feed = document.querySelector("#feed");
const appearance = document.querySelector(".appearance");

const LIKES_KEY = "qo-feed-likes";
const COMMENTS_KEY = "qo-feed-comments";
const MAX_TEXT = 140;
const MAX_NICK = 12;

let posts = [];

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("qo-alt-theme", theme);
  appearance.querySelectorAll("[data-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.theme === theme)));
}
appearance.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => applyTheme(button.dataset.theme)));
applyTheme(document.documentElement.dataset.theme);

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
  return new Set(Array.isArray(stored) ? stored.filter((x) => typeof x === "string") : []);
}
function localComments() {
  const stored = readStore(COMMENTS_KEY, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}
function stripUrls(text) {
  return String(text).replace(/https?:\/\/\S+/gi, "").replace(/www\.\S+/gi, "").replace(/\s{2,}/g, " ").trim();
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
    ...(Array.isArray(post.comments) ? post.comments : []).map((c) => ({ ...c, tag: "展板" })),
    ...((localComments()[post.id]) || []).map((c) => ({ ...c, tag: "本机" })),
  ].sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  const ol = el("ol", "feed-comments");
  if (!merged.length) ol.append(el("li", "feed-comment-empty", "还没有评论，来写第一条。"));
  merged.forEach((c) => {
    const li = el("li", "feed-comment");
    const head = el("p", "feed-comment-head");
    head.append(el("strong", null, c.nick || "访客"), el("span", "feed-tag", c.tag), el("time", null, c.at || ""));
    li.append(head, el("p", "feed-comment-text", c.text));
    ol.append(li);
  });
  return ol;
}

function card(post) {
  const article = el("article", "feed-card");

  const head = el("header", "feed-head");
  const av = el("span", "feed-avatar");
  av.textContent = (post.author?.nick || "访").slice(0, 1);
  const who = el("div", "feed-who");
  who.append(el("strong", "feed-nick", post.author?.nick || "访客"));
  const sub = el("span", "feed-sub");
  sub.append(el("span", "feed-tag", post.author?.tag || "创作者"), el("time", null, post.at || ""));
  who.append(sub);
  head.append(av, who);
  article.append(head);

  article.append(el("h2", "feed-title", post.title));
  article.append(el("p", "feed-summary", post.summary));

  if (post.cover) {
    const img = el("img", "feed-cover");
    img.src = post.cover;
    img.alt = post.title;
    img.loading = "lazy";
    article.append(img);
  }

  const actions = el("div", "feed-actions");
  const like = el("button", "feed-like");
  like.type = "button";
  const renderLike = () => {
    const liked = likedPosts().has(post.id);
    like.classList.toggle("is-liked", liked);
    like.setAttribute("aria-pressed", String(liked));
    like.textContent = `赞 ${likeCount(post)}`;
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

  const commentBtn = el("button", "feed-comment-toggle");
  commentBtn.type = "button";
  commentBtn.textContent = `评论 ${commentCount(post)}`;
  actions.append(commentBtn);

  if (post.download) {
    const dl = el("a", "feed-download", "下载");
    dl.href = post.download;
    dl.download = "";
    actions.append(dl);
  } else {
    actions.append(el("span", "feed-disabled", "下载·整理中"));
  }
  if (post.play) {
    const play = el("a", "feed-play", "试玩");
    play.href = post.play;
    actions.append(play);
  }
  article.append(actions);

  const drawer = el("div", "feed-drawer");
  drawer.hidden = true;
  const form = el("form", "feed-comment-form");
  const nick = el("input"); nick.maxLength = MAX_NICK; nick.placeholder = "昵称（选填）"; nick.autocomplete = "off";
  const text = el("input"); text.maxLength = MAX_TEXT; text.required = true; text.placeholder = "写条评论（140 字内，不含链接）"; text.autocomplete = "off";
  const submit = el("button", "primary-button compact", "发送"); submit.type = "submit";
  form.append(nick, text, submit);
  const status = el("p", "feed-status"); status.setAttribute("aria-live", "polite");
  const rebuild = () => {
    drawer.replaceChildren(commentList(post), form, status);
    commentBtn.textContent = `评论 ${commentCount(post)}`;
  };
  rebuild();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const clean = stripUrls(text.value).slice(0, MAX_TEXT);
    if (!clean) { status.textContent = "评论不能为空，链接会被去掉。"; return; }
    const all = localComments();
    (all[post.id] ||= []).push({ nick: stripUrls(nick.value).slice(0, MAX_NICK), text: clean, at: new Date().toISOString().slice(0, 10) });
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    text.value = "";
    status.textContent = "已发送，保存在本机。";
    rebuild();
  });
  commentBtn.addEventListener("click", () => { drawer.hidden = !drawer.hidden; });
  article.append(drawer);

  return article;
}

async function loadFeed() {
  try {
    const response = await fetch("./data/community-feed.json", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    posts = Array.isArray(data.posts) ? data.posts : [];
    if (!posts.length) throw new Error();
    feed.replaceChildren(...posts.map(card));
  } catch {
    feed.replaceChildren(el("p", "feed-empty", "还没有人发布。用 Skill 做出第一个科学家游戏吧。"));
  }
}

loadFeed();
