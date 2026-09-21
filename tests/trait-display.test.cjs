const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

test('能力値は6項目をコンパクトな一段で表示する', () => {
  assert.match(html, /\.stats \{[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});

test('特性は突破数に応じて解放表示が変わる', () => {
  assert.match(html, /const unlocked = index <= member\.breakthrough/);
  assert.match(html, /index \+ '凸で解放'/);
  assert.match(html, /trait-chip[\s\S]*locked/);
});

test('特性名のフォーカスとマウス操作で説明を表示する', () => {
  assert.match(html, /class="trait-tip"/);
  assert.match(html, /trait-chip:hover \.trait-tip/);
  assert.match(html, /trait-chip:focus \.trait-tip/);
});
