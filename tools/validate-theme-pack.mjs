#!/usr/bin/env node
import { webcrypto } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { File } from "node:buffer";
import { validateThemePackFiles } from "../theme-pack.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("usage: node tools/validate-theme-pack.mjs <theme-pack-folder>");
  process.exit(2);
}

async function collect(directory) {
  const result = [];
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`symbolic links are forbidden: ${path}`);
    if (info.isDirectory()) result.push(...await collect(path));
    else if (info.isFile()) result.push(path);
    else throw new Error(`unsupported filesystem entry: ${path}`);
  }
  return result;
}

const paths = await collect(root);
const files = await Promise.all(paths.map(async (path) => {
  const file = new File([await readFile(path)], basename(path));
  Object.defineProperty(file, "webkitRelativePath", { value: `${basename(root)}/${relative(root, path).replaceAll("\\", "/")}` });
  return file;
}));
const result = await validateThemePackFiles(files);
if (!result.ok) {
  result.errors.forEach((error) => console.error(`theme-pack-error: ${error}`));
  process.exit(1);
}
console.log(`theme-pack-valid id=${result.manifest.pack_id} target=${result.manifest.target_scientist_id} steps=${result.manifest.gameplay.steps.length}`);
