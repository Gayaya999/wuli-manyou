const PACK_SCHEMA_VERSION = "1.0.0";
const ACTIVE_PACK_KEY = "qo-active-theme-pack-v1";
const PROGRESS_PREFIX = "qo-theme-progress-v1:";
const DB_NAME = "qo-theme-packs-v1";
const DB_STORE = "packs";
const MAX_PACK_BYTES = 4 * 1024 * 1024;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const TOP_LEVEL_KEYS = new Set([
  "schema_version", "pack_id", "version", "target_scientist_id",
  "presentation", "assets", "gameplay", "sources", "usage",
]);
const PRESENTATION_KEYS = new Set([
  "title", "domain", "placeholder", "guide_alt", "stage_note", "card_label",
]);
const ASSET_KEYS = new Set(["path", "mime", "sha256", "width", "height"]);
const GAMEPLAY_KEYS = new Set(["template_id", "title", "intro", "steps", "completion"]);
const STEP_KEYS = new Set(["id", "prompt", "choices", "correct_choice_id", "observation", "hint"]);
const CHOICE_KEYS = new Set(["id", "label"]);
const COMPLETION_KEYS = new Set(["title", "summary"]);
const SOURCE_KEYS = new Set(["id", "title", "url"]);
const USAGE_KEYS = new Set(["license_status", "provenance_note"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value, allowed, label, errors) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} contains unsupported field: ${key}`);
  }
}

function requiredText(value, label, errors, max = 160) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} must be non-empty text`);
    return;
  }
  if (value.length > max) errors.push(`${label} exceeds ${max} characters`);
  if (/[<>\u0000-\u001f]/.test(value)) errors.push(`${label} contains forbidden markup or control characters`);
}

function safeRelativePath(value) {
  return typeof value === "string"
    && /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/.test(value)
    && !value.includes("\\")
    && !value.includes("//");
}

function validVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function validateAssetDescriptor(role, value, errors) {
  if (!isObject(value)) {
    errors.push(`assets.${role} must be an object`);
    return;
  }
  unknownKeys(value, ASSET_KEYS, `assets.${role}`, errors);
  if (!safeRelativePath(value.path) || !value.path.startsWith("assets/") || !value.path.endsWith(".png")) {
    errors.push(`assets.${role}.path must be a safe PNG path inside assets/`);
  }
  if (value.mime !== "image/png") errors.push(`assets.${role}.mime must be image/png`);
  if (!SHA_PATTERN.test(value.sha256 ?? "")) errors.push(`assets.${role}.sha256 must be lowercase SHA-256`);
  if (!Number.isInteger(value.width) || value.width < 128 || value.width > 2048) {
    errors.push(`assets.${role}.width must be an integer from 128 to 2048`);
  }
  if (!Number.isInteger(value.height) || value.height < 128 || value.height > 2048) {
    errors.push(`assets.${role}.height must be an integer from 128 to 2048`);
  }
}

