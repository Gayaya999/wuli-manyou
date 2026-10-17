import { openFilmExperience } from "./experience-player.js";
import { api, apiEnabled, migrateLocalIfNeeded } from "./api.js";
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
    avatar: "./assets/disks/newton.png",
    guide: "./assets/guides/newton.png",
    alt: "牛顿档案软盘",
    guideAlt: "牛顿坐在苹果树下，作为进入实验的引导画面",
    placeholder: "为什么苹果落下，月亮却没有掉下来？",
    lead: "苹果落下，月亮却没有。同一条[[万有引力]]把它们拴在同一种下落里。",
    asideA: "[[1687]]年《原理》写出三条运动定律。惯性不是推力，是物体不肯无故改变运动的性质。",
    asideB: "白光是复合的。棱镜并不制造颜色，只把各色光线[[分开]]。",
    dungeon: "坠落之月",
    dungeonEn: "Falling Moon",
    latin: "Isaac Newton",
    bio: [
      "牛顿研究的问题其实都很日常：苹果为什么会掉下来？东西为什么会运动？月亮为什么不会飞走？",
      "最后，他发现地上的苹果和天上的月亮，其实都遵循同一套规律。",
    ],
    line: "他让人类第一次能够用一套规则去理解运动和引力。",
  },
  {
    id: "einstein",
    name: "爱因斯坦",
    fullName: "阿尔伯特·爱因斯坦",
    title: "爱因斯坦 · 时空",
    domain: "相对论 / 时空",
    avatar: "./assets/disks/einstein.png",
    guide: "./assets/guides/einstein.png",
    alt: "爱因斯坦档案软盘",
    guideAlt: "爱因斯坦坐在阳台上握着怀表，作为进入实验的引导画面",
    placeholder: "为什么对所有观察者光速都一样？",
    lead: "同时发生的事情，换一个观察者可能并不同时。[[时空]]会随运动一起改写。",
    asideA: "[[1905]]年，光速对所有观察者相同。质量与能量可以互换。",
    asideB: "电梯里的失重，和弯曲时空里的自由落体，是同一种经验。",
    dungeon: "时间弯曲之后",
    dungeonEn: "After Time Bends",
    latin: "Albert Einstein",
    bio: [
      "爱因斯坦重新改变了我们对时间、空间和引力的理解。他告诉我们：时间并不是永远一样快，空间也不是永远平直的。",
      "速度越接近光速，时间和空间都会发生变化。",
    ],
    line: "他让宇宙从一个固定的舞台，变成了一个会弯曲、会变化的世界。",
  },
  {
    id: "dirac",
    name: "狄拉克",
    fullName: "保罗·狄拉克",
    title: "狄拉克 · 反物质",
    domain: "量子物理 / 反物质",
    avatar: "./assets/disks/dirac.png",
    guide: "./assets/guides/dirac.png",
    alt: "狄拉克档案软盘",
    guideAlt: "狄拉克坐在洒满阳光的书房里，作为进入实验的引导画面",
    placeholder: "电子为什么需要相对论性方程？",
    lead: "电子要同时服从相对论与量子规则，方程里会自己长出[[自旋]]。",
    asideA: "[[1928]]年的相对论性电子方程给出负能解。后来那被读成正电子。",
    asideB: "空穴一度被想成质子。那是一次诚实的误读，不是后来的夸克模型。",
    dungeon: "反物质回廊",
    dungeonEn: "Antimatter Hall",
    latin: "Paul Dirac",
    bio: [
      "狄拉克是一个非常安静、非常相信数学的人。他写出了一个描述电子的方程，结果这个方程竟然提前预言了一种当时还没人发现的东西：反物质。",
      "后来，实验真的发现了它。",
    ],
    line: "很像是数学先告诉人类：“这里还有一个你们没见过的世界。”",
  },
  {
    id: "feynman",
    name: "费曼",
    fullName: "理查德·费曼",
    title: "费曼 · 相互作用",
    domain: "粒子物理 / 相互作用",
    avatar: "./assets/disks/feynman.png",
    guide: "./assets/guides/feynman.png",
    alt: "费曼档案软盘",
    guideAlt: "费曼在教室里擦黑板，作为进入实验的引导画面",
    placeholder: "粒子从 A 到 B，真的只走一条路吗？",
    lead: "粒子从 A 到 B，并不只走一条路。所有路径加起来，才是它[[真正走的路]]。",
    asideA: "费曼图把相互作用画成线条。光子在图里传递电磁力。",
    asideB: "路径积分先让人看见所有可能，再把振幅加总。",
    dungeon: "粒子的秘密路线",
    dungeonEn: "Secret Particle Path",
    latin: "Richard Feynman",
    bio: [
      "费曼特别擅长把复杂的物理讲得很直白。他研究粒子之间是怎么互相作用的，还发明了“费曼图”，把原本很难懂的量子过程画成一条条简单的线。",
    ],
    line: "很会把复杂世界讲明白的人。",
  },
  {
    id: "yang",
    name: "杨振宁",
    fullName: "杨振宁",
    title: "杨振宁 · 对称性",
    domain: "量子场 / 对称性",
    avatar: "./assets/disks/yang.png",
    guide: "./assets/guides/yang.png",
    alt: "杨振宁档案软盘",
    guideAlt: "杨振宁站在窗边望向山野，作为进入实验的引导画面",
    placeholder: "什么是规范对称性？",
    lead: "对称性不只是好看。它[[支配]]粒子之间如何相互作用。",
    asideA: "杨-米尔斯场把规范对称性写成动力学。弱作用的宇称可以不守恒。",
    asideB: "提到实验，必须归功[[吴健雄]]。标准模型不是一个人完成的。",
    dungeon: "破碎的镜像",
    dungeonEn: "Broken Mirror",
    latin: "Chen-Ning Yang",
    bio: [
      "杨振宁研究的是自然界很深层的一种规律：对称性。我们看到的世界很多地方看起来左右、正反都很对称，但在微观粒子的世界里，有些规律并不是完全对称的。",
    ],
    line: "他帮助人们理解了自然界为什么有些地方对称，有些地方却不对称。",
  },
  {
    id: "bohr",
    name: "玻尔",
    fullName: "尼尔斯·玻尔",
    title: "玻尔 · 原子跃迁",
    domain: "量子物理 / 原子能级",
    avatar: "./assets/disks/bohr.png",
    guide: "./assets/guides/bohr.png",
    alt: "玻尔档案软盘",
    guideAlt: "玻尔蹲在池塘边触碰水面，作为进入实验的引导画面",
    placeholder: "电子为什么不会掉进原子核？",
    lead: "电子不会掉进原子核。它只能待在若干[[定态]]上，跃迁时放出一条光谱。",
    asideA: "[[1913]]年的氢原子模型用轨道图说话。那是模型，不是微型太阳系。",
    asideB: "互补原理说：波动图景与粒子图景，不能同时说满。",
    dungeon: "原子跃迁塔",
    dungeonEn: "Atomic Jump Tower",
    latin: "Niels Bohr",
    bio: [
      "玻尔帮助人们第一次比较直观地理解了原子的内部。电子并不是想在哪里就在哪里，而是只能待在特定的“能量层级”上，还会在不同层级之间跳来跳去。",
    ],
    line: "可以把电子想成住在一栋有固定楼层的房子里。",
  },
  {
    id: "debroglie",
    name: "德布罗意",
    fullName: "路易·德布罗意",
    title: "德布罗意 · 物质波",
    domain: "量子物理 / 物质波",
    avatar: "./assets/disks/debroglie.png",
    guide: "./assets/guides/debroglie.png",
    alt: "德布罗意档案软盘",
    guideAlt: "德布罗意的物质波实验引导画面",
    placeholder: "粒子怎么会有波长？",
    lead: "物质也可以有波长。运动越慢，[[物质波]]铺得越开。",
    asideA: "粒子的动量与波长成反比。电子也能像光一样干涉。",
    asideB: "这不是比喻。衍射实验把波长写进了实物本身。",
    dungeon: "物质的波纹",
    dungeonEn: "Ripples of Matter",
    latin: "Louis de Broglie",
    bio: [
      "物质也可以有波长。德布罗意提出，运动越慢，这种波动铺得越开。",
      "后来的电子衍射实验证明，这不是比喻，波长写进了实物本身。",
    ],
    line: "粒子也可以像波一样铺开。",
  },
  {
    id: "schrodinger",
    name: "薛定谔",
    fullName: "埃尔温·薛定谔",
    title: "薛定谔 · 叠加态",
    domain: "量子物理 / 叠加态",
    avatar: "./assets/disks/schrodinger.png",
    guide: "./assets/guides/schrodinger.png",
    alt: "薛定谔档案软盘",
    guideAlt: "薛定谔侧耳倾听桌上的木箱，作为进入实验的引导画面",
    placeholder: "波函数到底描述什么？",
    lead: "波函数同时写出多种可能。猫的故事是归谬，不是一只[[既死又活]]的吉祥物。",
    asideA: "[[1926]]年的波动方程让微观状态可以叠加。概率读法来自玻恩。",
    asideB: "打开箱子之前，方程描述的是振幅，不是已经发生的事实。",
    dungeon: "未打开的箱子",
    dungeonEn: "Unopened Box",
    latin: "Erwin Schrödinger",
    bio: [
      "薛定谔研究的是一个很奇妙的问题：在量子世界里，我们不能总是确定一个粒子到底在哪里，只能知道它“可能出现在哪里”。",
      "他还提出了著名的“薛定谔的猫”，让人们感受到量子世界到底有多反直觉。",
    ],
    line: "在量子世界里，很多事情不是“确定发生”，而是“有多大可能发生”。",
  },
  {
    id: "maxwell",
    name: "麦克斯韦",
    fullName: "詹姆斯·麦克斯韦",
    title: "麦克斯韦 · 电磁波",
    domain: "电磁学 / 光",
    avatar: "./assets/disks/maxwell.png",
    guide: "./assets/guides/maxwell.png",
    alt: "麦克斯韦档案软盘",
    guideAlt: "麦克斯韦在书桌前调试仪器，作为进入实验的引导画面",
    placeholder: "电和磁如何互相产生？",
    lead: "变化的电场会生磁，变化的磁场会生电。光就是这样跑起来的[[电磁波]]。",
    asideA: "位移电流补上了方程的缺口。真空里的波速正好是光速。",
    asideB: "法拉第看见力线。麦克斯韦把它们写成式子。赫兹的证实在他身后。",
    dungeon: "光的第四扇门",
    dungeonEn: "Fourth Door of Light",
    latin: "James Clerk Maxwell",
    bio: [
      "麦克斯韦把电、磁和光联系到了一起。以前人们觉得它们是不同的现象，但他发现，其实它们都属于同一个电磁世界。",
    ],
    line: "他让人们知道，光其实也是一种电磁波。",
  },
];

