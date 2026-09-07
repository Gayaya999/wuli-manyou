const list = document.querySelector("#worksList");
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

function entry(post) {
  const article = el("article", "works-item");

  if (post.cover) {
    const img = el("img");
    img.src = post.cover;
    img.alt = "";
    img.loading = "lazy";
    article.append(img);
  }

  const body = el("div", "works-copy");
  const meta = el("p", "works-meta");
  meta.append(
    el("span", null, post.author?.nick || "访客"),
    el("span", null, post.author?.tag || "来访者"),
    el("time", null, post.at || ""),
  );
  body.append(el("h3", null, post.title), meta, el("p", null, post.summary));

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
  actions.append(noteBtn);

  if (post.download) {
    const dl = el("a", null, "下载");
    dl.href = post.download;
    dl.download = "";
    actions.append(dl);
  } else {
    actions.append(el("span", "works-muted", "下载尚未备好"));
  }

  if (post.play) {
    const play = el("a", null, "试玩");
    play.href = post.play;
    actions.append(play);
  }
  body.append(actions);

  const drawer = el("div", "works-drawer");
  drawer.hidden = true;
  const form = el("form", "works-note-form");
  const nick = el("input");
  nick.maxLength = MAX_NICK;
  nick.placeholder = "署名（可空）";
  nick.autocomplete = "off";
  const text = el("input");
  text.maxLength = MAX_TEXT;
  text.required = true;
  text.placeholder = "写一句观察，不含链接";
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
  });
  body.append(drawer);
  article.append(body);
  return article;
}

async function loadWorks() {
  if (!list) return;
  const feedUrl = list.dataset.worksFeed || "./data/community-feed.json";
  try {
    const response = await fetch(feedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const posts = Array.isArray(data.posts) ? data.posts : [];
    if (!posts.length) throw new Error();
    list.replaceChildren(...posts.map(entry));
  } catch {
    list.replaceChildren(el("p", "works-empty", "这面墙还空着。"));
  }
}

loadWorks();
