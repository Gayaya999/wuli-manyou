import {
  clearThemeProgress,
  deactivateThemePack,
  loadActiveThemePack,
  readThemeProgress,
  saveThemePack,
  validateThemePackFiles,
  writeThemeProgress,
} from "./theme-pack.mjs";
import { validateGameModule } from "./game-module.mjs";
import { filesFromZip } from "./zip-reader.mjs";

const FIGURES = [
  {
    id: "newton",
    name: "牛顿",
    fullName: "艾萨克·牛顿",
    title: "牛顿 · 光与引力",
    domain: "经典力学 / 万有引力",
    avatar: "assets/disks/newton.png",
    guide: "assets/guides/newton.png",
    alt: "牛顿档案软盘",
    guideAlt: "牛顿坐在苹果树下，作为进入实验的引导画面",
    placeholder: "为什么苹果落下，月亮却没有掉下来？",
  },
  {
    id: "einstein",
    name: "爱因斯坦",
    fullName: "阿尔伯特·爱因斯坦",
    title: "爱因斯坦 · 时空",
    domain: "相对论 / 时空",
    avatar: "assets/disks/einstein.png",
    guide: "assets/guides/einstein.png",
    alt: "爱因斯坦档案软盘",
    guideAlt: "爱因斯坦坐在阳台上握着怀表，作为进入实验的引导画面",
    placeholder: "为什么对所有观察者光速都一样？",
  },
  {
    id: "dirac",
    name: "狄拉克",
    fullName: "保罗·狄拉克",
    title: "狄拉克 · 反物质",
    domain: "量子物理 / 反物质",
    avatar: "assets/disks/dirac.png",
    guide: "assets/guides/dirac.png",
    alt: "狄拉克档案软盘",
    guideAlt: "狄拉克坐在洒满阳光的书房里，作为进入实验的引导画面",
    placeholder: "电子为什么需要相对论性方程？",
  },
  {
    id: "feynman",
    name: "费曼",
    fullName: "理查德·费曼",
    title: "费曼 · 相互作用",
    domain: "粒子物理 / 相互作用",
    avatar: "assets/disks/feynman.png",
    guide: "assets/guides/feynman.png",
    alt: "费曼档案软盘",
    guideAlt: "费曼在教室里擦黑板，作为进入实验的引导画面",
    placeholder: "粒子从 A 到 B，真的只走一条路吗？",
  },
  {
    id: "yang",
    name: "杨振宁",
    fullName: "杨振宁",
    title: "杨振宁 · 对称性",
    domain: "量子场 / 对称性",
    avatar: "assets/disks/yang.png",
    guide: "assets/guides/yang.png",
    alt: "杨振宁档案软盘",
    guideAlt: "杨振宁站在窗边望向山野，作为进入实验的引导画面",
    placeholder: "什么是规范对称性？",
  },
  {
    id: "bohr",
    name: "玻尔",
    fullName: "尼尔斯·玻尔",
    title: "玻尔 · 原子跃迁",
    domain: "量子物理 / 原子能级",
    avatar: "assets/disks/bohr.png",
    guide: "assets/guides/bohr.png",
    alt: "玻尔档案软盘",
    guideAlt: "玻尔蹲在池塘边触碰水面，作为进入实验的引导画面",
    placeholder: "电子为什么不会掉进原子核？",
  },
  {
    id: "debroglie",
    name: "德布罗意",
    fullName: "路易·德布罗意",
    title: "德布罗意 · 物质波",
    domain: "量子物理 / 物质波",
    avatar: "assets/disks/debroglie.png",
    guide: "assets/guides/debroglie.png",
    alt: "德布罗意档案软盘",
    guideAlt: "德布罗意的物质波实验引导画面",
    placeholder: "粒子怎么会有波长？",
  },
  {
    id: "schrodinger",
    name: "薛定谔",
    fullName: "埃尔温·薛定谔",
    title: "薛定谔 · 叠加态",
    domain: "量子物理 / 叠加态",
    avatar: "assets/disks/schrodinger.png",
    guide: "assets/guides/schrodinger.png",
    alt: "薛定谔档案软盘",
    guideAlt: "薛定谔侧耳倾听桌上的木箱，作为进入实验的引导画面",
    placeholder: "波函数到底描述什么？",
  },
  {
    id: "maxwell",
    name: "麦克斯韦",
    fullName: "詹姆斯·麦克斯韦",
    title: "麦克斯韦 · 电磁波",
    domain: "电磁学 / 光",
    avatar: "assets/disks/maxwell.png",
    guide: "assets/guides/maxwell.png",
    alt: "麦克斯韦档案软盘",
    guideAlt: "麦克斯韦在书桌前调试仪器，作为进入实验的引导画面",
    placeholder: "电和磁如何互相产生？",
  },
];

const FIGURE_BASELINES = new Map(FIGURES.map((figure) => [figure.id, { ...figure }]));

