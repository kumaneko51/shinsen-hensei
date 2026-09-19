const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');

test('兵学は4系統の奇と正を収録している', () => {
  for (const group of ['武略', '陣立', '機略', '臨戦']) {
    assert.match(html, new RegExp(`'${group}': \\{ qi: \\[`));
  }
  for (const choice of ['表裏一体', '先陣誘導', '臨機応変', '手当の心得', '剛力', '慧眼', '神算', '果敢']) {
    assert.match(html, new RegExp(`'${choice}'`));
  }
});

test('古い編成データには空の兵学を補い、不正な組み合わせを除去する', () => {
  const constants = html.match(/const HEIGAKU = Object\.freeze\([\s\S]*?\n    \}\);/)[0];
  const helper = html.match(/function normalizeHeigaku_\(value\) \{[\s\S]*?\n    \}/)[0];
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${constants}\n${helper}`, context);

  assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext('normalizeHeigaku_()', context))),
    { group: '', qi: '', sei: ['', ''] }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext("normalizeHeigaku_({group:'武略',qi:'表裏一体',sei:['剛力','神算']})", context))),
    { group: '武略', qi: '表裏一体', sei: ['剛力', ''] }
  );
});

test('兵学選択は武将カード、モーダル、保存処理に接続されている', () => {
  assert.match(html, /data-heigaku-modal=/);
  assert.match(html, /state\.modal = 'heigaku:'/);
  assert.match(html, /function heigakuModal_\(role\)/);
  assert.match(html, /function changeHeigakuGroup_\(role, group\)/);
  assert.match(html, /function changeHeigakuChoice_\(role, slot, name\)/);
  assert.match(html, /member\.heigaku = value;\s+persist_\(\);/);
});
