const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ctx=vm.createContext({state:{cloudUser:{},family:{name:'Test'}},pageHead_:()=>'',escape_:s=>s});
vm.runInContext(readFileSync(require('node:path').join(__dirname,'../land-reports.js'),'utf8'),ctx);
vm.runInContext(`
const base={team:'A・B・C',landLevel:5,season:'S4',heroLevels:[15,15,15],levels:'15・15・15',breakthroughs:[0,2,4],skills:[],remaining:0};
LAND_REPORTS=[
 {...base,id:1,enemy:'山内一豊',result:'引分',troops:1000,dead:100,wounded:200,attemptId:'a',sequence:1},
 {...base,id:2,enemy:'山内一豊',result:'勝利',troops:500,dead:20,wounded:30,attemptId:'a',sequence:2},
 {...base,id:3,enemy:'宍戸隆家',result:'敗北',troops:2000,dead:500,wounded:500},
 {...base,id:4,enemy:'未掲載大将',result:'勝利',troops:0,dead:0,wounded:0}
];
landStatus='ready';
`,ctx);
const stats=vm.runInContext("landEnemyLosses_(landRows_()).get('山内一豊')",ctx);
assert.equal(stats.count,2);
assert.equal(stats.wins,1);
assert.equal(stats.draws,1);
assert.equal(stats.loss,175);
assert.equal(stats.dead,60);
assert.equal(stats.wounded,115);
assert.ok(Math.abs(stats.rate-350/1500*100)<1e-10);
assert.equal(vm.runInContext("landEnemyLosses_(landRows_()).get('未掲載大将').rate",ctx),null);
let html=vm.runInContext('landReportsPage_()',ctx);
assert.ok(html.includes('S4参考難易度'));
assert.ok(html.includes('未掲載大将'));
assert.ok(html.includes('兵損（戦死＋負傷）'));
assert.ok(html.includes('land-report:3'));
vm.runInContext("landEnemy='山内一豊';landScope='勝利'",ctx);
html=vm.runInContext('landReportsPage_()',ctx);
assert.ok(html.includes('land-report:2'));
assert.ok(!html.includes('land-report:1'));
assert.ok(!html.includes('land-report:3'));
vm.runInContext("landSeason='S3'",ctx);
html=vm.runInContext('landReportsPage_()',ctx);
assert.ok(!html.includes('land-report:2'));
assert.ok(html.includes('山内一豊'));
vm.runInContext('landLevel=6',ctx);
html=vm.runInContext('landReportsPage_()',ctx);
assert.ok(html.includes('難易度表はありません'));
assert.ok(!html.includes('山内一豊'));
console.log('PASS: opponent losses, weighted rates, result/season/opponent filters and missing data');