const fan = document.querySelector("#fan");
const heroTitle = document.querySelector("#heroTitle");
const askForm = document.querySelector("#askForm");
const askInput = document.querySelector("#ask-input");
const askSubmit = document.querySelector("#askSubmit");
const voiceInput = document.querySelector("#voiceInput");
const askInputLabel = document.querySelector("#askInputLabel");
const ctaStatus = document.querySelector("#ctaStatus");
const watchLink = document.querySelector("#watchLink");
const stage = document.querySelector("#stage");
const enterGame = document.querySelector("#enterGame");
const guideImage = document.querySelector("#guideImage");
const stageCaption = document.querySelector("#stageCaption");
const stageNote = document.querySelector("#stageNote");
const portal = document.querySelector("#portal");
const portalImage = document.querySelector("#portalImage");
const portalTitle = document.querySelector("#portalTitle");
const portalLeave = document.querySelector("#portalLeave");
const askChip = document.querySelector("#askChip");
const askChipName = document.querySelector("#askChipName");
const askPanel = document.querySelector("#askPanel");
const askPanelName = document.querySelector("#askPanelName");
const askClose = document.querySelector("#askClose");
const askPrompts = document.querySelector("#askPrompts");
const askLog = document.querySelector("#askLog");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const themePackImport = document.querySelector("#themePackImport");
const themePackReset = document.querySelector("#themePackReset");
const themePackInput = document.querySelector("#themePackInput");
const themePackStatus = document.querySelector("#themePackStatus");
const gameModuleImport = document.querySelector("#gameModuleImport");
const gameModuleInput = document.querySelector("#gameModuleInput");
const gameModuleFolderImport = document.querySelector("#gameModuleFolderImport");
const gameModuleFolderInput = document.querySelector("#gameModuleFolderInput");
const gameModuleProgress = document.querySelector("#gameModuleProgress");
const gameModuleStatus = document.querySelector("#gameModuleStatus");
const themeDeveloperTools = document.querySelector("#themeDeveloperTools");
const moduleGame = document.querySelector("#moduleGame");
const moduleGameFrame = document.querySelector("#moduleGameFrame");
const moduleGameTitle = document.querySelector("#moduleGameTitle");
const moduleGameLeave = document.querySelector("#moduleGameLeave");
const themeGame = document.querySelector("#themeGame");
const themeGameImage = document.querySelector("#themeGameImage");
const themeGameProgress = document.querySelector("#themeGameProgress");
const themeGameTitle = document.querySelector("#themeGameTitle");
const themeGameIntro = document.querySelector("#themeGameIntro");
const themeGamePrompt = document.querySelector("#themeGamePrompt");
const themeGameChoices = document.querySelector("#themeGameChoices");
const themeGameFeedback = document.querySelector("#themeGameFeedback");
const themeGameNext = document.querySelector("#themeGameNext");
const themeGameClose = document.querySelector("#themeGameClose");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let currentId = FIGURES[0].id;
let archive = null;
let lastClicked = null;
const conversations = new Map();
let activeThemePack = null;
let activeThemeUrls = [];
let themeGameStep = 0;
let themeGameCompleted = false;
let themeGameResolved = false;
const gameModules = new Map();
const moduleIdToFigureId = new Map();
let activeGameUrls = [];
const persistentGameUrls = [];

const THEME_KEY = "qo-alt-theme";
const appearance = document.querySelector(".appearance");
const scientistAgentApiRoot = (document.documentElement.dataset.scientistAgentApi || "").replace(/\/$/, "");

