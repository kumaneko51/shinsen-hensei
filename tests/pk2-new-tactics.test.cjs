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

test('戦法庫には習得可能な戦法だけを表示する', () => {
  const availableSource = html.match(/function learnableTactics_\(\) \{[\s\S]*?\n    \}/)?.[0];
  const filterSource = html.match(/function filteredTactics_\(\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(availableSource && filterSource);
  const state = { query: '', faction: '', rarity: '', ownedOnly: false, mode: 'lineup', inventory: { tacticIds: [] } };
  const context = { state, tactics_: () => master.tactics };
  const source = availableSource + '\n' + filterSource + '\nfilteredTactics_()';
  const listed = vm.runInNewContext(source, context);
  assert.ok(listed.length > 0);
  assert.ok(listed.every((tactic) => tactic.learnable));
  state.query = '懐刀の謀臣';
  assert.equal(vm.runInNewContext(source, context).length, 0);
  state.query = '百術千慮';
  assert.equal(vm.runInNewContext(source, context)[0].name, '百術千慮');
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
