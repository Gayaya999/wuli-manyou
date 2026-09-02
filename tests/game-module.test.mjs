import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { validateGameModule } from "../game-module.mjs";
import { filesFromZip } from "../zip-reader.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.File) globalThis.File = File;

const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
const encoder = new TextEncoder();
const hash = async (value) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", value))].map((x) => x.toString(16).padStart(2, "0")).join("");
const asFile = (value, path, root = "demo-module") => {
  const file = new File([value], path.split("/").pop());
  Object.defineProperty(file, "webkitRelativePath", { value: `${root}/${path}` });
  return file;
};

async function exampleFiles() {
  const diskHash = await hash(png), guideHash = await hash(png), assetBytes = encoder.encode("asset"), assetHash = await hash(assetBytes);
  const module = {
    schema_version: "wuli-science-module-2", module_id: "demo-module", version: "2.0.0",
    presentation: { title: "示例科学家", scientist_name: "示例", domain: "示例领域", summary: "操作一个示例实验", placeholder: "示例问题", disk_alt: "软盘", guide_alt: "引导" },
    assets: { disk: { path: "assets/disk.png", mime: "image/png", sha256: diskHash, width: 1, height: 1 }, guide: { path: "assets/guide.png", mime: "image/png", sha256: guideHash, width: 1, height: 1 } },
    game: { format: "pixel-science-content-pack-2", runtime: { name: "pixel-science-browser", version: "2.x" }, root: "game-pack" },
    release: { policy: "pixel-science-release-2", status: "approved-for-public-release", pack_id: "demo-module" },
  };
  const packManifest = {
    schema_version: "2.0.0", pack_id: "demo-module",
    asset_contract: { brand_profile: "pixel-science-theater-v2", sprite_frames: 26, logical_background_size: [480, 270] },
    assets: [{ asset_id: "demo-image", path: "assets/a.txt", sha256: assetHash }],
  };
  const animation = (frames, loop) => ({ frames, loop });
  const visuals = {
    character: { base_animation_contract: { animations: { idle: animation(4, true), talk: animation(4, false), point: animation(4, false), think: animation(4, false), surprise: animation(4, false), celebrate: animation(6, false) } } },
    motion_contract: { camera_shake_max_px: 2, camera_shake_max_ms: 120, screen_flash_max_ms: 100, screen_flash_max_alpha: .12, particle_max: 16, failure_feedback_cooldown_ms: 600, reduced_motion_disables: ["camera-shake", "screen-flash", "nonessential-particles", "large-ambient-loops"] },
  };
  const sources = { sources: [{ source_id: "S1" }], claims: [{ claim_id: "F1", source_ids: ["S1"] }] };
  const licenses = { approval_state: "FINAL_PACK_APPROVED", licenses: [{ license_id: "L1", evidence_path: "assets/license.txt", public_release_allowed: true }] };
  const report = { status: "final-pack-approved", required_current_approval: "FINAL_PACK_APPROVED", review: { p0: 0, p1: 0 }, tests: ["host-runtime-full-playthrough: chromium"] };
  const files = [
    asFile(JSON.stringify(module), "module.json"), asFile(png, "assets/disk.png"), asFile(png, "assets/guide.png"),
    asFile(JSON.stringify(packManifest), "game-pack/manifest.json"), asFile(assetBytes, "game-pack/assets/a.txt"), asFile("license", "game-pack/assets/license.txt"),
  ];
  const records = { scientist: {}, concept: {}, experience: {}, models: {}, visuals, sources, licenses };
  for (const [name, record] of Object.entries(records)) files.push(asFile(JSON.stringify(record), `game-pack/${name}.json`));
  files.push(asFile(JSON.stringify(report), "game-pack/qa/release-report.json"));
  return files;
}

test("v2 module accepts only a fully approved, declared data pack", async () => {
  const result = await validateGameModule(await exampleFiles());
  assert.equal(result.ok, true, result.errors?.join("\n"));
});

test("v1 module is rejected with an upgrade instruction", async () => {
  const files = await exampleFiles();
  const manifest = JSON.parse(await files[0].text()); manifest.schema_version = "wuli-science-module-1";
  files[0] = asFile(JSON.stringify(manifest), "module.json");
  const result = await validateGameModule(files);
  assert.equal(result.ok, false); assert.match(result.errors.join("\n"), /旧版作品包/);
});

test("unapproved and executable uploads are rejected", async () => {
  const files = await exampleFiles();
  files.push(asFile("alert(1)", "game-pack/run.js"));
  const result = await validateGameModule(files);
  assert.equal(result.ok, false); assert.match(result.errors.join("\n"), /不允许的代码文件|未在清单声明/);
});

function u16(value) { const buffer = Buffer.alloc(2); buffer.writeUInt16LE(value); return buffer; }
function u32(value) { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(value >>> 0); return buffer; }
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function storedZip(records) {
  const local = [], central = []; let offset = 0;
  for (const [path, value] of records) {
    const name = Buffer.from(path), data = Buffer.from(value), checksum = crc32(data);
    const header = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), name]);
    local.push(header, data);
    central.push(Buffer.concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(checksum),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));
    offset += header.length + data.length;
  }
  const directory = Buffer.concat(central);
  return Buffer.concat([...local, directory, u32(0x06054b50),u16(0),u16(0),u16(records.length),u16(records.length),u32(directory.length),u32(offset),u16(0)]);
}

test("ZIP reader accepts stored files and blocks path traversal", async () => {
  const good = new File([storedZip([["demo/module.json", "{}"]])], "demo.zip");
  const files = await filesFromZip(good); assert.equal(files[0].webkitRelativePath, "demo/module.json");
  const bad = new File([storedZip([["../escape.json", "{}"]])], "bad.zip");
  await assert.rejects(filesFromZip(bad), /不安全路径/);
});

test("hall exposes ZIP first, folder advanced, lazy loading and strict isolation", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../script.js", import.meta.url), "utf8");
  assert.match(html, /id="gameModuleInput"[^>]*accept="\.zip/);
  assert.match(html, /id="gameModuleFolderInput"[^>]*webkitdirectory/);
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin/);
  assert.match(script, /filesFromZip/);
  assert.match(script, /loadPublishedModule/);
  assert.doesNotMatch(script, /eval\(|new Function\(/);
});
