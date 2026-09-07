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
