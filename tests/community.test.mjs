import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const visitors = await readFile(new URL("../visitors.html", import.meta.url), "utf8");
const hall = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../works.js", import.meta.url), "utf8");
const feed = JSON.parse(await readFile(new URL("../data/community-feed.json", import.meta.url), "utf8"));

test("feed seed is a valid zero-backend social timeline", () => {
  assert.equal(feed.schema_version, "wuli-community-feed-1");
  assert.ok(Array.isArray(feed.posts) && feed.posts.length > 0);
  for (const post of feed.posts) {
    assert.equal(typeof post.id, "string");
    assert.equal(typeof post.title, "string");
    assert.equal(typeof post.summary, "string");
    if (post.download) assert.match(post.download, /\.zip$/);
    for (const comment of post.comments || []) {
      assert.ok(!/https?:\/\//.test(comment.text), "seed comment must not contain URLs");
    }
  }
});

test("Newton works stay below the scientist module and outside the visitor room", () => {
  assert.match(hall, /id="works"/);
  assert.match(hall, /data-works-scope="scientist"/);
  assert.ok(hall.indexOf('id="stage"') < hall.indexOf('id="works"'));
  assert.ok(hall.indexOf('id="works"') < hall.indexOf('id="relics"'));
  assert.doesNotMatch(visitors, /id="worksList"|src="\.\/works\.js|src="\.\/experience-player\.js/);
  assert.match(visitors, /id="community"/);
  assert.doesNotMatch(hall, /class="feed-page"/);
});

test("works wall renders user input as text only and strips URLs", () => {
  assert.match(script, /el\("p", "works-note-text", item\.text\)/);
  assert.match(script, /https\?:\\\/\\\/\\S\+/);
  assert.match(script, /slice\(0, MAX_TEXT\)/);
  assert.match(script, /MAX_TEXT = 140/);
  const bad = [...script.matchAll(/\.innerHTML\s*=/g)];
  for (const use of bad) {
    const line = script.slice(0, use.index).split("\n").length;
    assert.fail(`innerHTML not allowed in feed, line ${line}`);
  }
});

test("works two-layer likes and comments persist locally", () => {
  assert.match(script, /qo-feed-likes/);
  assert.match(script, /qo-feed-comments/);
  assert.match(script, /likeCount/);
  assert.match(script, /commentCount/);
});

test("works provides real download and play actions", () => {
  assert.match(script, /dl\.download = ""/);
  assert.match(script, /试玩/);
  assert.ok(feed.posts.every((post) => post.play), "only completed playable works are listed");
  assert.match(feed.posts.find((post) => post.id === "newton-gravity").play, /\?module=newton-gravity/);
  assert.match(feed.posts.find((post) => post.id === "apple-beyond").play, /experiences\/apple-beyond\/index\.html/);
});
