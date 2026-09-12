const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const master = JSON.parse(fs.readFileSync('master.json', 'utf8'));

test('槍弾正は選択可能なA戦法', () => {
  const tactic = master.tactics.find((item) => item.name === '槍弾正');
  assert.ok(tactic);
  assert.equal(tactic.rarity, 'A');
  assert.equal(tactic.learnable, true);
});
