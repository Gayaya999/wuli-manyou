// The film is a trusted, bundled work. It is independent of user-uploaded content packs.
const filmUrl = new URL("./experiences/apple-beyond/index.html", import.meta.url);
let player;
let frame;
let opener;

function createPlayer() {
  player = document.createElement("dialog");
  player.className = "experience-player";
  player.setAttribute("aria-labelledby", "experienceTitle");
  const head = document.createElement("header");
  head.className = "experience-player-head";
  const title = document.createElement("h2");
  title.id = "experienceTitle";
  title.textContent = "苹果之外";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "experience-close";
  close.setAttribute("aria-label", "关闭影片，返回展厅");
  close.textContent = "返回展厅 ×";
  close.addEventListener("click", () => player.close());
  head.append(title, close);
  frame = document.createElement("iframe");
  frame.title = "苹果之外 · 完整互动电影";
  frame.allow = "autoplay; fullscreen";
  frame.allowFullscreen = true;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  player.append(head, frame);
  document.body.append(player);
  player.addEventListener("close", () => {
    frame.src = "about:blank"; // Destroy the session so video and continuous music both stop.
    document.documentElement.classList.remove("experience-open");
    opener?.focus({ preventScroll: true });
  });
}

export function openFilmExperience(trigger) {
  if (!player) createPlayer();
  opener = trigger;
  frame.src = filmUrl.href;
  document.documentElement.classList.add("experience-open");
  player.showModal();
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest('a[data-experience="film"]');
  if (!trigger || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openFilmExperience(trigger);
});
