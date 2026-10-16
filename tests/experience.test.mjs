import { worksForScientist } from "../work-catalog.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);

test('bundled film retains all original assets, scripts, music and fonts', async () => {
  const base = new URL('experiences/apple-beyond/', root);
  const files = JSON.parse(await readFile(new URL('FILES.sha256.json', base), 'utf8'));
  assert.ok(files['scripts/audio.js']);
  assert.ok(files['assets/audio/music-data.js']);
  assert.ok(files['assets/fonts/OFL-WenKai.txt']);
  for (const [file, expected] of Object.entries(files)) {
    const bytes = await readFile(new URL(file, base));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
  }
});

test('every published experience and download resolves to a real bundled file', async () => {
  const feed = JSON.parse(await readFile(new URL('data/community-feed.json', root), 'utf8'));
  for (const post of feed.posts) {
    for (const relative of [post.cover, post.download, ...(post.stills || []).map(s => s.src)]) {
      if (relative) assert.ok((await stat(new URL(relative, root))).isFile(), relative);
    }
    if (post.kind === 'film') assert.ok((await stat(new URL(post.play, root))).isFile());
  }
});

test('Newton film and pixel game never leak into another scientist module', async () => {
  const { posts } = JSON.parse(await readFile(new URL('data/community-feed.json', root), 'utf8'));
  assert.deepEqual(worksForScientist(posts, 'newton').map(p => p.id), ['apple-beyond', 'newton-gravity']);
  for (const scientist of ['einstein', 'dirac', 'feynman', 'yang', 'bohr', 'debroglie', 'schrodinger', 'maxwell']) {
    assert.deepEqual(worksForScientist(posts, scientist), [], scientist);
  }
  assert.deepEqual(worksForScientist(posts, null), []);
});

test('future scientist-owned works remain isolated and unassigned posts stay hidden', () => {
  const posts = [{ id: 'newton', scientist_id: 'newton', play: '/n' }, { id: 'einstein', scientist_id: 'einstein', play: '/e' }, { id: 'unassigned', play: '/x' }];
  assert.deepEqual(worksForScientist(posts, 'einstein').map(p => p.id), ['einstein']);
});
