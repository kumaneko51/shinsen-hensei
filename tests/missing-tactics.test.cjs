const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const master = JSON.parse(fs.readFileSync('master.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');

test('requested tactics are searchable and selectable in the tactic library', () => {
  const expected = [
    ['三河武士', '兵種', 'S'],
    ['威風凛々', '突撃', 'S'],
    ['大器の萌芽', '指揮', 'A']
  ];
  for (const [name, type, rarity] of expected) {
    const tactic = master.tactics.find((item) => item.name === name);
    assert.ok(tactic, `${name}が存在すること`);
    assert.equal(tactic.type, type);
    assert.equal(tactic.rarity, rarity);
    assert.equal(tactic.learnable, true, `${name}が選択可能であること`);
  }
});

test('威風凛々の異体字を外部取込で同一視する', () => {
  assert.match(html, /replace\(\/凜\/g, '凛'\)/);
  assert.ok(!master.tactics.some((item) => item.name.includes('凜')));
});