// Visual concept labels complement each scientist’s full biography.
const EXHIBIT_LABELS = {
  newton: { lead: "苹果与月亮，都在引力中下落。", bio: "把下落的苹果与绕行的月亮，放进同一条引力定律。", concepts: [["apple", "下落"], ["gravity", "吸引"], ["orbit", "轨道"]] },
  einstein: { lead: "时间与空间，会随运动改变。", bio: "速度与引力，改变我们测量时间和空间的方式。", concepts: [["watch", "时间"], ["radio", "光速"], ["watch", "时空"]] },
  dirac: { lead: "一个方程，预言了反物质。", bio: "让量子力学与相对论在电子方程中相遇。", concepts: [["charge", "电子"], ["chalkboard", "方程"], ["charge", "反物质"]] },
  feynman: { lead: "抵达同一点，有无数种可能。", bio: "把所有可能路径的振幅相加，理解粒子的行为。", concepts: [["chalkboard", "路径"], ["atom", "振幅"], ["chalkboard", "相互作用"]] },
  yang: { lead: "微观世界，不总与镜像相同。", bio: "从宇称到规范场，探索自然界的对称与破缺。", concepts: [["parity", "镜像"], ["charge", "对称"], ["parity", "破缺"]] },
  bohr: { lead: "电子跃迁，留下光谱。", bio: "电子在特定能级间跃迁，吸收或放出光。", concepts: [["atom", "能级"], ["charge", "跃迁"], ["radio", "光谱"]] },
  debroglie: { lead: "粒子，也有波长。", bio: "动量越大，物质波的波长越短。", concepts: [["atom", "粒子"], ["radio", "波动"], ["chalkboard", "干涉"]] },
  schrodinger: { lead: "用波函数，描述微观可能。", bio: "波函数描述量子态；测量结果以概率呈现。", concepts: [["cat", "叠加"], ["chalkboard", "波函数"], ["atom", "测量"]] },
  maxwell: { lead: "电与磁接力，光由此传播。", bio: "变化的电场与磁场相互关联，形成电磁波。", concepts: [["charge", "电场"], ["magnet", "磁场"], ["radio", "光"]] },
};

