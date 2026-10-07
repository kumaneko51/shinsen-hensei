const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const master = JSON.parse(fs.readFileSync('master.json','utf8'));
const html = fs.readFileSync('index.html','utf8');
const expected = [
  ['島津義久',6,'三州総大将'], ['龍造寺隆信',7,'肥前の熊'], ['石川数正',6,'懐刀の謀臣'],
  ['吉岡妙林',3,'騙討'], ['相良義陽',5,'義無反顧'], ['種子島時堯',5,'種子島銃']
];
test('九州争覇の新武将6人を選択できる',()=>{
  for(const [name,cost,skill] of expected){ const hero=master.heroes.find(x=>x.name===name); assert.ok(hero,`${name}が存在すること`); assert.equal(hero.cost,cost); assert.equal(hero.uniqueSkill,skill); assert.equal(hero.rarity,'S'); assert.ok(hero.portrait,`${name}の画像が設定されていること`); assert.ok(fs.existsSync(hero.portrait),`${name}の画像ファイルが存在すること`); }
});
test('新武将IDは既存IDと旧ID移行先に重複しない',()=>{
  const ids=master.heroes.map(x=>x.id); assert.equal(new Set(ids).size,ids.length); for(const name of expected.map(x=>x[0])){const hero=master.heroes.find(x=>x.name===name);assert.doesNotMatch(html,new RegExp(`'${hero.id}':`));}
});
test('武将庫はレアリティごとにまとめ、その中で新武将を含めてコストの高い順に並ぶ',()=>{
  const source = html.match(/function filteredHeroes_\(\) \{[\s\S]*?\n    \}/)?.[0];
  assert.ok(source);
  const state = { query:'', cost:'', faction:'', rarity:'', ownedOnly:false, mode:'lineup', inventory:{heroIds:[]} };
  const listed = vm.runInNewContext(source + '\nfilteredHeroes_()', { state, heroes_:()=>master.heroes });
  const rarityOrder = { S: 0, A: 1, B: 2 };
  for(let i=1;i<listed.length;i++) {
    const previous = listed[i-1], current = listed[i];
    assert.ok(rarityOrder[previous.rarity] <= rarityOrder[current.rarity]);
    if(previous.rarity === current.rarity) assert.ok(Number(previous.cost) >= Number(current.cost));
  }
  const newNames = new Set(expected.map(x=>x[0]));
  assert.deepEqual(Array.from(listed.filter(hero=>newNames.has(hero.name)), hero=>hero.name),
    ['龍造寺隆信','島津義久','石川数正','相良義陽','種子島時堯','吉岡妙林']);
});
test('未確認の能力値をゼロと誤表示しない',()=>{ assert.match(html,/const known = base !== null/); assert.match(html,/\? Number\(base\) \+ bonus : '—'/); });
