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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let currentId = FIGURES[0].id;
let archive = null;
let lastClicked = null;
const conversations = new Map();

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
    if (first) figure.placeholder = first;
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
  stageNote.textContent = figure.domain;
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
  updateCopy();
}

function openPortal() {
  const figure = currentFigure();
  portalImage.src = figure.guide;
  portalImage.alt = figure.guideAlt;
  portalTitle.textContent = figure.title;
  portal.showModal();
}

function closePortal() {
  if (portal.open) portal.close();
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
      const response = await fetch(`${scientistAgentApiRoot}/api/scientists/${scientistId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error(`agent ${response.status}`);
      const payload = await response.json();
      appendMessage("figure", payload.answer, scientistId);
      setStatus(scientistId, payload.source === "archive" ? "" : "");
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
ensureArchive();