const FIGURE_BASELINES = new Map(FIGURES.map((figure) => [figure.id, { ...figure }]));

const RELICS = [
  { id: "apple", src: "./assets/relics/apple.png?v=cutout-1", label: "苹果", alt: "一颗像素红苹果" },
  { id: "magnet", src: "./assets/relics/magnet.png?v=cutout-1", label: "电磁", alt: "蹄形磁铁与线圈" },
  { id: "radio", src: "./assets/relics/radio.png?v=cutout-1", label: "电波", alt: "发着电波的无线电仪" },
  { id: "watch", src: "./assets/relics/watch.png?v=cutout-1", label: "时计", alt: "怀表压在弯曲的时空格网上" },
  { id: "atom", src: "./assets/relics/atom.png?v=cutout-1", label: "原子", alt: "木座上的金色原子仪" },
  { id: "chalkboard", src: "./assets/relics/chalkboard.png?v=cutout-1", label: "相互作用", alt: "画着费曼图的黑板" },
  { id: "parity", src: "./assets/relics/parity.png?v=cutout-1", label: "宇称", alt: "镜子两边颜色对调的实验装置" },
  { id: "cat", src: "./assets/relics/cat.png?v=cutout-1", label: "猫", alt: "箱子里探出头的黑猫" },
  { id: "charge", src: "./assets/relics/charge.png?v=cutout-1", label: "电荷", alt: "正负电荷相碰" },
];

