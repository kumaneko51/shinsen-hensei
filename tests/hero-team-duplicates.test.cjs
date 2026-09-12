const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const helper = html.match(/function isHeroUsed_\([\s\S]*?\n    }/);
assert.ok(helper, '武将の全編成重複確認処理が存在すること');

test('別部隊にいる同じ武将を検出し、現在の枠だけは除外できる', () => {
  const context = vm.createContext({
    state: {
      teams: [
        { members: [{ heroId: 'hero-a' }, { heroId: '' }, { heroId: '' }] },
        { members: [{ heroId: '' }, { heroId: 'hero-b' }, { heroId: '' }] }
      ]
    }
  });
  vm.runInContext(helper[0], context);
  assert.equal(vm.runInContext(`isHeroUsed_('hero-a')`, context), true);
  assert.equal(vm.runInContext(`isHeroUsed_('hero-a', 0, 0)`, context), false);
  assert.equal(vm.runInContext(`isHeroUsed_('hero-b', 0, 0)`, context), true);
  assert.equal(vm.runInContext(`isHeroUsed_('hero-c')`, context), false);
});

test('選択処理とカード表示が全編成の重複確認を使う', () => {
  assert.match(html, /const used = isHeroUsed_\(hero\.id\)/);
  assert.match(html, /isHeroUsed_\(id, state\.activeTeam, state\.selected\.role\)/);
  assert.match(html, /同じ武将は複数の部隊に重複して設定できません/);
});
