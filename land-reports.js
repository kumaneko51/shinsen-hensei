/* 攻略データはRLS付きテーブルから取得。公開ファイルに戦報を含めない。 */
let LAND_REPORTS = [];
let landStatus = "idle";
let landGeneration = 0;
let landImageUrl = "";
let landImageStatus = "idle";
let familySection = 'lineups';
let landFilter = 'all';
function familyTabs_() {
  return '<nav class="land-tabs" aria-label="一門内の画面"><button class="btn '+(familySection==='lineups'?'primary':'')+'" data-family-section="lineups" aria-pressed="'+(familySection==='lineups')+'">共有編成</button><button class="btn '+(familySection==='land'?'primary':'')+'" data-family-section="land" aria-pressed="'+(familySection==='land')+'">土地攻略データ</button></nav>';
}
function landReportsPage_() {
  if (!state.cloudUser || !state.family) return '';
  const head = pageHead_('一門：'+state.family.name, '一門限定の土地攻略データです。') + familyTabs_();
  if (landStatus !== 'ready') return head + '<section class="empty-panel">' + (landStatus === 'error' ? '攻略データを取得できませんでした。<button class="btn" data-land-retry>再読み込み</button>' : '攻略データを読み込んでいます…') + '</section>';
  if (!LAND_REPORTS.length) return head + '<section class="empty-panel">この一門の攻略データはまだ登録されていません。</section>';
  const reports = LAND_REPORTS.filter(r => landFilter==='all' || r.rating===landFilter);
  return pageHead_('一門：'+state.family.name, '戦報と攻略条件を比較し、シーズン開始時の判断に役立てます。')+familyTabs_()+
    '<section class="land-intro"><span class="tag">一門限定 · '+LAND_REPORTS.length+'件</span><h2>土地Lv5の攻略事例</h2><p>勝てる条件と、低損失で繰り返せる条件を分けて確認しましょう。</p><p>シーズン・戦法レベルは未確認。評価は各1戦からの暫定判断です。</p></section>'+
    '<div class="land-toolbar"><label>攻略判定 <select class="filter" id="land-filter">'+[['all','すべて'],['周回候補','周回候補'],['初回確保向け','初回確保向け'],['強行攻略','強行攻略'],['見送り','見送り']].map(x=>'<option value="'+x[0]+'" '+(landFilter===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label><span>'+reports.length+'件の事例</span></div>'+
    '<section class="land-grid">'+reports.map(r=>'<article class="panel land-card"><div class="land-card-top"><span class="tag">土地Lv5 · 事例 '+r.id+'</span><span class="land-rating" data-rating="'+r.rating+'">'+r.rating+'</span></div><h2>'+r.team+'</h2><p>自軍Lv '+r.levels+' ／ 敵大将：'+r.enemy+'</p><div class="land-metrics"><span>開始兵数<b>'+r.troops.toLocaleString()+'</b></span><span>兵数減少率<b>'+((r.dead+r.wounded)/r.troops*100).toFixed(1)+'%</b></span><span>結果<b>'+r.result+'</b></span></div><p>'+r.note+'</p><button class="btn" data-modal="land-report:'+r.id+'">戦報画像・詳細を見る</button></article>').join('')+'</section><p class="land-footnote">兵数減少率＝（戦死＋負傷）÷開始兵数。周回候補：勝利かつ10%以下／初回確保向け：勝利かつ10%超〜30%／強行攻略：勝利かつ30%超／見送り：引分・敗北。ゲームの確定基準ではありません。</p>';
}
function landReportModal_(id) {
  if (!state.cloudUser || !state.family) return '';
  const r=LAND_REPORTS.find(x=>x.id===Number(id));
  if (!r) return '';
  return '<div class="backdrop"><section class="modal land-modal" role="dialog" aria-modal="true" aria-label="土地攻略事例の詳細"><div class="land-card-top"><h2>事例 '+r.id+' · 土地Lv5</h2><button class="btn" data-close-modal>閉じる</button></div><div class="land-detail"><div><h3>画像から確認した実績</h3><p>'+r.team+'</p><dl class="land-facts"><dt>開始時Lv</dt><dd>'+r.levels+'</dd><dt>開始 → 残存兵数</dt><dd>'+r.troops.toLocaleString()+' → '+r.remaining.toLocaleString()+'</dd><dt>戦死／負傷</dt><dd>'+r.dead.toLocaleString()+'／'+r.wounded.toLocaleString()+'</dd><dt>士気</dt><dd>'+r.morale+'</dd><dt>守備軍</dt><dd>'+r.enemy+'隊 · Lv27 · 9,000兵</dd><dt>結果</dt><dd>'+r.result+'</dd></dl><h3>装備戦法（武将順）</h3>'+r.skills.map((s,i)=>'<p><strong>'+r.team.split('・')[i]+'</strong><br>'+s+'</p>').join('')+'<h3>解説・暫定評価</h3><span class="land-rating" data-rating="'+r.rating+'">'+r.rating+'</span><p class="land-explanation">'+r.note+'</p><p>出典：提供された戦報画像 '+r.id+'。シーズン・撮影日・戦法レベルは未確認です。</p></div><figure>'+(landImageUrl ? '<a href="'+landImageUrl+'" target="_blank" rel="noopener"><img src="'+landImageUrl+'" alt="事例'+r.id+'の土地Lv5戦報"></a><figcaption>画像を押すと原寸で開きます</figcaption>' : '<p>'+(landImageStatus === 'error' ? '画像を取得できませんでした。詳細を開き直してください。' : '戦報画像を読み込んでいます…')+'</p>')+'</figure></div></section></div>';
}

function clearLandImage_() {
  if (landImageUrl) URL.revokeObjectURL(landImageUrl);
  landImageUrl = ''; landImageStatus = 'idle';
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
  const generation = landGeneration, userId = state.cloudUser.id, familyId = state.family.id;
  landImageStatus = 'loading';
  try {
    const result = await supabaseClient.storage.from('family-land-reports').download(r.imagePath);
    if (generation !== landGeneration || state.cloudUser?.id !== userId || state.family?.id !== familyId || state.modal !== 'land-report:'+id) return;
    if (result.error || !result.data) throw Error('Image unavailable');
    landImageUrl = URL.createObjectURL(result.data); landImageStatus = 'ready';
  } catch (error) {
    if (generation !== landGeneration || state.modal !== 'land-report:'+id) return;
    landImageStatus = 'error';
  }
  render();
}