function compact(text) {
  return text.replace(/\s+/g, "");
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

function currentFigure() {
  return FIGURES.find((figure) => figure.id === currentId) ?? FIGURES[0];
}

function currentProfile() {
  return profileFor(currentId);
}

function profileFor(scientistId) {
  return archive?.scientists?.[scientistId] ?? null;
}

function conversationFor(scientistId) {
  let log = conversations.get(scientistId);
  if (!log) {
    log = [];
    conversations.set(scientistId, log);
  }
  return log;
}

function renderAskLog() {
  const log = conversationFor(currentId);
  askLog.replaceChildren(
    ...log.map((item) => {
      const paragraph = document.createElement("p");
      paragraph.className = item.role === "user" ? "from-user" : "from-figure";
      paragraph.textContent = item.text;
      return paragraph;
    }),
  );
  askLog.scrollTop = askLog.scrollHeight;
}

function applyArchivePlaceholders() {
  FIGURES.forEach((figure) => {
    const first = archive?.scientists?.[figure.id]?.prompts?.[0]?.question;
    if (first) {
      figure.placeholder = first;
      const baseline = FIGURE_BASELINES.get(figure.id);
      if (baseline) baseline.placeholder = first;
    }
  });
}

function circularSlot(index, currentIndex, length) {
  let slot = index - currentIndex;
  const wrap = Math.floor(length / 2);
  if (slot > wrap) slot -= length;
  if (slot < -wrap) slot += length;
  return slot;
}

function renderFan() {
  fan.replaceChildren(
    ...FIGURES.map((figure) => {
      const button = document.createElement("button");
      button.className = "plate";
      button.type = "button";
      button.dataset.id = figure.id;
      const image = document.createElement("img");
      image.src = figure.avatar;
      image.alt = figure.alt;
      button.append(image);
      return button;
    }),
  );
}

function updateFanSlots() {
  const currentIndex = FIGURES.findIndex((figure) => figure.id === currentId);
  document.querySelectorAll(".plate").forEach((plate) => {
    const index = FIGURES.findIndex((figure) => figure.id === plate.dataset.id);
    const slot = circularSlot(index, currentIndex, FIGURES.length);
    const figure = FIGURES[index];
    const active = slot === 0;
    plate.dataset.slot = String(slot);
    plate.classList.toggle("is-active", active);
    plate.tabIndex = Math.abs(slot) > 1 ? -1 : 0;
    plate.setAttribute("aria-pressed", String(active));
    plate.setAttribute(
      "aria-label",
      active ? `放大查看${figure.fullName}的档案软盘` : `转到${figure.fullName}的档案软盘`,
    );
  });
}

function stepFigure(delta) {
  const index = FIGURES.findIndex((figure) => figure.id === currentId);
  selectFigure(FIGURES[(index + delta + FIGURES.length) % FIGURES.length].id);
}

function renderPrompts() {
  const prompts = currentProfile()?.prompts?.slice(0, 3) ?? [];
  askPrompts.replaceChildren(
    ...prompts.map((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = prompt.question;
      button.addEventListener("click", () => sendQuestion(prompt.question));
      return button;
    }),
  );
}

function updateCopy() {
  const figure = currentFigure();
  heroTitle.textContent = figure.name;
  askInput.placeholder = figure.placeholder;
  askInputLabel.textContent = `向${figure.name}提问`;
  stageCaption.textContent = figure.title;
  stageNote.textContent = figure.stageNote ?? figure.domain;
  enterGame.setAttribute("aria-label", `进入${figure.name}的实验（演示）`);
  askChipName.textContent = figure.name;
  askPanelName.textContent = figure.name;
  updateFanSlots();
  renderPrompts();
  showGuide(figure);
  renderAskLog();
}

function showGuide(figure) {
  guideImage.src = figure.guide;
  guideImage.alt = figure.guideAlt;
  if (portal.open) {
    portalImage.src = figure.guide;
    portalImage.alt = figure.guideAlt;
    portalTitle.textContent = figure.title;
  }
}

function selectFigure(id, { lightboxOnRepeat = false } = {}) {
  const figure = FIGURES.find((item) => item.id === id);
  if (!figure) return;

  if (lightboxOnRepeat && id === currentId && lastClicked === id) {
    lightboxImage.src = figure.avatar;
    lightboxImage.alt = figure.alt;
    lightbox.showModal();
    return;
  }

  currentId = id;
  lastClicked = id;
  stopVoice();
  if (themeGame.open && activeThemePack?.manifest.target_scientist_id !== id) themeGame.close();
  updateCopy();
}

function openPortal() {
  if (activeThemePack?.manifest.target_scientist_id === currentId) {
    openThemeGame();
    return;
  }
  if (gameModules.has(currentId)) {
    openGameModule(gameModules.get(currentId));
    return;
  }
  const figure = currentFigure();
  portalImage.src = figure.guide;
  portalImage.alt = figure.guideAlt;
  portalTitle.textContent = figure.title;
  portal.showModal();
}

function closePortal() {
  if (portal.open) portal.close();
}

function setGameModuleStatus(message, state = "") {
  gameModuleStatus.textContent = message;
  gameModuleStatus.dataset.state = state;
}

function setGameModuleProgress(step, message, state = "pending") {
  const order = ["读取", "验包", "验授权", "验运行", "加入展厅"];
  const active = order.indexOf(step);
  gameModuleProgress?.querySelectorAll("li").forEach((item, index) => {
    item.dataset.state = index < active ? "done" : index === active ? state : "";
  });
  setGameModuleStatus(message, state === "error" ? "error" : active === order.length - 1 ? "success" : "pending");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

async function moduleBundle(entries) {
  const bundle = {};
  for (const relative of ["manifest.json", "scientist.json", "concept.json", "experience.json", "models.json", "visuals.json", "sources.json", "licenses.json", "qa/release-report.json"]) {
    const key = relative === "qa/release-report.json" ? "release_report" : relative.split("/").pop().replace(".json", "");
    bundle[key] = JSON.parse(await entries.get(`game-pack/${relative}`).text());
  }
  bundle.asset_metadata = {};
  for (const asset of bundle.manifest.assets || []) {
    if (asset.metadata) bundle.asset_metadata[asset.asset_id] = JSON.parse(await entries.get(`game-pack/${asset.metadata}`).text());
  }
  return bundle;
}

async function fileToDataUrl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

function releaseActiveGameUrls() {
  activeGameUrls.forEach((url) => URL.revokeObjectURL(url));
  activeGameUrls = [];
}

async function loadPublishedModule(record) {
  if (record.entries) return record;
  setGameModuleProgress("读取", `正在下载《${record.manifest.presentation.title}》的游戏内容`);
  const files = await Promise.all(record.files.map(async (relative) => {
    const response = await fetch(`${record.baseUrl}/${relative}`);
    if (!response.ok) throw new Error(`服务器缺少 ${relative}`);
    const file = new File([await response.blob()], relative.split("/").pop());
    Object.defineProperty(file, "webkitRelativePath", { value: `${record.manifest.module_id}/${relative}` });
    return file;
  }));
  const result = await validateGameModule(files, { onProgress: (step, message) => setGameModuleProgress(step, message) });
  if (!result.ok) throw new Error(result.errors.slice(0, 4).join("；"));
  record.entries = result.entries;
  record.manifest = result.manifest;
  return record;
}

async function openGameModule(record) {
  if (!record) return;
  moduleGameTitle.textContent = record.figure.title;
  setGameModuleStatus("正在进入暗色实验舱……", "pending");
  try {
    await loadPublishedModule(record);
    releaseActiveGameUrls();
    const [css, runtimeTemplate, bundle] = await Promise.all([
      fetch("./assets/pixel-science-runtime/game.css").then((response) => response.text()),
      fetch("./assets/pixel-science-runtime/runtime.template.js").then((response) => response.text()),
      moduleBundle(record.entries),
    ]);
    const assetUrls = {};
    for (const asset of bundle.manifest.assets || []) {
      const fontAsset = String(asset.media_type || "").startsWith("font/");
      assetUrls[asset.asset_id] = record.published && !fontAsset
        ? `${record.baseUrl}/game-pack/${asset.path}`
        : await fileToDataUrl(record.entries.get(`game-pack/${asset.path}`));
    }
    const runtime = runtimeTemplate
      .replace("__PACK_BUNDLE__", safeJson(bundle))
      .replace("return `./pack/${record.path}`;", "return window.__WULI_PACK_ASSETS__[assetId];");
    if (runtime.includes("__PACK_BUNDLE__")) throw new Error("网站运行器未正确装配");
    let framedHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="page" id="app"><section class="game-viewport" id="game-viewport"><section class="game-shell" id="game-shell" aria-label="科普游戏"><canvas id="stage-canvas" width="960" height="540" aria-hidden="true"></canvas><header class="hud"><span class="brand" id="brand">像素科学剧场</span><div class="progress" id="progress"></div><button class="quiet-button" id="settings-button" type="button">设置</button></header><section class="stage-copy" id="stage-copy" hidden><span class="stage-count" id="stage-count"></span><h1 id="stage-title"></h1><p id="stage-prompt"></p><div class="journey-steps" id="journey-steps" hidden></div></section><section class="control-deck" id="control-deck" hidden><div class="control-main" id="control-main"></div><div class="feedback-row" id="feedback-row"><img class="scientist-portrait" id="scientist-portrait" alt="人物当前表情" hidden><div class="feedback-copy" aria-live="polite"><span id="result-label"></span><span id="feedback-label"></span></div><div class="secondary-actions"><button class="quiet-button" id="hint-button" type="button">提示 0/0</button><button class="quiet-button deeper-button" id="deeper-button" type="button" hidden>深入一步</button><button class="primary-button compact" id="continue-button" type="button" disabled>继续</button></div></div></section><section class="start-card" id="start-card"><span class="eyebrow">3—5分钟 · 一次一个科学发现</span><h1 id="start-title"></h1><p id="start-description"></p><button class="primary-button" id="start-button" type="button" disabled>正在准备素材…</button></section><aside class="modal-card" id="modal-card" role="dialog" aria-modal="true" hidden><span class="eyebrow" id="modal-eyebrow"></span><h2 id="modal-title"></h2><div id="modal-body"></div><button class="primary-button compact" id="modal-close" type="button">完成</button></aside><footer class="subtitle" id="subtitle"></footer><div class="rotate-notice" role="status"><strong>请把平板横过来</strong><span>横屏能完整看到实验舞台</span></div><div class="fatal-error" id="fatal-error" hidden><h1>内容加载失败</h1><p id="fatal-message"></p></div></section></section><p class="browser-note">物理漫游安全运行器</p></main><script>window.__WULI_PACK_ASSETS__=${safeJson(assetUrls)};<\/script><script>${runtime}<\/script></body></html>`;
    framedHtml = framedHtml.replace("<body>", "<body><script>parent.postMessage(\"wuli-game-boot\",\"*\")<\/script>");
    moduleGame.classList.add("is-entering");
    moduleGame.showModal();
    requestAnimationFrame(() => moduleGame.classList.remove("is-entering"));
    let gameBooted = false;
    const onGameBoot = (event) => { if (event.data === "wuli-game-boot") gameBooted = true; };
    window.addEventListener("message", onGameBoot);
    moduleGameFrame.srcdoc = framedHtml;
    window.setTimeout(() => {
      if (!gameBooted) moduleGameFrame.srcdoc = framedHtml;
      window.setTimeout(() => window.removeEventListener("message", onGameBoot), 6000);
    }, 3500);
    setGameModuleStatus(`已导入：${record.manifest.presentation.title}。软盘已加入滑块。`, "success");
  } catch (error) {
    setGameModuleStatus(`小游戏未能启动：${error.message}`, "error");
  }
}

function registerGameModule(manifest, { entries = null, files = [], baseUrl = "", select = true, published = false } = {}) {
  const existingFigure = FIGURES.find((item) => item.fullName === manifest.presentation.scientist_name || item.name === manifest.presentation.scientist_name);
  const knownFigureId = moduleIdToFigureId.get(manifest.module_id);
  const figure = FIGURES.find((item) => item.id === knownFigureId) ?? existingFigure;
  const figureId = figure?.id ?? `module-${manifest.module_id}`;
  if (figure?._moduleObjectUrls) figure._moduleObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  const disk = entries?.get(manifest.assets.disk.path);
  const guide = entries?.get(manifest.assets.guide.path);
  const avatar = disk ? URL.createObjectURL(disk) : `${baseUrl}/${manifest.assets.disk.path}`;
  const guideUrl = guide ? URL.createObjectURL(guide) : `${baseUrl}/${manifest.assets.guide.path}`;
  const modulePresentation = {
    name: manifest.presentation.scientist_name,
    fullName: manifest.presentation.scientist_name,
    title: manifest.presentation.title,
    domain: manifest.presentation.domain,
    stageNote: `版本 ${manifest.version}${manifest.creator?.display_name ? ` · ${manifest.creator.display_name}` : ""}`,
    avatar,
    guide: guideUrl,
    alt: manifest.presentation.disk_alt,
    guideAlt: manifest.presentation.guide_alt,
    placeholder: manifest.presentation.placeholder,
    _moduleObjectUrls: disk ? [avatar, guideUrl] : [],
  };
  const registeredFigure = figure ? Object.assign(figure, modulePresentation) : { id: figureId, ...modulePresentation };
  if (!figure) FIGURES.push(registeredFigure);
  moduleIdToFigureId.set(manifest.module_id, registeredFigure.id);
  gameModules.set(registeredFigure.id, { manifest, entries, files, baseUrl, figure: registeredFigure, published });
  renderFan();
  if (select) selectFigure(registeredFigure.id);
  else updateCopy();
  return registeredFigure;
}

async function importGameModule(files, { quiet = false, select = true } = {}) {
  if (!quiet) setGameModuleProgress("读取", "正在读取作品包");
  const result = await validateGameModule(files, { onProgress: quiet ? () => {} : (step, message) => setGameModuleProgress(step, message) });
  if (!result.ok) throw new Error(result.errors.slice(0, 3).join("；"));
  const { manifest, entries } = result;
  const figure = registerGameModule(manifest, { entries, select });
  if (!quiet) setGameModuleStatus(`已导入：${figure.title}。点击下方电脑即可游玩。`, "success");
}

function focusRequestedModule() {
  const moduleId = new URLSearchParams(location.search).get("module");
  if (!moduleId) return;
  const figureId = moduleIdToFigureId.get(moduleId);
  if (!figureId) { setGameModuleStatus("这个社区作品尚未发布或已经下架。", "error"); return; }
  selectFigure(figureId);
  stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  enterGame.classList.remove("community-cue");
  requestAnimationFrame(() => enterGame.classList.add("community-cue"));
  enterGame.focus({ preventScroll: true });
  setGameModuleStatus("已从社区选中作品：请点击发光的电脑进入游戏。", "success");
  window.setTimeout(() => enterGame.classList.remove("community-cue"), 2800);
}

async function loadPublishedModules() {
  try {
    const indexResponse = await fetch("./published-modules/index.json", { cache: "no-store" });
    if (!indexResponse.ok) return;
    const index = await indexResponse.json();
    if (!Array.isArray(index.modules)) throw new Error("公开作品目录无效");
    let loaded = 0;
    for (const record of index.modules) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record?.module_id ?? "") || !Array.isArray(record.files)) continue;
      const baseUrl = `./published-modules/${record.module_id}`;
      const response = await fetch(`${baseUrl}/module.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`公开作品缺少 module.json`);
      const manifest = await response.json();
      if (manifest.schema_version !== "wuli-science-module-2" || manifest.module_id !== record.module_id) throw new Error(`公开作品 ${record.module_id} 版本过旧`);
      registerGameModule(manifest, { files: record.files, baseUrl, select: false, published: true });
      loaded += 1;
    }
    if (loaded) setGameModuleStatus(`已加载 ${loaded} 个作品简介；完整游戏会在点击电脑后加载。`, "success");
    focusRequestedModule();
  } catch (error) {
    console.warn("公开小游戏目录未加载", error);
  }
}

