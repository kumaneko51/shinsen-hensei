const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('スマホでは左メニューを画面上に開閉できる', () => {
  assert.match(html, /\.side\.open\s*\{\s*transform:translateX\(0\)/);
  assert.match(html, /data-mobile-menu="open"/);
  assert.match(html, /data-mobile-menu="close"/);
  assert.match(html, /mobile-nav-backdrop/);
  assert.match(html, /mobileNavOpen:\s*false/);
});

test('ページを選ぶとスマホメニューが閉じる', () => {
  assert.match(html, /function changeRoute_\(route\)[\s\S]*?state\.route = route;[\s\S]*?state\.mobileNavOpen = false;/);
  assert.match(html, /href="#\/lineups" data-route="lineups"/);
});

test('スマホ幅では編成画面とカード一覧を一列中心に整える', () => {
  assert.match(html, /@media\(max-width:720px\)/);
  assert.match(html, /\.library\.tactics-pane \.cards\s*\{\s*grid-template-columns:1fr/);
  assert.match(html, /\.page-grid\s*\{\s*grid-template-columns:1fr/);
  assert.match(html, /\.tools \.search\s*\{\s*flex-basis:100%/);
});