const fan = document.querySelector("#fan");
const heroTitle = document.querySelector("#heroTitle");
const heroLede = document.querySelector("#heroLede");
const pressStart = document.querySelector("#pressStart");
const ctaStatus = document.querySelector("#ctaStatus");
const enterGame = document.querySelector("#enterGame");
const guideImage = document.querySelector("#guideImage");
const dungeonTitle = document.querySelector("#dungeonTitle");
const dungeonZh = document.querySelector("#dungeonZh");
const dungeonEn = document.querySelector("#dungeonEn");
const scientistBio = document.querySelector("#scientistBio");
const bioLatin = document.querySelector("#bioLatin");
const bioName = document.querySelector("#bioName");
const bioBody = document.querySelector("#bioBody");
const bioLine = document.querySelector("#bioLine");
const portal = document.querySelector("#portal");
const portalImage = document.querySelector("#portalImage");
const portalTitle = document.querySelector("#portalTitle");
const portalLeave = document.querySelector("#portalLeave");
const openTalk = document.querySelector("#openTalk");
const talkRoom = document.querySelector("#talkRoom");
const talkLatin = document.querySelector("#talkLatin");
const talkTitle = document.querySelector("#talkTitle");
const talkLeave = document.querySelector("#talkLeave");
const talkForm = document.querySelector("#talkForm");
const talkInput = document.querySelector("#talkInput");
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

const initialFigure = new URLSearchParams(location.search).get("figure");
let currentId = FIGURES.some((figure) => figure.id === initialFigure) ? initialFigure : FIGURES[0].id;
let archive = null;
let lastClicked = null;
const conversations = new Map();
const TALKS_KEY = "qo-visitor-talks";
const TALKS_LIMIT = 40;
let activeThemePack = null;
let activeThemeUrls = [];
let themeGameStep = 0;
let themeGameCompleted = false;
let themeGameResolved = false;
const gameModules = new Map();
const moduleIdToFigureId = new Map();
let activeGameUrls = [];

const THEME_KEY = "qo-alt-theme";
const appearance = document.querySelector(".appearance");
const scientistAgentApiRoot = (document.documentElement.dataset.scientistAgentApi || "").replace(/\/$/, "");

function compact(text) {
  return text.replace(/\s+/g, "");
}

function wallLabel(text) {
  return (text ?? "").replace(/\[\[([^\]]+)\]\]/g, "$1");
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

function loadTalks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TALKS_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return;
    Object.entries(parsed).forEach(([id, log]) => {
      if (!Array.isArray(log)) return;
      conversations.set(
        id,
        log.filter((item) => item?.role && typeof item.text === "string"),
      );
    });
  } catch {
    /* keep an empty in-memory log */
  }
}

