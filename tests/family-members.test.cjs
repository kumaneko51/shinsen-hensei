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
  assert.match(html, /publicDisplayName_\(member\.display_name\)/);
  assert.match(html, /member\.role === 'owner' \? '一門長' : '一門員'/);
  assert.match(html, /member\.user_id === state\.cloudUser\.id/);
  assert.match(html, /role, joined_at/);
});

test('自分の公開表示名を変更でき、メールアドレスは表示しない', () => {
  assert.match(html, /data-action="display-name-change"/);
  assert.match(html, /async function changeDisplayName_/);
  assert.match(html, /rpc\('update_my_display_name'/);
  assert.match(html, /!name \|\| name\.includes\('@'\) \? '名前未設定'/);
});
