#!/usr/bin/env node
import { webcrypto } from "node:crypto";
import { File } from "node:buffer";
import { cp, lstat, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { validateGameModule } from "../game-module.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const [sourceArg] = process.argv.slice(2);
if (!sourceArg) throw new Error("用法：node tools/publish-game-module.mjs <新版完整小游戏模块文件夹>");
const source = resolve(sourceArg), destinationRoot = resolve("published-modules");

async function exists(target) { try { await stat(target); return true; } catch { return false; } }
async function filesIn(root, directory = root) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, item.name);
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error(`不允许符号链接：${relative(root, full)}`);
    if (item.isDirectory()) result.push(...await filesIn(root, full));
    else if (item.isFile()) result.push(relative(root, full).replaceAll("\\", "/"));
  }
  return result.sort();
}

const paths = await filesIn(source);
const files = await Promise.all(paths.map(async (path) => {
  const file = new File([await readFile(join(source, path))], basename(path));
  Object.defineProperty(file, "webkitRelativePath", { value: `${basename(source)}/${path}` });
  return file;
}));
const validation = await validateGameModule(files);
if (!validation.ok) throw new Error(`作品未通过发布门禁：${validation.errors.slice(0, 6).join("；")}`);
const manifest = validation.manifest;
const id = manifest.module_id;
await mkdir(destinationRoot, { recursive: true });
const staging = join(destinationRoot, `.staging-${id}-${process.pid}`);
if (await exists(staging)) throw new Error(`暂存目录已存在：${staging}`);
await cp(source, staging, { recursive: true, errorOnExist: true });

const destination = join(destinationRoot, id);
if (await exists(destination)) {
  const current = JSON.parse(await readFile(join(destination, "module.json"), "utf8"));
  if (current.module_id !== id) throw new Error("现有作品 ID 异常，拒绝覆盖");
  const history = join(destinationRoot, ".history", id, `${current.version}-${new Date().toISOString().replaceAll(":", "-")}`);
  await mkdir(join(destinationRoot, ".history", id), { recursive: true });
  await rename(destination, history);
  console.log(`previous-version-archived=${history}`);
}
await rename(staging, destination);

const indexPath = join(destinationRoot, "index.json");
let index = { schema_version: "wuli-published-modules-2", modules: [] };
try { index = JSON.parse(await readFile(indexPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
index.schema_version = "wuli-published-modules-2";
const record = {
  module_id: id,
  version: manifest.version,
  title: manifest.presentation.title,
  scientist_name: manifest.presentation.scientist_name,
  disk_path: manifest.assets.disk.path,
  files: paths,
};
index.modules = [...(index.modules || []).filter((item) => item.module_id !== id), record].sort((a, b) => a.module_id.localeCompare(b.module_id));
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`published-module=${id} version=${manifest.version} files=${paths.length}`);
