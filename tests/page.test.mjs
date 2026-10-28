import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('homepage provides real local destinations and accessible interaction hooks', () => {
  assert.ok(existsSync('index.html'), 'homepage exists');
  const html = readFileSync('index.html', 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'IDs are unique');
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(target), `anchor #${target} resolves`);
  }
  for (const id of ['main', 'models', 'how-it-works', 'pricing', 'developers', 'get-started', 'mobile-toggle', 'site-nav', 'chat-panel', 'api-panel', 'copy-code', 'copy-status']) {
    assert.ok(ids.includes(id), `${id} is present`);
  }
  assert.match(html, /aria-controls="site-nav"/);
  assert.match(html, /role="status"/);
  assert.match(html, /Illustrative request/);
  assert.doesNotMatch(html, /href="#"/);
});

test('static HTML exposes both explanations without enabling JavaScript-only controls', () => {
  const html = readFileSync('index.html', 'utf8');
  const apiTag = html.match(/<div\b[^>]*id="api-panel"[^>]*>/)?.[0];
  assert.ok(apiTag);
  assert.doesNotMatch(apiTag, /\bhidden\b/);
  const controls = [...html.matchAll(/<button\b[^>]*(?:data-mode=|id="copy-code")[^>]*>/g)];
  assert.equal(controls.length, 3);
  for (const [tag] of controls) assert.match(tag, /\bdisabled\b/);
});
