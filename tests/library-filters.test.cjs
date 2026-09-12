const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const master = JSON.parse(fs.readFileSync('master.json', 'utf8'));

assert.match(html, /option value="突撃"/);
assert.doesNotMatch(html, /option value="追撃"/);
assert.match(html, /state\.faction === '突撃' \? ' selected'/);
assert.match(html, /oncompositionstart/);
assert.match(html, /refreshSearch_\(element\.value\)/);
assert.match(html, /input\.setSelectionRange/);

const learnableTypes = new Set(master.tactics.filter(function(item) { return item.learnable; }).map(function(item) { return item.type; }));
assert.ok(learnableTypes.has('突撃'), '習得可能な突撃戦法が存在すること');
assert.ok(!learnableTypes.has('追撃'), '誤った追撃種別が存在しないこと');

console.log('library search and tactic filter tests passed');
