import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../community.html", import.meta.url), "utf8");
const script = await readFile(new URL("../community.js", import.meta.url), "utf8");
const feed = JSON.parse(await readFile(new URL("../data/community-feed.json", import.meta.url), "utf8"));

test("feed seed is a valid zero-backend social timeline", () => {
  assert.equal(feed.schema_version, "wuli-community-feed-1");
  assert.ok(Array.isArray(feed.posts) && feed.posts.length > 0);
  for (const post of feed.posts) {
    assert.equal(typeof post.id, "string");
    assert.equal(typeof post.title, "string");
    assert.equal(typeof post.summary, "string");
    if (post.download) assert.match(post.download, /\.zip$/);
    for (const c of post.comments || []) {
      assert.ok(!/https?:\/\//.test(c.text), "seed comment must not contain URLs");
    }
  }
});

test("community page is a single-column feed", () => {
  assert.match(html, /id="feed"/);
  assert.match(html, /class="feed-page"/);
});

test("feed renders user input as text only and strips URLs", () => {
  assert.match(script, /el\("p", "feed-comment-text", c\.text\)/);
  assert.match(script, /https\?:\\\/\\\/\\S\+/);
  assert.match(script, /slice\(0, MAX_TEXT\)/);
  assert.match(script, /MAX_TEXT = 140/);
  const bad = [...script.matchAll(/\.innerHTML\s*=/g)];
  for (const use of bad) {
    const line = script.slice(0, use.index).split("\n").length;
    assert.fail(`innerHTML not allowed in feed, line ${line}`);
  }
});

test("feed two-layer likes and comments persist locally", () => {
  assert.match(script, /qo-feed-likes/);
  assert.match(script, /qo-feed-comments/);
  assert.match(script, /likeCount/);
  assert.match(script, /commentCount/);
});

test("feed provides real download and play actions", () => {
  assert.match(script, /feed-download/);
  assert.match(script, /dl\.download = ""/);
  assert.match(script, /feed-play/);
  assert.match(script, /feed-disabled/);
});
