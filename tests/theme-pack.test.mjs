import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import {
  validateThemeManifest,
  validateThemePackFiles,
} from "../theme-pack.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = resolve(new URL("../theme-packs/examples/einstein-photoelectric/", import.meta.url).pathname);
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));

async function fileAt(path) {
  const file = new File([await readFile(path)], basename(path));
  Object.defineProperty(file, "webkitRelativePath", {
    value: `einstein-photoelectric/${relative(root, path).replaceAll("\\", "/")}`,
  });
  return file;
}

async function exampleFiles() {
  return Promise.all([
    fileAt(`${root}/manifest.json`),
    fileAt(`${root}/assets/disk.png`),
    fileAt(`${root}/assets/guide.png`),
  ]);
}

test("example theme pack passes strict content and asset validation", async () => {
  assert.deepEqual(validateThemeManifest(manifest), []);
  const result = await validateThemePackFiles(await exampleFiles());
  assert.equal(result.ok, true, result.errors?.join("\n"));
  assert.equal(result.manifest.gameplay.steps.length, 3);
});

test("theme packs reject executable or undeclared files", async () => {
  const files = await exampleFiles();
  const rogue = new File(["alert(1)"], "run.js", { type: "text/javascript" });
  Object.defineProperty(rogue, "webkitRelativePath", { value: "einstein-photoelectric/run.js" });
  const result = await validateThemePackFiles([...files, rogue]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /undeclared or executable file is forbidden/);
});

test("theme packs reject asset hash drift", async () => {
  const files = await exampleFiles();
  const changed = new File([await files[1].arrayBuffer(), new Uint8Array([0])], "disk.png", { type: "image/png" });
  Object.defineProperty(changed, "webkitRelativePath", { value: "einstein-photoelectric/assets/disk.png" });
  const result = await validateThemePackFiles([files[0], changed, files[2]]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SHA-256 does not match/);
});

test("theme pack text cannot inject markup", () => {
  const changed = structuredClone(manifest);
  changed.presentation.title = "<img src=x onerror=alert(1)>";
  assert.match(validateThemeManifest(changed).join("\n"), /forbidden markup/);
});

test("theme packs require science sources, license status, and safe asset paths", () => {
  const changed = structuredClone(manifest);
  changed.sources = [];
  changed.usage.license_status = "unknown";
  changed.assets.guide.path = "../guide.png";
  const errors = validateThemeManifest(changed).join("\n");
  assert.match(errors, /sources must contain/);
  assert.match(errors, /license_status/);
  assert.match(errors, /safe PNG path/);
});

test("hall exposes import, reset, and isolated theme game controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
  assert.match(html, /id="themePackInput"[^>]*webkitdirectory/);
  assert.match(html, /id="themeGame"/);
  assert.match(script, /validateThemePackFiles/);
  assert.match(script, /loadActiveThemePack/);
  assert.match(script, /readThemeProgress/);
  assert.match(script, /openPortal\(\)/);
  assert.doesNotMatch(script, /eval\(|new Function\(/);
});