function releaseThemeUrls() {
  activeThemeUrls.forEach((url) => URL.revokeObjectURL(url));
  activeThemeUrls = [];
}

function restoreFigure(id) {
  const figure = FIGURES.find((item) => item.id === id);
  const baseline = FIGURE_BASELINES.get(id);
  if (figure && baseline) Object.assign(figure, baseline);
}

function setThemePackStatus(message, state = "") {
  themePackStatus.textContent = message;
  themePackStatus.dataset.tooltip = message;
  themePackStatus.dataset.state = state;
}

function activateThemePackRecord(record) {
  const { manifest, assets } = record;
  const figure = FIGURES.find((item) => item.id === manifest.target_scientist_id);
  if (!figure) throw new Error(`当前展厅没有人物：${manifest.target_scientist_id}`);
  if (!assets?.disk || !assets?.guide) throw new Error("主题包素材记录不完整");
  if (activeThemePack) restoreFigure(activeThemePack.manifest.target_scientist_id);
  releaseThemeUrls();
  const diskUrl = URL.createObjectURL(assets.disk);
  const guideUrl = URL.createObjectURL(assets.guide);
  activeThemeUrls.push(diskUrl, guideUrl);
  Object.assign(figure, {
    title: manifest.presentation.title,
    domain: manifest.presentation.domain,
    stageNote: manifest.presentation.stage_note,
    placeholder: manifest.presentation.placeholder,
    avatar: diskUrl,
    guide: guideUrl,
    alt: `${figure.fullName}${manifest.presentation.card_label}`,
    guideAlt: manifest.presentation.guide_alt,
  });
  activeThemePack = record;
  themePackReset.hidden = false;
  renderFan();
  selectFigure(figure.id);
  setThemePackStatus(`已启用：${manifest.presentation.card_label}`, "success");
}

