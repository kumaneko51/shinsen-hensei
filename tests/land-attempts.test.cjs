const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ctx=vm.createContext({URL:{revokeObjectURL(){}},state:{modal:''}});
vm.runInContext(readFileSync(require('node:path').join(__dirname,'../land-reports.js'),'utf8'),ctx);
vm.runInContext(`
const sample=(id,extra={})=>({id,team:'A・B・C',result:'勝利',heroLevels:[15,15,15],troops:4500,breakthroughs:[null,null,null],firstClear:true,...extra});
LAND_REPORTS=[sample(1,{result:'引分',attemptId:'one',sequence:1}),sample(2,{attemptId:'one',sequence:2,heroLevels:[16,16,16],troops:4800,firstClear:false}),sample(3,{result:'敗北'}),sample(4,{firstClear:null,heroLevels:[18,18,18],troops:5400,breakthroughs:[0,2,4]}),sample(5,{result:'敗北',attemptId:'mixed',sequence:1}),sample(6,{attemptId:'mixed',sequence:2,team:'D・E・F',firstClear:false})];
`,ctx);
assert.equal(vm.runInContext('landWinningAttempts_(LAND_REPORTS).length',ctx),2);
assert.equal(vm.runInContext('landSummary_(landWinningAttempts_(LAND_REPORTS)).level',ctx),16.5);
assert.equal(vm.runInContext('landSummary_(landWinningAttempts_(LAND_REPORTS)).troops',ctx),4950);
assert.equal(vm.runInContext('landWinningAttempts_(LAND_REPORTS).length',ctx),2);
assert.equal(vm.runInContext('landSummary_(landWinningAttempts_(LAND_REPORTS)).breakCount',ctx),3);
assert.equal(vm.runInContext('landSequence_(LAND_REPORTS[1])[0].id',ctx),1);
console.log('PASS: linked attempts, starting values, defeats, mixed teams and unknown breakthroughs');

assert.equal(vm.runInContext('landSummary_(landWinningAttempts_(LAND_REPORTS)).breaks',ctx),2);
for (const flag of ['true','false','null','undefined']) {
  vm.runInContext(`LAND_REPORTS[3].firstClear=${flag}`,ctx);
  assert.equal(vm.runInContext('landWinningAttempts_(LAND_REPORTS).length',ctx),2);
}

vm.runInContext(`
LAND_REPORTS=[
 sample(110,{landLevel:6,enemy:'小幡景憲',remaining:5469,dead:1500,wounded:831,attemptId:'land6-a',sequence:1}),
 sample(111,{landLevel:6,enemy:'山内一豊',troops:5469,remaining:4021,dead:1168,wounded:280,attemptId:'land6-a',sequence:2}),
 sample(112,{landLevel:6,enemy:'山内一豊',remaining:4000,dead:100,wounded:50,attemptId:'land6-b',sequence:1})
];
`,ctx);
assert.equal(vm.runInContext('landDataRows_(LAND_REPORTS,6).length',ctx),2);
assert.equal(vm.runInContext('landDataRows_(LAND_REPORTS,5).length',ctx),3);
assert.equal(vm.runInContext('landDataRows_(LAND_REPORTS,6)[0].enemy',ctx),'小幡景憲 → 山内一豊');
assert.equal(vm.runInContext('landDataRows_(LAND_REPORTS,6)[0].dead',ctx),2668);
assert.equal(vm.runInContext('landDataRows_(LAND_REPORTS,6)[0].wounded',ctx),1111);
assert.equal(vm.runInContext('landDataRows_(LAND_REPORTS,6)[0].remaining',ctx),4021);
assert.equal(vm.runInContext("landMatchesEnemy_(landDataRows_(LAND_REPORTS,6)[0],'山内一豊')",ctx),true);
console.log('PASS: land 6+ linked battles are displayed as one data row');