function saveTalks() {
  const data = {};
  conversations.forEach((log, id) => {
    data[id] = log.slice(-TALKS_LIMIT);
  });
  try {
    localStorage.setItem(TALKS_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}

function conversationFor(scientistId) {
  let log = conversations.get(scientistId);
  if (!log) {
    log = [];
    conversations.set(scientistId, log);
  }
  return log;
}

async function loadThread(scientistId) {
  if (!apiEnabled()) return;
  try {
    const payload = await api(`/api/scientists/${scientistId}/thread`);
    conversations.set(
      scientistId,
      (payload.messages ?? []).map((item) => ({ role: item.role, text: item.text })),
    );
    saveTalks();
    if (scientistId === currentId) renderAskLog();
  } catch {
    /* keep the local cache */
  }
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
  selectFigure(FIGURES[(index + delta + FIGURES.length) % FIGURES.length].id, { syncRoute: true });
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

function updateBio(figure) {
  if (!scientistBio || !bioLatin || !bioName || !bioBody || !bioLine) return;
  const conceptPath = document.querySelector("#conceptPath");
  conceptPath?.replaceChildren(...(EXHIBIT_LABELS[figure.id]?.concepts || []).map(([icon, label]) => {
    const item = document.createElement("div");
    item.className = "concept-step";
    const image = document.createElement("img");
    const conceptAssets = {
      gravity: "./published-modules/newton-gravity/game-pack/assets/props/mass-ball.png",
      orbit: "./published-modules/newton-gravity/game-pack/assets/props/central-body.png",
    };
    image.src = conceptAssets[icon] || `./assets/relics/${icon}.png`;
    image.alt = "";
    const caption = document.createElement("span");
    caption.textContent = label;
    item.append(image, caption);
    return item;
  }));
  bioLatin.textContent = figure.latin || "";
  bioName.textContent = figure.name;
  bioBody.replaceChildren(
    ...(figure.bio ?? []).map((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      return paragraph;
    }),
  );
  if (figure.line) {
    bioLine.hidden = false;
    bioLine.textContent = figure.line;
  } else {
    bioLine.hidden = true;
    bioLine.textContent = "";
  }
}

function updateCopy() {
  const figure = currentFigure();
  heroTitle.textContent = figure.name;
  if (heroLede) heroLede.textContent = wallLabel(figure.lead);
  if (dungeonTitle && dungeonZh && dungeonEn) {
    if (figure.dungeon) {
      dungeonTitle.hidden = false;
      dungeonZh.textContent = figure.dungeon;
      dungeonEn.textContent = figure.dungeonEn || "";
      dungeonEn.hidden = !figure.dungeonEn;
    } else {
      dungeonTitle.hidden = true;
      dungeonZh.textContent = "";
      dungeonEn.textContent = "";
    }
  }
  updateBio(figure);
  const worksList = document.querySelector('#worksList[data-works-scope="scientist"]');
  if (worksList && worksList.dataset.scientistId !== figure.id) {
    worksList.dataset.scientistId = figure.id;
    document.dispatchEvent(new CustomEvent("wuli:scientist-change"));
  }
  const worksOwner = document.querySelector("#worksOwner");
  if (worksOwner) worksOwner.textContent = `${figure.name} · 互动作品`;
  enterGame.setAttribute("aria-label", `开始与${figure.name}的对话`);
  pressStart?.setAttribute("aria-label", usesNewtonFilm() ? "进入牛顿的科普电影" : `进入${figure.name}的游戏`);
  if (talkLatin) talkLatin.textContent = figure.latin || "";
  if (talkTitle) talkTitle.textContent = `与${figure.name}对话`;
  openTalk?.setAttribute("aria-label", `开始与${figure.name}的对话`);
  if (talkInput) talkInput.placeholder = figure.placeholder;
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

function selectFigure(id, { lightboxOnRepeat = false, syncRoute = false } = {}) {
  const figure = FIGURES.find((item) => item.id === id);
  if (!figure) return;

  if (lightboxOnRepeat && id === currentId && lastClicked === id) {
    lightboxImage.src = figure.avatar;
    lightboxImage.alt = figure.alt;
    lightbox.showModal();
    return;
  }

  currentId = id;
  if (syncRoute) {
    const url = new URL(location.href);
    url.searchParams.set("figure", id);
    if (url.hash.startsWith("#experiment-")) url.hash = "stage";
    for (const key of ["module", "play", "talk"]) url.searchParams.delete(key);
    history.replaceState(null, "", url);
  }
  lastClicked = id;
  if (themeGame?.open && activeThemePack?.manifest.target_scientist_id !== id) themeGame.close();
  updateCopy();
  loadThread(id);
}

document.addEventListener("wuli:navigate-scientist", (event) => {
  selectFigure(event.detail?.id);
});

function usesNewtonFilm() {
  return currentId === "newton"
    && activeThemePack?.manifest.target_scientist_id !== currentId
    && (!gameModules.has(currentId) || gameModules.get(currentId).published);
}

function openPortal() {
  if (activeThemePack?.manifest.target_scientist_id === currentId) {
    openThemeGame();
    return;
  }
  if (usesNewtonFilm()) {
    openFilmExperience(pressStart);
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
    name: figure?.name || manifest.presentation.scientist_name,
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
  if (!quiet) setGameModuleStatus(`已导入：${figure.title}。点击上方 Press start 即可游玩。`, "success");
}

function focusRequestedModule() {
  const moduleId = new URLSearchParams(location.search).get("module");
  if (!moduleId) return;
  const figureId = moduleIdToFigureId.get(moduleId);
  if (!figureId) { setGameModuleStatus("这个社区作品尚未发布或已经下架。", "error"); return; }
  selectFigure(figureId);
  pressStart?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  pressStart?.classList.remove("community-cue");
  requestAnimationFrame(() => pressStart?.classList.add("community-cue"));
  pressStart?.focus({ preventScroll: true });
  setGameModuleStatus("已从社区选中作品，正在进入游戏。", "success");
  window.setTimeout(() => pressStart?.classList.remove("community-cue"), 2800);
  return true;
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
    if (loaded) setGameModuleStatus(`已加载 ${loaded} 个作品简介；完整游戏会在点击 Press start 后加载。`, "success");
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

function activateThemePackRecord(record, { select = true } = {}) {
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
  if (select) selectFigure(figure.id);
  else updateCopy();
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

function closeModuleGame() {
  if (moduleGame?.open) moduleGame.close();
  if (moduleGameFrame) moduleGameFrame.srcdoc = "";
  releaseActiveGameUrls();
}


function closePortal() {
  if (portal.open) portal.close();
}

function openTalkRoom() {
  if (!talkRoom) return;
  if (!talkRoom.open) talkRoom.showModal();
  loadThread(currentId).then(() => {
    renderAskLog();
    talkInput?.focus();
  });
  talkInput?.focus();
}

function closeTalkRoom() {
  if (talkRoom?.open) talkRoom.close();
}

function appendMessage(role, text, scientistId = currentId) {
  conversationFor(scientistId).push({ role, text });
  saveTalks();
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

  setStatus(scientistId, scientistAgentApiRoot ? "正在通信" : "正在翻档案");
  openTalkRoom();
  appendMessage("user", message, scientistId);

  if (!archive) {
    try {
      const response = await fetch("./data/scientist-agents.json");
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
      const payload = await api(`/api/scientists/${scientistId}/chat`, {
        method: "POST",
        json: { message },
      });
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
    const response = await fetch("./data/scientist-agents.json");
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
  selectFigure(plate.dataset.id, { lightboxOnRepeat: true, syncRoute: true });
});

fanPrev.addEventListener("click", () => stepFigure(-1));
fanNext.addEventListener("click", () => stepFigure(1));

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (talkRoom?.open) return;
  if (relicsRoot?.contains(event.target)) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepRelic(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepRelic(-1);
    }
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    stepFigure(1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepFigure(-1);
  }
  if (event.key === "Escape") {
    if (talkRoom?.open) {
      closeTalkRoom();
      return;
    }
    if (moduleGame?.open) {
      closeModuleGame();
      return;
    }
    if (themeGame?.open) {
      themeGame.close();
      return;
    }
    if (portal.open) {
      closePortal();
    }
  }
});

pressStart?.addEventListener("click", openPortal);
enterGame.addEventListener("click", openTalkRoom);
portalLeave.addEventListener("click", closePortal);
portal.addEventListener("click", (event) => {
  if (event.target === portal) closePortal();
});

openTalk?.addEventListener("click", openTalkRoom);
talkLeave?.addEventListener("click", closeTalkRoom);
talkRoom?.addEventListener("click", (event) => {
  if (event.target === talkRoom) closeTalkRoom();
});
talkForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!talkInput) return;
  const message = talkInput.value;
  talkInput.value = "";
  sendQuestion(message);
});

if (themeDeveloperTools) themeDeveloperTools.hidden = !new URLSearchParams(location.search).has("dev");
const importZone = document.querySelector("#importZone");
if (importZone) importZone.hidden = !new URLSearchParams(location.search).has("dev");
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
moduleGameLeave.addEventListener("click", closeModuleGame);
moduleGame.addEventListener("click", (event) => {
  if (event.target === moduleGame) closeModuleGame();
});


lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

appearance?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme]");
  if (!button) return;
  applyTheme(button.dataset.theme, true);
});

