import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const script = await readFile(new URL("../script.js", import.meta.url), "utf8");

test("alt page exposes an Apple-style light appearance", () => {
  assert.match(html, /class="appearance"/);
  assert.match(html, /data-theme="light"/);
  assert.match(html, /localStorage\.getItem\("qo-alt-theme"\)/);
  assert.match(css, /html\[data-theme="light"\]\s*\{/);
  assert.match(css, /--bg:\s*#e7f1fa/);
  assert.match(css, /url\("assets\/bg\/pixel-sky\.jpg"\)/);
  assert.match(css, /--ink:\s*#1d1d1f/);
  assert.match(css, /--muted:\s*#6e6e73/);
  assert.match(script, /THEME_KEY = "qo-alt-theme"/);
  assert.match(script, /function applyTheme\(/);
});

test("alt scientist conversations are isolated per figure", () => {
  assert.match(script, /const conversations = new Map\(\)/);
  assert.match(script, /function conversationFor\(/);
  assert.match(script, /function renderAskLog\(/);
  assert.match(script, /const scientistId = currentId/);
  assert.match(script, /\/api\/scientists\/\$\{scientistId\}\/chat/);
});

test("alt scientist chat posts to the local agent and never embeds secrets", () => {
  assert.match(html, /data-scientist-agent-api="\/api"/);
  assert.match(script, /scientistAgentApiRoot/);
  assert.doesNotMatch(script, /sk-ws-|DASHSCOPE|dashscope|aliyuncs/i);
  assert.doesNotMatch(html, /sk-ws-|aliyuncs/i);
});

test("alt question field supports speech input", () => {
  assert.match(html, /id="voiceInput"/);
  assert.match(html, /aria-label="语音输入"/);
  assert.match(css, /\.cta-mic/);
  assert.match(script, /SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(script, /recognition\.lang = "zh-CN"/);
});

test("alt hero title follows the selected scientist in Fusion Pixel", () => {
  assert.match(html, /id="heroTitle"/);
  assert.match(css, /font-family:\s*"Fusion Pixel 12"/);
  assert.match(css, /fusion-pixel-12px-proportional-zh_hans\.otf\.woff2/);
  assert.match(script, /heroTitle\.textContent = figure\.name/);
});

test("alt stage places a transparent Macintosh beside reserved copy", () => {
  assert.match(html, /class="terminal"/);
  assert.match(html, /class="mac"/);
  assert.match(html, /class="mac-screen"/);
  assert.match(html, /assets\/hardware\/pixel-computer\.png/);
  assert.match(html, /id="enterGame"/);
  assert.match(html, /id="stageNote"/);
  assert.match(html, /id="guideImage"/);
  assert.match(html, /assets\/guides\/newton\.png/);
  assert.doesNotMatch(html, /<video/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*22rem\)/);
  assert.match(css, /\.mac-screen\s*\{/);
  assert.match(script, /stageNote\.textContent = figure\.stageNote \?\? figure\.domain/);
  assert.match(script, /guideImage\.src = figure\.guide/);
  assert.match(script, /guide: "assets\/guides\/newton\.png"/);
  assert.match(script, /function openPortal\(/);
  assert.doesNotMatch(script, /playStage|stageVideo/);
});