export function validateThemeManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return ["manifest must be a JSON object"];
  unknownKeys(manifest, TOP_LEVEL_KEYS, "manifest", errors);
  if (manifest.schema_version !== PACK_SCHEMA_VERSION) errors.push(`schema_version must be ${PACK_SCHEMA_VERSION}`);
  if (!ID_PATTERN.test(manifest.pack_id ?? "")) errors.push("pack_id must be lowercase kebab-case");
  if (!validVersion(manifest.version)) errors.push("version must use semantic x.y.z format");
  if (!ID_PATTERN.test(manifest.target_scientist_id ?? "")) errors.push("target_scientist_id must be lowercase kebab-case");
  if (!Array.isArray(manifest.sources) || manifest.sources.length < 1 || manifest.sources.length > 8) {
    errors.push("sources must contain 1 to 8 references");
  } else {
    const sourceIds = new Set();
    manifest.sources.forEach((source, index) => {
      const label = `sources[${index}]`;
      if (!isObject(source)) {
        errors.push(`${label} must be an object`);
        return;
      }
      unknownKeys(source, SOURCE_KEYS, label, errors);
      if (!ID_PATTERN.test(source.id ?? "") || sourceIds.has(source.id)) errors.push(`${label}.id must be unique kebab-case`);
      sourceIds.add(source.id);
      requiredText(source.title, `${label}.title`, errors, 160);
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:") errors.push(`${label}.url must use HTTPS`);
      } catch {
        errors.push(`${label}.url must be a valid HTTPS URL`);
      }
    });
  }
  if (!isObject(manifest.usage)) {
    errors.push("usage must be an object");
  } else {
    unknownKeys(manifest.usage, USAGE_KEYS, "usage", errors);
    if (!new Set(["local-demo-only", "approved-for-public-release"]).has(manifest.usage.license_status)) {
      errors.push("usage.license_status must be local-demo-only or approved-for-public-release");
    }
    requiredText(manifest.usage.provenance_note, "usage.provenance_note", errors, 200);
  }

  if (!isObject(manifest.presentation)) {
    errors.push("presentation must be an object");
  } else {
    unknownKeys(manifest.presentation, PRESENTATION_KEYS, "presentation", errors);
    for (const key of PRESENTATION_KEYS) requiredText(manifest.presentation[key], `presentation.${key}`, errors, key === "placeholder" ? 120 : 80);
  }

  if (!isObject(manifest.assets)) {
    errors.push("assets must be an object");
  } else {
    const roles = Object.keys(manifest.assets);
    if (roles.length !== 2 || !roles.includes("disk") || !roles.includes("guide")) {
      errors.push("assets must contain exactly disk and guide");
    }
    for (const role of ["disk", "guide"]) validateAssetDescriptor(role, manifest.assets[role], errors);
  }

  const gameplay = manifest.gameplay;
  if (!isObject(gameplay)) {
    errors.push("gameplay must be an object");
  } else {
    unknownKeys(gameplay, GAMEPLAY_KEYS, "gameplay", errors);
    if (gameplay.template_id !== "choice-sequence-v1") errors.push("gameplay.template_id must be choice-sequence-v1");
    requiredText(gameplay.title, "gameplay.title", errors, 80);
    requiredText(gameplay.intro, "gameplay.intro", errors, 180);
    if (!Array.isArray(gameplay.steps) || gameplay.steps.length < 2 || gameplay.steps.length > 5) {
      errors.push("gameplay.steps must contain 2 to 5 steps");
    } else {
      const stepIds = new Set();
      gameplay.steps.forEach((step, index) => {
        const label = `gameplay.steps[${index}]`;
        if (!isObject(step)) {
          errors.push(`${label} must be an object`);
          return;
        }
        unknownKeys(step, STEP_KEYS, label, errors);
        if (!ID_PATTERN.test(step.id ?? "") || stepIds.has(step.id)) errors.push(`${label}.id must be unique kebab-case`);
        stepIds.add(step.id);
        requiredText(step.prompt, `${label}.prompt`, errors, 180);
        requiredText(step.observation, `${label}.observation`, errors, 240);
        requiredText(step.hint, `${label}.hint`, errors, 180);
        if (!Array.isArray(step.choices) || step.choices.length < 2 || step.choices.length > 4) {
          errors.push(`${label}.choices must contain 2 to 4 choices`);
          return;
        }
        const choiceIds = new Set();
        step.choices.forEach((choice, choiceIndex) => {
          const choiceLabel = `${label}.choices[${choiceIndex}]`;
          if (!isObject(choice)) {
            errors.push(`${choiceLabel} must be an object`);
            return;
          }
          unknownKeys(choice, CHOICE_KEYS, choiceLabel, errors);
          if (!ID_PATTERN.test(choice.id ?? "") || choiceIds.has(choice.id)) errors.push(`${choiceLabel}.id must be unique kebab-case`);
          choiceIds.add(choice.id);
          requiredText(choice.label, `${choiceLabel}.label`, errors, 60);
        });
        if (!choiceIds.has(step.correct_choice_id)) errors.push(`${label}.correct_choice_id must match one choice`);
      });
    }
    if (!isObject(gameplay.completion)) {
      errors.push("gameplay.completion must be an object");
    } else {
      unknownKeys(gameplay.completion, COMPLETION_KEYS, "gameplay.completion", errors);
      requiredText(gameplay.completion.title, "gameplay.completion.title", errors, 80);
      requiredText(gameplay.completion.summary, "gameplay.completion.summary", errors, 260);
    }
  }
  return errors;
}