const relicsRoot = document.querySelector("#relics");
const relicsTrack = document.querySelector("#relicsTrack");
let relicIndex = 0;

function wrapRelic(index) {
  const length = RELICS.length;
  return ((index % length) + length) % length;
}

function makeRelicButton(relic) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "relic";
  button.dataset.id = relic.id;
  button.setAttribute("aria-label", relic.label);
  button.tabIndex = -1;
  const image = document.createElement("img");
  image.src = relic.src;
  image.alt = relic.alt;
  const name = document.createElement("span");
  name.textContent = relic.label;
  button.append(image, name);
  return button;
}

function renderRelics() {
  if (!relicsTrack) return;
  relicsTrack.replaceChildren(
    ...[0, 1].map((copy) => {
      const set = document.createElement("div");
      set.className = "relics-set";
      if (copy === 1) set.setAttribute("aria-hidden", "true");
      set.append(...RELICS.map(makeRelicButton));
      return set;
    }),
  );
}

function stepRelic(delta) {
  relicIndex = wrapRelic(relicIndex + delta);
  relicsRoot?.classList.toggle("is-reverse", delta < 0);
}

relicsTrack?.addEventListener("click", (event) => {
  const button = event.target.closest(".relic");
  if (!button) return;
  const next = RELICS.findIndex((relic) => relic.id === button.dataset.id);
  if (next < 0) return;
  relicIndex = next;
});