function restoreDefaultTheme() {
  const target = activeThemePack?.manifest.target_scientist_id;
  if (target) restoreFigure(target);
  releaseThemeUrls();
  activeThemePack = null;
  if (themeGame.open) themeGame.close();
  deactivateThemePack();
  themePackReset.hidden = true;
  renderFan();
  updateCopy();
  setThemePackStatus("已恢复展厅默认主题。导入记录仍保存在本机，可再次选择文件夹覆盖。", "success");
}

function currentThemeGameplay() {
  return activeThemePack?.manifest.gameplay ?? null;
}

function renderThemeGame() {
  const gameplay = currentThemeGameplay();
  if (!gameplay) return;
  themeGameImage.src = currentFigure().guide;
  themeGameChoices.replaceChildren();
  themeGameFeedback.textContent = "";
  themeGameResolved = false;
  if (themeGameCompleted) {
    themeGameProgress.textContent = "完成";
    themeGameTitle.textContent = gameplay.completion.title;
    themeGameIntro.textContent = gameplay.completion.summary;
    themeGamePrompt.textContent = "这次记录已保存在这台设备上。";
    themeGameNext.textContent = "重新试玩";
    themeGameNext.hidden = false;
    return;
  }
  const step = gameplay.steps[themeGameStep];
  themeGameProgress.textContent = `第 ${themeGameStep + 1} / ${gameplay.steps.length} 步`;
  themeGameTitle.textContent = gameplay.title;
  themeGameIntro.textContent = gameplay.intro;
  themeGamePrompt.textContent = step.prompt;
  for (const choice of step.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.dataset.choiceId = choice.id;
    button.addEventListener("click", () => chooseThemeAnswer(button, step));
    themeGameChoices.append(button);
  }
  themeGameNext.textContent = themeGameStep === gameplay.steps.length - 1 ? "查看结论" : "继续";
  themeGameNext.hidden = true;
}

