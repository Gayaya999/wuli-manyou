const grid = document.querySelector("#communityGrid");
const appearance = document.querySelector(".appearance");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("qo-alt-theme", theme);
  appearance.querySelectorAll("[data-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.theme === theme)));
}

appearance.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => applyTheme(button.dataset.theme)));
applyTheme(document.documentElement.dataset.theme);

function card({ module_id: id, manifest }) {
  const article = document.createElement("article");
  article.className = "community-card";
  const image = document.createElement("img");
  image.src = `./published-modules/${id}/${manifest.assets.disk.path}`;
  image.alt = manifest.presentation.disk_alt;
  const copy = document.createElement("div");
  const domain = document.createElement("p"); domain.className = "community-card-domain"; domain.textContent = manifest.presentation.domain;
  const title = document.createElement("h2"); title.textContent = manifest.presentation.title;
  const meta = document.createElement("p"); meta.className = "community-card-meta";
  const creator = manifest.creator?.display_name || "站长精选";
  meta.append(Object.assign(document.createElement("span"), { textContent: manifest.presentation.scientist_name }), Object.assign(document.createElement("span"), { textContent: `作者：${creator}` }), Object.assign(document.createElement("span"), { textContent: `v${manifest.version}` }));
  const button = document.createElement("a"); button.href = `./?module=${encodeURIComponent(id)}#stage`; button.textContent = "去展厅试玩";
  copy.append(domain, title, meta, button); article.append(image, copy); return article;
}

async function loadCommunity() {
  try {
    const indexResponse = await fetch("./published-modules/index.json", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error();
    const index = await indexResponse.json();
    const modules = await Promise.all((index.modules || []).map(async ({ module_id }) => {
      const response = await fetch(`./published-modules/${module_id}/module.json`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const manifest = await response.json();
      if (manifest.schema_version !== "wuli-science-module-2") return null;
      return { module_id, manifest };
    }));
    const current = modules.filter(Boolean);
    if (!current.length) throw new Error();
    grid.replaceChildren(...current.map(card));
  } catch {
    grid.innerHTML = '<p class="community-empty">展板正在整理第一批实验。</p>';
  }
}

loadCommunity();
