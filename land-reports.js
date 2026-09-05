/* 攻略データはRLS付きテーブルから取得。公開ファイルに戦報を含めない。 */
let LAND_REPORTS = [];
let landStatus = "idle";
let landGeneration = 0;
let landImageUrl = "";
let landImageStatus = "idle";
let landImageGeneration = 0;
let familySection = 'lineups';
function familyTabs_() {
  return '<nav class="land-tabs" aria-label="一門内の画面"><button class="btn '+(familySection==='lineups'?'primary':'')+'" data-family-section="lineups" aria-pressed="'+(familySection==='lineups')+'">共有編成</button><button class="btn '+(familySection==='land'?'primary':'')+'" data-family-section="land" aria-pressed="'+(familySection==='land')+'">土地攻略データ</button></nav>';
}

let landLevel = 5;
let landScope = 'all';
let landSeason = 'all';
function landRows_() {
  return LAND_REPORTS.filter(r => r.landLevel === landLevel && (landSeason === 'all' || r.season === landSeason));
}
function landSequence_(report) {
  return report.attemptId ? LAND_REPORTS.filter(r => r.attemptId === report.attemptId).sort((a,b)=>a.sequence-b.sequence || a.id-b.id) : [report];
}
function landWinningAttempts_(rows, firstOnly=false) {
  const seen = new Set();
  return rows.flatMap(r => {
    const key = r.attemptId || 'single-'+r.id;
    if (seen.has(key)) return [];
    seen.add(key);
    const sequence = landSequence_(r), start = sequence[0];
    if (!sequence.some(x=>x.result==='勝利') || (firstOnly && start.firstClear!==true)) return [];
    // 複数部隊の攻略を1部隊の開始兵数・育成状況として集計しない。
    if (sequence.some(x=>x.team!==start.team)) return [];
    return [{...start,result:'勝利'}];
  });
}
function landSummary_(rows) {
  const wins = rows.filter(r => r.result === '勝利');
  const levels = wins.map(r => r.heroLevels).filter(a => a.length === 3 && a.every(Number.isFinite)).map(a => a.reduce((x,y)=>x+y,0)/3);
  const troops = wins.filter(r => r.troops > 0).map(r => r.troops);
  const breaks = wins.flatMap(r => r.breakthroughs).filter(Number.isFinite);
  const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
  return { count:wins.length, level:avg(levels), levelCount:levels.length, min:levels.length?Math.min(...levels):null, max:levels.length?Math.max(...levels):null, troops:avg(troops), breaks:avg(breaks), breakCount:breaks.length, zero:breaks.filter(x=>x===0).length };
}
function landValue_(n, digits=1) { return n === null ? '—' : n.toLocaleString('ja-JP',{maximumFractionDigits:digits,minimumFractionDigits:digits}); }
function landReportsPage_() {
  if (!state.cloudUser || !state.family) return '';
  const head = pageHead_('土地攻略データ', '一門：'+state.family.name+' · 土地レベル別に初攻略時の育成状況を確認') + familyTabs_();
  if (landStatus !== 'ready') return head + '<section class="empty-panel">' + (landStatus === 'error' ? '攻略データを取得できませんでした。<button class="btn" data-land-retry>再読み込み</button>' : '攻略データを読み込んでいます…') + '</section>';
  const allRows = landRows_(), firstRows = landWinningAttempts_(allRows,true);
  const rows = landScope === 'first' ? firstRows.map(r=>allRows.find(x=>x.id===r.id)) : landScope === 'all' ? allRows : allRows.filter(r=>r.result===landScope);
  const stats = landSummary_(firstRows), reference = landSummary_(landWinningAttempts_(allRows));
  const seasons = [...new Set(LAND_REPORTS.map(r => r.season))];
  const levels = [4,5,6,7,8,9,10].map(level => '<button class="land-level '+(landLevel===level?'active':'')+'" data-land-level="'+level+'" aria-pressed="'+(landLevel===level)+'"><strong>土地 '+level+'</strong><small>'+LAND_REPORTS.filter(r=>r.landLevel===level).length+'件</small></button>').join('');
  const metric = (label,value,sub) => '<article class="panel land-stat"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+'</small></article>';
  return head+'<nav class="land-levels" aria-label="土地レベル">'+levels+'</nav><div class="land-toolbar"><div><h2>土地Lv'+landLevel+' の初攻略</h2><span>初攻略確認済み '+stats.count+'件 ／ 登録 '+allRows.length+'件</span></div><label>シーズン <select class="filter" id="land-season"><option value="all">すべて</option>'+seasons.map(v=>'<option value="'+escape_(v)+'" '+(landSeason===v?'selected':'')+'>'+escape_(v)+'</option>').join('')+'</select></label></div>'+
  '<section class="land-stat-grid">'+metric('平均攻略レベル',landValue_(stats.level),'開始時の3武将平均 · '+stats.levelCount+'部隊')+metric('平均開始兵数',landValue_(stats.troops,0),'初攻略の勝利データのみ')+metric('平均凸数',landValue_(stats.breaks),'凸を確認できた '+stats.breakCount+'武将')+metric('攻略レベルの範囲',stats.min===null?'—':landValue_(stats.min)+'〜'+landValue_(stats.max),'各部隊の3武将平均の最小〜最大')+'</section>'+
  '<p class="land-footnote">集計対象は初攻略確認済みの成功例です。引分→勝利は1攻略として、最初の戦闘のレベル・兵数を使います。別部隊での再戦と敗北のみの記録は平均に含めません。不明な凸数は0凸として数えません。</p>'+
  (stats.count===0?'<div class="notice">初攻略と確認できたデータがまだないため、初攻略の平均は未集計です。'+(reference.count?'参考：登録済みの勝利 '+reference.count+'件では平均Lv '+landValue_(reference.level)+'、平均開始兵数 '+landValue_(reference.troops,0)+'。初攻略の目安としては未確定です。':'画像付きの初攻略データが登録されると集計できます。')+'</div>':'')+
  '<section class="panel land-break-panel"><h2>武将の凸状況</h2><p>初攻略時に使われた武将の内訳。確認済み '+stats.breakCount+'／'+(stats.count*3)+'枠</p><div class="land-break-bars">'+[0,1,2,3,4,5].map(n=>{const count=firstRows.flatMap(r=>r.breakthroughs).filter(x=>x===n).length;return '<div><span>'+n+'凸</span><meter min="0" max="'+Math.max(1,stats.breakCount)+'" value="'+count+'">'+count+'</meter><b>'+count+'人</b></div>';}).join('')+'</div></section>'+
  '<div class="land-toolbar"><div><h2>攻略記録</h2><p>'+['勝利','引分','敗北'].map(v=>v+' '+allRows.filter(r=>r.result===v).length+'件').join(' ／ ')+'</p></div><label>表示 <select class="filter" id="land-scope">'+[['all','すべて'],['first','初攻略確認済み'],['勝利','勝利'],['引分','引き分け'],['敗北','敗北']].map(([v,label])=>'<option value="'+v+'" '+(landScope===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+
  (rows.length?'<div class="land-table-wrap"><table class="land-table"><thead><tr><th>編成・凸状況</th><th>開始時Lv</th><th>兵数</th><th>結果</th><th>初攻略</th><th>戦報</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.team.split('・').map((name,i)=>'<div>'+name+' <small>'+ (r.breakthroughs[i]===null?'凸未確認':r.breakthroughs[i]+'凸')+'</small></div>').join('')+'</td><td>'+r.levels+'<small>部隊平均 '+landValue_(r.heroLevels.length===3?r.heroLevels.reduce((a,b)=>a+b,0)/3:null)+'</small></td><td>'+r.troops.toLocaleString()+'<small>減少 '+(r.troops?((r.dead+r.wounded)/r.troops*100).toFixed(1):'—')+'%</small></td><td>'+r.result+(r.attemptId?'<small>連戦 '+r.sequence+'戦目</small>':'')+'</td><td>'+(r.firstClear===true?'確認済み':r.firstClear===false?'再戦・初攻略以外':'未確認')+'</td><td><button class="btn" data-modal="land-report:'+r.id+'">画像・詳細</button></td></tr>').join('')+'</tbody></table></div>':'<section class="empty-panel">'+(allRows.length?'この表示条件に合う記録はありません。「すべて」で全戦報を確認できます。':'この土地レベルのデータはまだありません。')+'</section>');
}
function landLinkedReports_(r) {
  const sequence = landSequence_(r);
  if (sequence.length < 2) return '';
  return '<section class="land-linked"><h3>'+r.linkType+'</h3><p>'+r.linkEvidence+'</p><div class="land-tabs">'+sequence.map(x=>'<button class="btn '+(r.id===x.id?'primary':'')+'" data-modal="land-report:'+x.id+'" aria-pressed="'+(r.id===x.id)+'">'+x.sequence+'戦目：'+x.result+' · 画像'+(x.sourceImageNumber||x.id)+'</button>').join('')+'</div><p>敵兵数：'+sequence.map(x=>x.enemyTroops.toLocaleString()+' → '+(x.enemyRemaining===null?'未確認':x.enemyRemaining.toLocaleString())).join(' ／ ')+'</p><small>各戦闘の画像と数値を保存しています。兵の補充がある場合があるため、開始兵数は合算しません。</small></section>';
}
function landReportModal_(id) {
  if (!state.cloudUser || !state.family) return '';
  const r=LAND_REPORTS.find(x=>x.id===Number(id));
  if (!r) return '';
  return '<div class="backdrop"><section class="modal land-modal" role="dialog" aria-modal="true" aria-label="土地攻略事例の詳細"><div class="land-card-top"><h2>攻略記録 '+r.id+' · 土地Lv'+r.landLevel+'</h2><button class="btn" data-close-modal>閉じる</button></div>'+landLinkedReports_(r)+'<div class="land-detail"><div><h3>画像から確認した実績</h3><p>投稿者：'+r.author+'</p><p>'+r.team+'</p><dl class="land-facts"><dt>初攻略</dt><dd>'+(r.firstClear===true?'確認済み':r.firstClear===false?'初攻略以外':'未確認')+'</dd><dt>シーズン</dt><dd>'+escape_(r.season)+'</dd><dt>凸状況</dt><dd>'+r.breakthroughs.map(n=>n===null?'未確認':n+'凸').join('・')+'</dd><dt>開始時Lv</dt><dd>'+r.levels+'</dd><dt>開始 → 残存兵数</dt><dd>'+r.troops.toLocaleString()+' → '+r.remaining.toLocaleString()+'</dd><dt>戦死／負傷</dt><dd>'+r.dead.toLocaleString()+'／'+r.wounded.toLocaleString()+'</dd><dt>士気</dt><dd>'+r.morale+'</dd><dt>守備軍</dt><dd>'+r.enemy+'隊 · Lv'+(r.enemyLevel ?? '未確認')+' · '+(r.enemyTroops===null?'兵数未確認':r.enemyTroops.toLocaleString()+'兵')+'</dd><dt>敵残兵数</dt><dd>'+(r.enemyRemaining===null?'未確認':r.enemyRemaining.toLocaleString())+'</dd><dt>結果</dt><dd>'+r.result+'</dd></dl><h3>装備戦法（武将順）</h3>'+r.skills.map((s,i)=>'<p><strong>'+r.team.split('・')[i]+'</strong><br>'+s+'</p>').join('')+'<h3>解説・暫定評価</h3><span class="land-rating" data-rating="'+r.rating+'">'+r.rating+'</span><p class="land-explanation">'+r.note+'</p><p>出典：提供された戦報画像 '+(r.sourceImageNumber||r.id)+'。シーズン・撮影日・戦法レベルは未確認です。</p></div><figure>'+(landImageUrl ? '<a href="'+landImageUrl+'" target="_blank" rel="noopener"><img src="'+landImageUrl+'" alt="事例'+r.id+'の土地Lv'+r.landLevel+'戦報"></a><figcaption>画像を押すと原寸で開きます</figcaption>' : '<p>'+(landImageStatus === 'error' ? '画像を取得できませんでした。詳細を開き直してください。' : '戦報画像を読み込んでいます…')+'</p>')+'</figure></div></section></div>';
}

function clearLandImage_() {
  if (landImageUrl) URL.revokeObjectURL(landImageUrl);
  landImageGeneration++; landImageUrl = ''; landImageStatus = 'idle';
}
function resetLandReports_() {
  landGeneration++; LAND_REPORTS = []; landStatus = 'idle'; clearLandImage_();
  if (state.modal.startsWith('land-report:')) state.modal = '';
}
async function loadLandReports_() {
  resetLandReports_();
  if (!supabaseClient || !state.cloudUser || !state.family) return;
  const generation = landGeneration, familyId = state.family.id, userId = state.cloudUser.id;
  landStatus = 'loading'; render();
  try {
    const result = await supabaseClient.from('family_land_reports').select('report_number,payload,image_path').eq('family_id', familyId).order('report_number');
    if (generation !== landGeneration || state.family?.id !== familyId || state.cloudUser?.id !== userId) return;
    if (result.error) throw result.error;
    LAND_REPORTS = (result.data || []).map(row => {
      const p = row.payload;
      if (!p || !Array.isArray(p.skills)) throw Error('Invalid report');
      const r = { id: Number(row.report_number), imagePath: row.image_path };
      r.landLevel = Number.isInteger(p.landLevel) ? p.landLevel : 5;
      r.enemyLevel = Number.isFinite(p.enemyLevel) ? p.enemyLevel : (r.landLevel === 5 ? 27 : null);
      r.enemyTroops = Number.isFinite(p.enemyTroops) ? p.enemyTroops : (r.landLevel === 5 ? 9000 : null);
      r.firstClear = typeof p.firstClear === 'boolean' ? p.firstClear : null;
      r.author = escape_(String(p.author || '未確認'));
      r.sourceImageNumber = Number.isInteger(p.sourceImageNumber) ? p.sourceImageNumber : null;
      r.attemptId = typeof p.attemptId === 'string' ? p.attemptId : '';
      r.sequence = Number.isInteger(p.sequence) && p.sequence > 0 ? p.sequence : 1;
      r.linkType = escape_(String(p.linkType || '関連する戦報'));
      r.linkEvidence = escape_(String(p.linkEvidence || ''));
      r.enemyRemaining = Number.isFinite(p.enemyRemaining) && p.enemyRemaining >= 0 ? p.enemyRemaining : null;
      r.season = typeof p.season === 'string' && p.season.trim() ? p.season.trim() : '未確認';
      const parsedLevels = String(p.levels || '').split('・').map(Number);
      r.heroLevels = parsedLevels.length === 3 && parsedLevels.every(v=>Number.isFinite(v) && v>0) ? parsedLevels : [];
      r.breakthroughs = [0,1,2].map(i => { const n = p.breakthroughs?.[i]; return Number.isInteger(n) && n>=0 && n<=5 ? n : null; });
      ['team','levels','enemy','result','rating','note'].forEach(k => { r[k] = escape_(String(p[k] || '')); });
      ['troops','remaining','dead','wounded','morale'].forEach(k => { if (!Number.isFinite(p[k]) || p[k] < 0) throw Error('Invalid number'); r[k] = p[k]; });
      r.skills = p.skills.map(s => escape_(String(s)));
      return r;
    });
    landStatus = 'ready';
  } catch (error) {
    if (generation !== landGeneration) return;
    LAND_REPORTS = []; landStatus = 'error';
  }
  render();
}
async function loadLandImage_(id) {
  clearLandImage_();
  const r = LAND_REPORTS.find(x => x.id === Number(id));
  if (!r || !state.cloudUser || !state.family || !supabaseClient) return;
  const generation = landGeneration, imageGeneration = landImageGeneration, userId = state.cloudUser.id, familyId = state.family.id;
  landImageStatus = 'loading';
  try {
    const result = await supabaseClient.storage.from('family-land-reports').download(r.imagePath);
    if (imageGeneration !== landImageGeneration || generation !== landGeneration || state.cloudUser?.id !== userId || state.family?.id !== familyId || state.modal !== 'land-report:'+id) return;
    if (result.error || !result.data) throw Error('Image unavailable');
    landImageUrl = URL.createObjectURL(result.data); landImageStatus = 'ready';
  } catch (error) {
    if (imageGeneration !== landImageGeneration || generation !== landGeneration || state.modal !== 'land-report:'+id) return;
    landImageStatus = 'error';
  }
  render();
}

