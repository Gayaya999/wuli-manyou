import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../visitors.html", import.meta.url), "utf8");
const hall = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../visitors.css", import.meta.url), "utf8");
const composer = await readFile(new URL("../disk-compose.js", import.meta.url), "utf8");
const script = await readFile(new URL("../visitors.js", import.meta.url), "utf8");

test("old visitor room now forwards to the community", () => {
  assert.match(hall, /href="\.\/community\.html"/);
  assert.doesNotMatch(hall, /href="\.\/visitors\.html"/);
  assert.match(html, /location\.replace\("\.\/community\.html"\)/);
});

test("visitor disks are composited locally and stored on this machine", () => {
  assert.match(script, /STORAGE_KEY = "qo-visitor-disks"/);
  assert.match(composer, /function composeDisk\(/);
  assert.match(composer, /function pixelate\(/);
  assert.match(script, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(script, /MAX_OWNED = 8/);
  assert.match(script, /const ARCHIVE_DISKS = \[/);
  assert.match(css, /\.cabinet/);
  assert.match(css, /\.slot\.is-arriving/);
  assert.doesNotMatch(script, /sk-ws-|DASHSCOPE|aliyuncs/i);
});
