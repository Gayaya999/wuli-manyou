import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../visitors.html", import.meta.url), "utf8");
const hall = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../visitors.css", import.meta.url), "utf8");
const composer = await readFile(new URL("../disk-compose.js", import.meta.url), "utf8");
const script = await readFile(new URL("../visitors.js", import.meta.url), "utf8");

test("visitor archive is a separate room linked from the hall", () => {
  assert.match(hall, /href="\.\/visitors\.html"/);
  assert.doesNotMatch(hall, /href="\.\/community\.html"/);
  assert.match(html, /来访者档案/);
  assert.match(html, /href="\.\/"/);
  assert.match(html, /id="cabinet"/);
  assert.match(html, /id="bench"/);
  assert.match(html, /存放一张档案/);
  assert.match(html, /放入展墙/);
  assert.match(html, /取回/);
  assert.match(html, /id="community"/);
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
