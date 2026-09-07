import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

test("hall exposes an Apple-style light appearance", () => {
  assert.match(html, /class="appearance"/);
  assert.match(html, /data-theme="light"/);
  assert.match(html, /localStorage\.getItem\("qo-alt-theme"\)/);
  assert.match(css, /html\[data-theme="light"\]\s*\{/);
  assert.match(css, /--bg:\s*#f4f1ec/);
  assert.match(css, /url\("\.\/assets\/bg\/pixel-sky\.jpg/);
  assert.match(script, /THEME_KEY = "qo-alt-theme"/);
});

test("Press start enters the game and the Macintosh opens talk", () => {
  assert.match(html, /id="pressStart"/);
  assert.match(html, /Press start/);
  assert.match(html, /id="openTalk"/);
  assert.match(html, /id="talkRoom"/);
  assert.match(script, /pressStart\?\.addEventListener\("click", openPortal\)/);
  assert.match(script, /enterGame.addEventListener\("click", openTalkRoom\)/);
  assert.doesNotMatch(script, /enterGame.addEventListener\("click", openPortal\)/);
  assert.doesNotMatch(html, /id="ask-input"/);
  assert.doesNotMatch(html, /id="askChip"/);
});

test("hall Macintosh uses the exhibition CRT and biography", () => {
  assert.match(html, /class="dossier"/);
  assert.match(html, /assets\/hardware\/macintosh\.png/);
  assert.match(html, /id="scientistBio"/);
  assert.match(html, /id="dungeonZh"/);
  assert.match(html, /坠落之月/);
  assert.match(css, /\.mac-screen\s*\{/);
  assert.match(script, /function openPortal\(/);
  assert.match(script, /function openTalkRoom\(/);
});

test("hall nav has no separate community page", () => {
  assert.match(html, /href="\.\/visitors\.html">来访者/);
  assert.match(html, /href="\.\/me\.html">我的/);
  assert.doesNotMatch(html, /href="\.\/community\.html"/);
  assert.doesNotMatch(html, />社区</);
});

test("published games still launch from Press start", () => {
  assert.match(script, /function loadPublishedModules\(/);
  assert.match(script, /function openGameModule\(/);
  assert.match(script, /gameModules\.has\(currentId\)/);
  assert.match(script, /点击上方 Press start/);
  assert.match(html, /id="moduleGame"/);
  assert.match(html, /id="themeGame"/);
  assert.match(html, /id="gameModuleImport"/);
});

test("chat posts to the local agent and never embeds secrets", () => {
  assert.match(html, /data-scientist-agent-api="\/api"/);
  assert.match(script, /scientistAgentApiRoot/);
  assert.doesNotMatch(script, /sk-ws-|DASHSCOPE|dashscope|aliyuncs/i);
  assert.doesNotMatch(html, /sk-ws-|aliyuncs/i);
});
