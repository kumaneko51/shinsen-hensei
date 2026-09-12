const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const helper = html.match(/function isTacticUsed_\([\s\S]*?\n    }/);
assert.ok(helper, '戦法の全編成重複確認処理が存在すること');

test('別部隊にある同じ戦法を検出し、現在の枠だけは除外できる', () => {
  const context = vm.createContext({
    state: {
      teams: [
        { members: [{ tacticIds: ['tactic-a', ''] }, { tacticIds: ['', ''] }, { tacticIds: ['', ''] }] },
        { members: [{ tacticIds: ['', ''] }, { tacticIds: ['', 'tactic-b'] }, { tacticIds: ['', ''] }] }
      ]
    }
  });
  vm.runInContext(helper[0], context);
  assert.equal(vm.runInContext(`isTacticUsed_('tactic-a')`, context), true);
  assert.equal(vm.runInContext(`isTacticUsed_('tactic-a', 0, 0, 0)`, context), false);
  assert.equal(vm.runInContext(`isTacticUsed_('tactic-b', 0, 0, 0)`, context), true);
  assert.equal(vm.runInContext(`isTacticUsed_('tactic-c')`, context), false);
});

test('戦法カードと選択処理が全編成の重複確認を使う', () => {
  assert.match(html, /const used = isTacticUsed_\(tactic\.id\)/);
  assert.match(html, /isTacticUsed_\(id, state\.activeTeam, state\.selected\.role, state\.selected\.slot\)/);
  assert.match(html, /同じ戦法は複数の部隊に重複して設定できません/);
  assert.match(html, /used \? '編成済み' : '習得可能'/);
});
