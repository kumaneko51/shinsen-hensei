const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const master = JSON.parse(fs.readFileSync('master.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');

test('習得可能と説明された戦法はすべて選択可能', () => {
  const inconsistent = master.tactics.filter((tactic) =>
    /習得可能な戦法/.test(tactic.summary || '') && !tactic.learnable
  );
  assert.deepEqual(inconsistent, []);
});

test('固有武将のない戦法はすべて選択可能', () => {
  const inaccessible = master.tactics.filter((tactic) => !tactic.uniqueHero && !tactic.learnable);
  assert.deepEqual(inaccessible, []);
});

test('今回検出した伝授戦法の表記ゆれは選択可能な戦法名へ統一', () => {
  const selectableNames = new Set(master.tactics.filter((tactic) => tactic.learnable).map((tactic) => tactic.name));
  const correctedNames = new Set([
    '縦横馳突', '知者楽水', '瞬息万変', '気勢衝天', '前後挟撃', '乗勝追撃',
    '百戦錬磨', '薩摩鉄砲兵', '奇策縦横', '鉄砲僧兵', '荷駄崩し', '鉄砲猛撃', '援護射撃'
  ]);
  const usedNames = new Set(master.heroes.map((hero) => hero.teachableSkill).filter(Boolean));
  const missing = [...correctedNames].filter((name) => !usedNames.has(name) || !selectableNames.has(name));
  assert.deepEqual(missing, []);
});

test('存在する選択可能な戦法種別をフィルターから選べる', () => {
  const types = new Set(master.tactics.filter((tactic) => tactic.learnable).map((tactic) => tactic.type));
  for (const type of types) {
    assert.match(html, new RegExp(`option value="${type}"`), `${type}フィルターが存在すること`);
  }
});
