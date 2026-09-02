const MODULE_SCHEMA = "wuli-science-module-2";
const RELEASE_POLICY = "pixel-science-release-2";
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA = /^[a-f0-9]{64}$/;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CODE_SUFFIX = /\.(?:js|mjs|cjs|jsx|ts|tsx|py|pyc|cpp|cc|cxx|c|h|hpp|html?|css|wasm|exe|dll|dylib|sh|bash|zsh|bat|cmd|ps1|php|rb|go|rs|java|class|jar)$/i;
const ARCHIVE_SUFFIX = /\.(?:zip|rar|7z|tar|gz|bz2|xz)$/i;
const ALLOWED_SUFFIX = /\.(?:json|png|jpe?g|webp|wav|mp3|ogg|woff2?|ttf|otf|txt)$/i;

export const GAME_MODULE_LIMITS = Object.freeze({
  maxZipBytes: 50 * 1024 * 1024,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxFiles: 300,
  maxFileBytes: 20 * 1024 * 1024,
});

function pathOk(path) {
  return typeof path === "string"
    && path.length > 0
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.includes("\0")
    && !path.split("/").some((part) => part === "" || part === "." || part === "..");
}

function normalizeFiles(files, errors) {
  const rows = [...files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
  if (rows.length > GAME_MODULE_LIMITS.maxFiles) errors.push(`文件过多：最多 ${GAME_MODULE_LIMITS.maxFiles} 个`);
  let total = 0;
  for (const { file, path } of rows) {
    total += file.size;
    if (!pathOk(path)) errors.push(`不安全的文件路径：${path || "(空路径)"}`);
    if (file.size > GAME_MODULE_LIMITS.maxFileBytes) errors.push(`单个文件过大：${path}`);
  }
  if (total > GAME_MODULE_LIMITS.maxExpandedBytes) errors.push("解压后内容超过 100MB");

  const first = rows[0]?.path?.split("/")[0];
  const root = first && rows.every(({ path }) => path.startsWith(`${first}/`)) ? `${first}/` : "";
  const entries = new Map();
  for (const row of rows) {
    const path = root ? row.path.slice(root.length) : row.path;
    if (!path || entries.has(path)) errors.push(`重复或无效文件路径：${path || row.path}`);
    else entries.set(path, row.file);
  }
  return entries;
}

async function sha256(file) {
  const value = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(value)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function parseJson(entries, path, errors, required = true) {
  const file = entries.get(path);
  if (!file) {
    if (required) errors.push(`缺少文件：${path}`);
    return null;
  }
  try { return JSON.parse(await file.text()); }
  catch { errors.push(`${path} 不是有效 JSON`); return null; }
}

async function validatePng(entries, asset, label, errors) {
  if (!asset || !pathOk(asset.path) || asset.mime !== "image/png" || !SHA.test(asset.sha256 ?? "")) {
    errors.push(`${label}素材声明无效`);
    return;
  }
  const file = entries.get(asset.path);
  if (!file) { errors.push(`缺少素材：${asset.path}`); return; }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    errors.push(`${asset.path} 扩展名是 PNG，但内容不是 PNG`);
    return;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(16) !== asset.width || view.getUint32(20) !== asset.height) errors.push(`${asset.path} 尺寸与声明不一致`);
  if (await sha256(file) !== asset.sha256) errors.push(`${asset.path} 指纹不匹配`);
}

function validatePresentation(manifest, errors) {
  const presentation = manifest.presentation ?? {};
  for (const key of ["title", "scientist_name", "domain", "summary", "placeholder", "disk_alt", "guide_alt"]) {
    if (typeof presentation[key] !== "string" || !presentation[key].trim()) errors.push(`展示信息缺少 ${key}`);
  }
  const creator = manifest.creator;
  if (creator != null && typeof creator !== "object") errors.push("creator 必须是对象");
  for (const key of ["display_name", "intro", "license_note"]) {
    if (creator?.[key] != null && typeof creator[key] !== "string") errors.push(`creator.${key} 必须是文字`);
  }
}

function validateVisualContract(packManifest, visuals, errors) {
  const contract = packManifest?.asset_contract ?? {};
  if (contract.brand_profile !== "pixel-science-theater-v2") errors.push("视觉规范不是 pixel-science-theater-v2");
  if (contract.sprite_frames !== 26) errors.push("角色图集必须是新版 26 帧");
  if (JSON.stringify(contract.logical_background_size) !== JSON.stringify([480, 270])) errors.push("逻辑背景必须为 480×270");

  const animationContract = visuals?.character?.base_animation_contract ?? {};
  const animations = animationContract.animations;
  const expected = { idle: 4, talk: 4, point: 4, think: 4, surprise: 4, celebrate: 6 };
  if (!animations || typeof animations !== "object") errors.push("visuals.json 缺少 26 帧动作表");
  else {
    for (const [name, count] of Object.entries(expected)) {
      const row = animations[name];
      const frames = Array.isArray(row) ? row.length : row?.frames;
      if (frames !== count) errors.push(`角色动作 ${name} 必须为 ${count} 帧`);
      if (name === "idle" ? row?.loop === false : row?.loop === true) errors.push(`角色动作 ${name} 的循环设置不合格`);
    }
    for (const name of Object.keys(animations)) if (!(name in expected)) errors.push(`不允许的旧版角色动作：${name}`);
  }

  const motion = visuals?.motion_contract ?? {};
  if ((motion.camera_shake_max_px ?? 999) > 2 || (motion.camera_shake_max_ms ?? 999) > 120) errors.push("镜头震动超过新版限制");
  if ((motion.screen_flash_max_ms ?? 999) > 180 || (motion.screen_flash_max_alpha ?? 999) > 0.12) errors.push("闪屏超过新版限制");
  if ((motion.particle_max ?? 999) > 16) errors.push("粒子数量超过新版限制");
  if ((motion.failure_feedback_cooldown_ms ?? 0) < 600) errors.push("失败反馈冷却时间必须至少 600ms");
  const reduced = new Set(motion.reduced_motion_disables ?? []);
  for (const name of ["camera-shake", "screen-flash", "nonessential-particles", "large-ambient-loops"]) {
    if (!reduced.has(name)) errors.push(`减少动态效果时必须关闭 ${name}`);
  }
}

function validateRelease(moduleManifest, packManifest, sources, licenses, report, errors) {
  const release = moduleManifest.release ?? {};
  if (release.policy !== RELEASE_POLICY || release.status !== "approved-for-public-release") errors.push("作品没有通过新版发布门禁");
  if (release.pack_id !== moduleManifest.module_id || packManifest?.pack_id !== moduleManifest.module_id) errors.push("作品 ID 与内容包 ID 不一致");
  if (licenses?.approval_state !== "FINAL_PACK_APPROVED") errors.push("最终用户审批未通过");
  if (!Array.isArray(licenses?.licenses) || licenses.licenses.length === 0) errors.push("缺少素材授权记录");
  else if (licenses.licenses.some((item) => item.public_release_allowed !== true || !item.evidence_path)) errors.push("存在未获公开发布许可或无证据的素材");
  if (!Array.isArray(sources?.sources) || sources.sources.length === 0 || !Array.isArray(sources?.claims) || sources.claims.length === 0) errors.push("科学来源或事实映射不完整");
  if (report?.status !== "final-pack-approved" || report?.required_current_approval !== "FINAL_PACK_APPROVED") errors.push("正式发布报告尚未最终批准");
  if ((report?.review?.p0 ?? 99) !== 0 || (report?.review?.p1 ?? 99) !== 0) errors.push("仍存在 P0/P1 问题");
  const tests = report?.tests ?? [];
  if (!Array.isArray(tests) || !tests.some((item) => String(item).includes("host-runtime-full-playthrough"))) errors.push("缺少主站完整浏览器游玩测试");
}

export async function validateGameModule(files, { onProgress = () => {} } = {}) {
  const errors = [];
  onProgress("读取", "正在读取作品包");
  const entries = normalizeFiles(files, errors);
  const manifest = await parseJson(entries, "module.json", errors);
  if (!manifest) return { ok: false, errors };
  if (manifest.schema_version !== MODULE_SCHEMA) {
    if (manifest.schema_version === "wuli-science-module-1") errors.push("这是旧版作品包，请用最新版 Skill 重新导出");
    else errors.push("作品包版本无效");
  }
  if (!ID.test(manifest.module_id ?? "") || !SEMVER.test(manifest.version ?? "")) errors.push("作品 ID 或版本号无效");
  validatePresentation(manifest, errors);
  if (manifest.game?.format !== "pixel-science-content-pack-2" || manifest.game?.runtime?.name !== "pixel-science-browser" || manifest.game?.root !== "game-pack") errors.push("不是兼容的完整小游戏包");

  onProgress("验包", "正在检查文件、指纹和视觉规范");
  await validatePng(entries, manifest.assets?.disk, "软盘", errors);
  await validatePng(entries, manifest.assets?.guide, "引导图", errors);
  const requiredJson = ["manifest.json", "scientist.json", "concept.json", "experience.json", "models.json", "visuals.json", "sources.json", "licenses.json", "qa/release-report.json"];
  const pack = {};
  for (const path of requiredJson) pack[path] = await parseJson(entries, `game-pack/${path}`, errors);
  const packManifest = pack["manifest.json"];
  if (packManifest?.schema_version !== "2.0.0" || !ID.test(packManifest?.pack_id ?? "")) errors.push("完整小游戏内容版本无效");

  const declared = new Set(["module.json", manifest.assets?.disk?.path, manifest.assets?.guide?.path, ...requiredJson.map((path) => `game-pack/${path}`)]);
  for (const asset of packManifest?.assets ?? []) {
    if (!asset?.asset_id || !pathOk(asset.path) || !SHA.test(asset.sha256 ?? "")) { errors.push("完整小游戏素材声明无效"); continue; }
    const fullPath = `game-pack/${asset.path}`;
    declared.add(fullPath);
    if (asset.metadata) declared.add(`game-pack/${asset.metadata}`);
    const file = entries.get(fullPath);
    if (!file) errors.push(`完整小游戏缺少素材：${asset.path}`);
    else if (await sha256(file) !== asset.sha256) errors.push(`完整小游戏素材指纹不匹配：${asset.path}`);
  }
  for (const item of pack["licenses.json"]?.licenses ?? []) if (item.evidence_path) declared.add(`game-pack/${item.evidence_path}`);

  for (const path of entries.keys()) {
    if (!pathOk(path)) continue;
    if (CODE_SUFFIX.test(path)) errors.push(`不允许的代码文件：${path}`);
    else if (ARCHIVE_SUFFIX.test(path)) errors.push(`不允许嵌套压缩包：${path}`);
    else if (!ALLOWED_SUFFIX.test(path)) errors.push(`不允许的文件类型：${path}`);
    if (!declared.has(path)) errors.push(`未在清单声明的文件：${path}`);
  }
  validateVisualContract(packManifest, pack["visuals.json"], errors);

  onProgress("验授权", "正在核对来源、授权和最终审批");
  validateRelease(manifest, packManifest, pack["sources.json"], pack["licenses.json"], pack["qa/release-report.json"], errors);

  onProgress("验运行", errors.length ? "作品包未通过运行前检查" : "运行前检查通过");
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  onProgress("加入展厅", "作品已通过全部门禁");
  return { ok: true, errors: [], manifest, entries, pack };
}

export { MODULE_SCHEMA, RELEASE_POLICY };
