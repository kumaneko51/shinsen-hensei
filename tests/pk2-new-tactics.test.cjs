const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const master = JSON.parse(fs.readFileSync('master.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const newTactics = master.tactics.filter((tactic) => {
  const id = Number(tactic.id.slice('tactic-'.length));
  return id >= 248 && id <= 259;
});

test('固有戦法も戦法庫で検索でき、編成枠には装着できない', () => {
  const source = html.match(/function filteredTactics_\(\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(source);
  const state = { query: '懐刀の謀臣', faction: '', rarity: '', ownedOnly: false, mode: 'lineup', inventory: { tacticIds: [] } };
  const results = vm.runInNewContext(source + '\nfilteredTactics_()', { state, tactics_: () => master.tactics });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, '懐刀の謀臣');
  assert.equal(results[0].learnable, false);
  assert.match(html, /const unavailable = unique \|\| used/);
});

test('PK2の戦法12件が日本語で登録され、武将の固有・伝授名と一致する', () => {
  assert.equal(newTactics.length, 12);
  assert.equal(new Set(newTactics.map((tactic) => tactic.id)).size, 12);
  assert.equal(new Set(newTactics.map((tactic) => tactic.name)).size, 12);
  for (const tactic of newTactics) {
    assert.ok(tactic.summary && tactic.effect, `${tactic.name}の説明`);
    assert.doesNotMatch(tactic.summary + tactic.effect, /戰|軍群體|機率|謀略|發動|恢復|統率系|武勇系/, `${tactic.name}の日本語説明`);
  }
  for (const hero of master.heroes.filter((item) => Number(item.id.slice(5)) >= 162)) {
    const unique = newTactics.find((tactic) => tactic.name === hero.uniqueSkill);
    assert.ok(unique, `${hero.name}の固有戦法`);
    assert.equal(unique.uniqueHero, hero.name);
    assert.equal(unique.learnable, false);
    if (hero.teachableSkill) {
      assert.ok(newTactics.some((tactic) => tactic.name === hero.teachableSkill && tactic.learnable), `${hero.name}の伝授戦法`);
    }
    if (hero.assemblySkill) {
      assert.ok(newTactics.some((tactic) => tactic.name === hero.assemblySkill && tactic.learnable), `${hero.name}の評定衆戦法`);
    }
  }
  for (const name of ['三方挟撃', '以逸待労']) {
    assert.ok(newTactics.some((tactic) => tactic.name === name && tactic.learnable && tactic.tags.includes('事件戦法')));
  }
});
