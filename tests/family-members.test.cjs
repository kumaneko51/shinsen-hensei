const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const familyUi = fs.readFileSync(path.join(__dirname, '..', 'land-reports.js'), 'utf8');

test('一門画面から参加メンバー一覧を開ける', () => {
  assert.match(familyUi, /data-family-section="members"/);
  assert.match(html, /参加メンバー（' \+ state\.familyMembers\.length \+ '人）/);
});

test('メンバー名、役割、参加日と自分の印を表示する', () => {
  assert.match(html, /member\.display_name \|\| '名前未設定'/);
  assert.match(html, /member\.role === 'owner' \? '一門長' : '一門員'/);
  assert.match(html, /member\.user_id === state\.cloudUser\.id/);
  assert.match(html, /role, joined_at/);
});