function chooseThemeAnswer(button, step) {
  if (themeGameResolved) return;
  if (button.dataset.choiceId !== step.correct_choice_id) {
    button.classList.remove("is-wrong");
    requestAnimationFrame(() => button.classList.add("is-wrong"));
    themeGameFeedback.textContent = step.hint;
    return;
  }
  themeGameResolved = true;
  themeGameChoices.querySelectorAll("button").forEach((item) => {
    item.disabled = true;
    item.classList.toggle("is-correct", item === button);
  });
  themeGameFeedback.textContent = step.observation;
  themeGameNext.hidden = false;
}

function openThemeGame() {
  const gameplay = currentThemeGameplay();
  if (!gameplay) return;
  const progress = readThemeProgress(activeThemePack.manifest.pack_id, gameplay.steps.length);
  themeGameStep = progress.step;
  themeGameCompleted = progress.completed;
  renderThemeGame();
  themeGame.showModal();
}

function advanceThemeGame() {
  const gameplay = currentThemeGameplay();
  if (!gameplay) return;
  if (themeGameCompleted) {
    clearThemeProgress(activeThemePack.manifest.pack_id);
    themeGameStep = 0;
    themeGameCompleted = false;
    renderThemeGame();
    return;
  }
  if (!themeGameResolved) return;
  if (themeGameStep >= gameplay.steps.length - 1) {
    themeGameCompleted = true;
    writeThemeProgress(activeThemePack.manifest.pack_id, { step: themeGameStep, completed: true });
  } else {
    themeGameStep += 1;
    writeThemeProgress(activeThemePack.manifest.pack_id, { step: themeGameStep, completed: false });
  }
  renderThemeGame();
}

