const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const master = JSON.parse(fs.readFileSync(path.join(root, 'master.json'), 'utf8'));

test('一条信龍 is represented by one canonical hero and old saved data migrates', () => {
  const heroes = master.heroes.filter((hero) => /一条信[龍竜]/.test(hero.name));
  assert.equal(heroes.length, 1);
  assert.equal(heroes[0].id, 'hero-073');
  assert.equal(heroes[0].name, '一条信龍');
  assert.equal(heroes[0].portrait, 'https://img.game8.jp/12055689/fc65f0be8d27018794a7caacfb36e06e.webp/original');
  assert.match(html, /'hero-156': 'hero-073'/);
});

test('一条信龍 name variants normalize to the same spelling', () => {
  assert.match(html, /replace\(\/條\/g, '条'\)/);
  assert.match(html, /replace\(\/竜\/g, '龍'\)/);
  assert.match(html, /replace\(\/龙\/g, '龍'\)/);
  const related = master.tactics.filter((tactic) =>
    [tactic.uniqueHero, tactic.summary, tactic.effect].some((value) => /一条信[龍竜]/.test(value || ''))
  );
  assert.ok(related.length > 0);
  assert.ok(related.every((tactic) => !/[竜龙]/.test(`${tactic.uniqueHero}${tactic.summary}${tactic.effect}`)));
});