document.querySelector("#relicPrev")?.addEventListener("click", () => stepRelic(-1));
document.querySelector("#relicNext")?.addEventListener("click", () => stepRelic(1));

let relicTouchX = null;
relicsTrack?.addEventListener("touchstart", (event) => {
  relicTouchX = event.changedTouches[0]?.clientX ?? null;
}, { passive: true });
relicsTrack?.addEventListener("touchend", (event) => {
  if (relicTouchX == null) return;
  const x = event.changedTouches[0]?.clientX;
  const delta = (x ?? relicTouchX) - relicTouchX;
  relicTouchX = null;
  if (Math.abs(delta) < 40) return;
  stepRelic(delta < 0 ? 1 : -1);
}, { passive: true });


window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
  if (localStorage.getItem(THEME_KEY)) return;
  applyTheme(event.matches ? "light" : "dark", false);
});

function applyRoute() {
  const params = new URLSearchParams(location.search);
  const figureId = params.get("figure");
  if (params.has("module")) {
    if (!focusRequestedModule()) return;
  } else if (figureId) selectFigure(figureId);
  if (params.has("module") && params.get("talk") !== "1") {
    openGameModule(gameModules.get(currentId));
  } else if (params.get("talk") === "1") {
    openTalkRoom();
  } else if (params.get("play") === "1") {
    openPortal();
  }
}

applyTheme(preferredTheme(), false);
loadTalks();
renderFan();
renderRelics();
updateCopy();
ensureArchive().then(async () => {
  try {
    const savedTheme = await loadActiveThemePack();
    if (savedTheme) {
      const route = new URLSearchParams(location.search);
      activateThemePackRecord(savedTheme, { select: !route.has("figure") && !route.has("module") });
    }
  } catch {
    deactivateThemePack();
    setThemePackStatus("上次主题包无法读取，已安全回到默认展厅。", "error");
  }
  await loadPublishedModules();
  applyRoute();
  if (apiEnabled()) {
    try {
      await migrateLocalIfNeeded();
    } catch {
      /* keep local talks */
    }
    await loadThread(currentId);
  }
});