function openAsk() {
  askPanel.hidden = false;
  askChip.setAttribute("aria-expanded", "true");
}

function closeAsk() {
  askPanel.hidden = true;
  askChip.setAttribute("aria-expanded", "false");
}

function appendMessage(role, text, scientistId = currentId) {
  conversationFor(scientistId).push({ role, text });
  if (scientistId === currentId) renderAskLog();
}

function matchPrompt(message, scientistId = currentId) {
  const profile = profileFor(scientistId);
  if (!profile) return null;
  const needle = compact(message);
  if (!needle) return null;
  return profile.prompts.find((prompt) => {
    const question = compact(prompt.question);
    return needle === question || needle.includes(question) || question.includes(needle);
  }) ?? null;
}

function fallbackAnswer(scientistId = currentId) {
  const profile = profileFor(scientistId);
  return profile?.outOfScopeHint
    ?? "档案里还没有这个问题。换一个更具体的问法，例如惯性、轨道或光。";
}

async function sendQuestion(raw) {
  const message = raw.trim();
  if (!message) return;
  const scientistId = currentId;

  stopVoice();
  askInput.value = "";
  askSubmit.disabled = true;
  setStatus(scientistId, scientistAgentApiRoot ? "正在通信" : "正在翻档案");
  openAsk();
  appendMessage("user", message, scientistId);

  if (!archive) {
    try {
      const response = await fetch("data/scientist-agents.json");
      if (!response.ok) throw new Error("archive missing");
      archive = await response.json();
      applyArchivePlaceholders();
      updateCopy();
    } catch {
      setStatus(scientistId, "档案暂时读不到，稍后再问。");
      appendMessage("figure", "通信档案暂时离线。", scientistId);
      return;
    }
  }

  if (scientistAgentApiRoot) {
    try {
      const response = await fetch(`${scientistAgentApiRoot}/scientists/${scientistId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error(`agent ${response.status}`);
      const payload = await response.json();
      const label = payload.source === "qwen" ? "【AI 生成 · 依据本站科学档案】\n" : "";
      appendMessage("figure", `${label}${payload.answer}`, scientistId);
      setStatus(scientistId, payload.source === "qwen" ? "这条回答由 AI 生成，请结合馆藏来源理解。" : "");
      return;
    } catch {
      setStatus(scientistId, "模型通信暂时接不上，先用档案回答。");
    }
  }

  const match = matchPrompt(message, scientistId);
  const answer = match?.answer ?? fallbackAnswer(scientistId);
  appendMessage("figure", answer, scientistId);
  setStatus(scientistId, match ? "" : "这个问题还没有写成档案，试一下上面的推荐问法。");
}

function setStatus(scientistId, text) {
  if (scientistId === currentId) ctaStatus.textContent = text;
}

async function ensureArchive() {
  if (archive) return;
  try {
    const response = await fetch("data/scientist-agents.json");
    if (!response.ok) return;
    archive = await response.json();
    applyArchivePlaceholders();
    updateCopy();
  } catch {
    /* keep the page usable without the archive */
  }
}

const fanPrev = document.querySelector("#fanPrev");
const fanNext = document.querySelector("#fanNext");

fan.addEventListener("click", (event) => {
  const plate = event.target.closest(".plate");
  if (!plate) return;
  selectFigure(plate.dataset.id, { lightboxOnRepeat: true });
});

fanPrev.addEventListener("click", () => stepFigure(-1));
fanNext.addEventListener("click", () => stepFigure(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && listening) {
    event.preventDefault();
    stopVoice();
    return;
  }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    stepFigure(1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepFigure(-1);
  }
  if (event.key === "Escape") {
    if (portal.open) {
      closePortal();
      return;
    }
    closeAsk();
  }
});

function syncAskSubmit() {
  askSubmit.disabled = askInput.value.trim().length === 0;
}

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
let voiceBase = "";

function setListening(on) {
  listening = on;
  voiceInput?.classList.toggle("is-listening", on);
  voiceInput?.setAttribute("aria-pressed", String(on));
  voiceInput?.setAttribute("aria-label", on ? "停止语音输入" : "语音输入");
}

function stopVoice() {
  if (!recognition || !listening) return;
  recognition.stop();
}

function startVoice() {
  if (!recognition) return;
  voiceBase = askInput.value.trim();
  try {
    recognition.start();
  } catch {
    /* already started */
  }
}

if (voiceInput && SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.addEventListener("start", () => {
    setListening(true);
    setStatus(currentId, "正在听");
  });

  recognition.addEventListener("result", (event) => {
    let finalText = "";
    let interim = "";
    for (const result of event.results) {
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    const spoken = `${finalText}${interim}`.trim();
    askInput.value = [voiceBase, spoken].filter(Boolean).join("");
    syncAskSubmit();
  });

  recognition.addEventListener("error", (event) => {
    setListening(false);
    if (event.error === "not-allowed") {
      setStatus(currentId, "需要允许麦克风才能语音提问。");
      return;
    }
    if (event.error === "no-speech" || event.error === "aborted") {
      if (ctaStatus.textContent === "正在听") setStatus(currentId, "");
      return;
    }
    setStatus(currentId, "这轮没听清，再试一次。");
  });

  recognition.addEventListener("end", () => {
    setListening(false);
    if (ctaStatus.textContent === "正在听") setStatus(currentId, "");
    syncAskSubmit();
  });

  voiceInput.addEventListener("click", () => {
    if (listening) stopVoice();
    else startVoice();
  });
} else if (voiceInput) {
  voiceInput.hidden = true;
}

askInput.addEventListener("input", syncAskSubmit);

askForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendQuestion(askInput.value);
});

watchLink.addEventListener("click", () => {
  stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  enterGame.focus();
});

enterGame.addEventListener("click", openPortal);
portalLeave.addEventListener("click", closePortal);
portal.addEventListener("click", (event) => {
  if (event.target === portal) closePortal();
});

themeDeveloperTools.hidden = !new URLSearchParams(location.search).has("dev");
themePackImport?.addEventListener("click", () => themePackInput.click());
themePackInput.addEventListener("change", async () => {
  if (!themePackInput.files?.length) return;
  setThemePackStatus("正在检查主题包文件、尺寸和指纹……", "pending");
  try {
    const result = await validateThemePackFiles(themePackInput.files);
    if (!result.ok) throw new Error(result.errors.slice(0, 3).join("；"));
    if (!FIGURES.some((figure) => figure.id === result.manifest.target_scientist_id)) {
      throw new Error(`展厅中不存在人物：${result.manifest.target_scientist_id}`);
    }
    const record = await saveThemePack(result);
    activateThemePackRecord(record);
  } catch (error) {
    setThemePackStatus(`导入失败：${error.message}。已保留当前页面和原主题。`, "error");
  } finally {
    themePackInput.value = "";
  }
});
themePackReset.addEventListener("click", restoreDefaultTheme);
gameModuleImport.addEventListener("click", () => gameModuleInput.click());
gameModuleInput.addEventListener("change", async () => {
  if (!gameModuleInput.files?.length) return;
  try {
    const files = await filesFromZip(gameModuleInput.files[0]);
    await importGameModule(files);
  } catch (error) {
    setGameModuleProgress("读取", error.message, "error");
    setGameModuleStatus(`导入失败：${error.message}。已保留当前展厅。`, "error");
  } finally {
    gameModuleInput.value = "";
  }
});
gameModuleFolderImport.addEventListener("click", () => gameModuleFolderInput.click());
gameModuleFolderInput.addEventListener("change", async () => {
  if (!gameModuleFolderInput.files?.length) return;
  try { await importGameModule(gameModuleFolderInput.files); }
  catch (error) { setGameModuleStatus(`文件夹导入失败：${error.message}。`, "error"); }
  finally { gameModuleFolderInput.value = ""; }
});
themeGameClose.addEventListener("click", () => themeGame.close());
themeGameNext.addEventListener("click", advanceThemeGame);
themeGame.addEventListener("click", (event) => {
  if (event.target === themeGame) themeGame.close();
});
function closeModuleGame() {
  if (moduleGame.open) moduleGame.close();
  moduleGameFrame.srcdoc = "";
  releaseActiveGameUrls();
}
moduleGameLeave.addEventListener("click", closeModuleGame);
moduleGame.addEventListener("click", (event) => {
  if (event.target === moduleGame) closeModuleGame();
});

askChip.addEventListener("click", () => {
  if (askPanel.hidden) openAsk();
  else closeAsk();
});

askClose.addEventListener("click", closeAsk);

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
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

renderFan();
updateCopy();
loadPublishedModules();
ensureArchive().finally(async () => {
  try {
    const savedTheme = await loadActiveThemePack();
    if (savedTheme) activateThemePackRecord(savedTheme);
  } catch {
    deactivateThemePack();
    setThemePackStatus("上次主题包无法读取，已安全回到默认展厅。", "error");
  }
});