function normalizedEntryMap(files) {
  const raw = [...files].map((file) => ({
    file,
    path: (file.webkitRelativePath || file.name || "").replace(/^\.\//, ""),
  }));
  const roots = raw.map(({ path }) => path.split("/")[0]);
  const commonRoot = roots.length && roots.every((root) => root === roots[0]) && raw.every(({ path }) => path.includes("/"))
    ? `${roots[0]}/`
    : "";
  return new Map(raw.map(({ file, path }) => [commonRoot ? path.slice(commonRoot.length) : path, file]));
}

async function sha256Hex(buffer) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export async function validateThemePackFiles(files) {
  const entries = normalizedEntryMap(files);
  const errors = [];
  if (!entries.has("manifest.json")) return { ok: false, errors: ["theme folder must contain manifest.json at its root"] };
  let manifest;
  try {
    manifest = JSON.parse(await entries.get("manifest.json").text());
  } catch {
    return { ok: false, errors: ["manifest.json is not valid JSON"] };
  }
  errors.push(...validateThemeManifest(manifest));
  if (errors.length) return { ok: false, errors };
  const allowedFiles = new Set(["manifest.json", manifest.assets.disk.path, manifest.assets.guide.path]);
  for (const path of entries.keys()) {
    if (!safeRelativePath(path)) errors.push(`unsafe file path: ${path}`);
    else if (!allowedFiles.has(path)) errors.push(`undeclared or executable file is forbidden: ${path}`);
  }
  for (const path of allowedFiles) {
    if (!entries.has(path)) errors.push(`required file is missing: ${path}`);
  }
  const totalBytes = [...entries.values()].reduce((sum, file) => sum + (file.size ?? 0), 0);
  if (totalBytes > MAX_PACK_BYTES) errors.push(`theme pack exceeds ${MAX_PACK_BYTES} bytes`);
  const assets = {};
  for (const role of ["disk", "guide"]) {
    const descriptor = manifest.assets[role];
    const file = entries.get(descriptor.path);
    if (!file) continue;
    if (file.size > MAX_ASSET_BYTES) {
      errors.push(`${descriptor.path} exceeds ${MAX_ASSET_BYTES} bytes`);
      continue;
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const dimensions = pngDimensions(bytes);
    if (!dimensions) errors.push(`${descriptor.path} is not a real PNG`);
    else if (dimensions.width !== descriptor.width || dimensions.height !== descriptor.height) {
      errors.push(`${descriptor.path} dimensions do not match manifest`);
    }
    const hash = await sha256Hex(buffer);
    if (hash !== descriptor.sha256) errors.push(`${descriptor.path} SHA-256 does not match manifest`);
    assets[role] = new Blob([buffer], { type: "image/png" });
  }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], manifest, assets };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function databaseRequest(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, mode);
    const store = transaction.objectStore(DB_STORE);
    const request = operation(store);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => database.close());
  }));
}

export async function saveThemePack(pack) {
  const record = {
    id: pack.manifest.pack_id,
    manifest: pack.manifest,
    assets: {
      disk: await pack.assets.disk.arrayBuffer(),
      guide: await pack.assets.guide.arrayBuffer(),
    },
    imported_at: new Date().toISOString(),
  };
  await databaseRequest("readwrite", (store) => store.put(record));
  localStorage.setItem(ACTIVE_PACK_KEY, record.id);
  return { ...record, assets: pack.assets };
}

export async function loadActiveThemePack() {
  const id = localStorage.getItem(ACTIVE_PACK_KEY);
  if (!id) return null;
  const record = await databaseRequest("readonly", (store) => store.get(id));
  if (!record) localStorage.removeItem(ACTIVE_PACK_KEY);
  if (!record) return null;
  const disk = record.assets?.disk;
  const guide = record.assets?.guide;
  if (!(disk instanceof ArrayBuffer) || !(guide instanceof ArrayBuffer)) throw new Error("stored theme assets are invalid");
  return {
    ...record,
    assets: {
      disk: new Blob([disk], { type: "image/png" }),
      guide: new Blob([guide], { type: "image/png" }),
    },
  };
}

export function deactivateThemePack() {
  localStorage.removeItem(ACTIVE_PACK_KEY);
}

export function progressKey(packId) {
  return `${PROGRESS_PREFIX}${packId}`;
}

export function readThemeProgress(packId, stepCount) {
  try {
    const value = JSON.parse(localStorage.getItem(progressKey(packId)) ?? "null");
    if (!value || !Number.isInteger(value.step) || value.step < 0 || value.step >= stepCount) return { step: 0, completed: false };
    return { step: value.step, completed: Boolean(value.completed) };
  } catch {
    return { step: 0, completed: false };
  }
}

export function writeThemeProgress(packId, value) {
  localStorage.setItem(progressKey(packId), JSON.stringify({ step: value.step, completed: Boolean(value.completed) }));
}

export function clearThemeProgress(packId) {
  localStorage.removeItem(progressKey(packId));
}

export const THEME_PACK_LIMITS = Object.freeze({
  schemaVersion: PACK_SCHEMA_VERSION,
  maxPackBytes: MAX_PACK_BYTES,
  maxAssetBytes: MAX_ASSET_BYTES,
});
