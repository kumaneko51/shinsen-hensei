const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

test('共有URLには部隊だけを含めてチャット上限より短くする', () => {
  assert.match(html, /function copyShareUrl_\(team\)/);
  assert.match(html, /const data = \{ team: team \};/);
  assert.doesNotMatch(html, /const data = \{ team: team, inventory: inventory \};/);

  const team = {
    id: 'team-1',
    name: '共有部隊',
    members: Array.from({ length: 3 }, (_, index) => ({
      heroId: `hero-${index + 1}`,
      breakthrough: 5,
      tacticIds: [`tactic-${index * 2 + 1}`, `tactic-${index * 2 + 2}`],
      bonuses: { leadership: 50, valor: 50, intelligence: 50, politics: 50, charisma: 50, speed: 50 }
    }))
  };
  const encoded = Buffer.from(encodeURIComponent(JSON.stringify({ team })), 'binary').toString('base64');
  const url = `https://kumaneko51.github.io/shinsen-hensei/#share=${encoded}`;
  assert.ok(url.length < 2000, `共有URLが長すぎます: ${url.length}`);
});

test('従来の所持一覧付き共有URLも読み込み可能', () => {
  assert.match(html, /if \(shared\.inventory\) state\.inventory = normalizeInventory_\(shared\.inventory\)/);
});
