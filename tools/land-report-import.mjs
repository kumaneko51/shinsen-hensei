#!/usr/bin/env node
/*
 * 戦報画像の取込を繰り返し作業にしないためのローカル用ツール。
 * APIキーと service role key は環境変数だけから読み込み、出力やリポジトリには保存しない。
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const usage = `
使い方:
  node tools/land-report-import.mjs analyze --input <画像フォルダー> --output review.json --model <画像対応モデル>
  node tools/land-report-import.mjs validate --input review.json --output plan.json
  node tools/land-report-import.mjs commit --input plan.json --family <一門UUID>

環境変数:
  OPENAI_API_KEY                  analyze で使用（ローカルだけに設定）
  SUPABASE_URL                    commit で使用
  SUPABASE_SERVICE_ROLE_KEY       commit で使用（絶対に公開ファイルへ書かない）
`;

function argument_(name, required = true) {
  const i = process.argv.indexOf(name);
  const value = i >= 0 ? process.argv[i + 1] : '';
  if (required && !value) throw Error(`${name} を指定してください。${usage}`);
  return value || '';
}
function number_(value, field, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw Error(`${field} が正しくありません。`);
  return number;
}
function levels_(value) {
  const levels = Array.isArray(value) ? value : String(value || '').split(/[・,]/);
  if (levels.length !== 3 || !levels.every(v => Number.isInteger(Number(v)) && Number(v) > 0)) throw Error('levels は3人分の正の整数にしてください。');
  return levels.map(Number);
}
function imageFiles_(files) {
  return files.filter(file => ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(file).toLowerCase())).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
function messageText_(response) {
  return String(response.output_text || response.output?.flatMap(item => item.content || []).map(part => part.text || '').join('') || '').trim();
}
function normalise_(record, imagePath) {
  const levels = levels_(record.levels);
  const result = String(record.result || '未確認');
  if (!['勝利', '引分', '敗北', '未確認'].includes(result)) throw Error('result は勝利・引分・敗北・未確認のいずれかにしてください。');
  const team = Array.isArray(record.team) ? record.team : String(record.team || '').split('・');
  if (team.length !== 3 || team.some(value => !String(value).trim())) throw Error('team は武将3人分にしてください。');
  const troops = number_(record.troops, 'troops');
  const remaining = number_(record.remaining, 'remaining');
  const dead = number_(record.dead, 'dead');
  const wounded = number_(record.wounded, 'wounded');
  if (troops !== remaining + dead + wounded) throw Error(`兵数が一致しません: ${basename(imagePath)} (${troops} ≠ ${remaining}+${dead}+${wounded})`);
  return {
    sourceImage: basename(imagePath), sourceImageNumber: Number(record.sourceImageNumber) || null,
    author: String(record.author || '未確認'), team: team.map(String), levels,
    troops, remaining, dead, wounded,
    enemy: String(record.enemy || '未確認'), enemyTroops: number_(record.enemyTroops, 'enemyTroops'),
    enemyRemaining: number_(record.enemyRemaining, 'enemyRemaining', { nullable: true }),
    morale: number_(record.morale, 'morale', { nullable: true }), result,
    landLevel: Number(record.landLevel || 5), enemyLevel: number_(record.enemyLevel ?? 27, 'enemyLevel'),
    season: String(record.season || '未確認'), firstClear: typeof record.firstClear === 'boolean' ? record.firstClear : null,
    breakthroughs: Array.isArray(record.breakthroughs) && record.breakthroughs.length === 3 ? record.breakthroughs.map(value => value === null ? null : number_(value, 'breakthrough')) : [null, null, null],
    skills: Array.isArray(record.skills) ? record.skills.map(String).slice(0, 3) : [],
    confidence: Math.max(0, Math.min(1, Number(record.confidence ?? 0))),
    needsReview: record.needsReview !== false
  };
}
function linkAttempts_(records) {
  for (let index = 0; index < records.length; index++) {
    const previous = records[index];
    if (!['引分', '敗北'].includes(previous.result) || previous.enemyRemaining === null) continue;
    const next = records.slice(index + 1).find(candidate =>
      candidate.author === previous.author && candidate.enemy === previous.enemy && candidate.enemyTroops === previous.enemyRemaining
    );
    if (!next) continue;
    const key = `attempt-${String(index + 1).padStart(3, '0')}`;
    const type = previous.result === '引分' && previous.team.join('・') === next.team.join('・') ? '引分後の再戦' : '別部隊で再戦';
    const evidence = '投稿者・守備軍が一致し、前戦の敵残兵数と再戦の敵開始兵数が一致。';
    Object.assign(previous, { attemptId: key, sequence: 1, linkType: type, linkEvidence: evidence });
    Object.assign(next, { attemptId: key, sequence: 2, linkType: type, linkEvidence: evidence, firstClear: false });
  }
  return records;
}
async function analyze_() {
  const directory = argument_('--input'); const output = argument_('--output'); const model = argument_('--model');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Error('OPENAI_API_KEY が設定されていません。');
  const files = imageFiles_(await readdir(directory));
  if (!files.length) throw Error('画像が見つかりません。');
  const instructions = 'あなたはゲーム戦報を転記する検証器です。画像に見える値だけを返してください。不明な値は null、推測は禁止です。JSONだけを返します。形式: {author,team:[3人],levels:[3整数],troops,remaining,dead,wounded,enemy,enemyTroops,enemyRemaining,morale,result,landLevel,enemyLevel,skills:[武将順3文字列],confidence,needsReview}。resultは勝利、引分、敗北、未確認。';
  const records = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index]; const bytes = await readFile(join(directory, file));
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, store: false, instructions, input: [{ role: 'user', content: [
        { type: 'input_text', text: `画像 ${index + 1}/${files.length} を転記してください。` },
        { type: 'input_image', image_url: `data:image/${extname(file).slice(1) || 'png'};base64,${bytes.toString('base64')}`, detail: 'high' }
      ] }] })
    });
    if (!response.ok) throw Error(`画像認識に失敗しました: ${response.status} ${await response.text()}`);
    const data = await response.json(); const extracted = JSON.parse(messageText_(data));
    records.push({ ...extracted, sourceImage: file, sourceImageNumber: index + 1, needsReview: true });
  }
  await writeFile(output, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), records }, null, 2));
  console.log(`${records.length}件の確認用データを書き出しました: ${output}`);
}
async function validate_() {
  const input = argument_('--input'); const output = argument_('--output');
  const document = JSON.parse(await readFile(input, 'utf8'));
  const records = linkAttempts_((document.records || []).map(record => normalise_(record, record.sourceImage || 'unknown.png')));
  const summary = records.reduce((total, record) => ({ ...total, [record.result]: (total[record.result] || 0) + 1 }), {});
  await writeFile(output, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), records, summary }, null, 2));
  console.log(`検証完了: ${records.length}件 / ${Object.entries(summary).map(([key, value]) => `${key}${value}`).join(' / ')}`);
}
async function commit_() {
  const input = argument_('--input'); const family = argument_('--family'); const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。');
  const document = JSON.parse(await readFile(input, 'utf8')); const records = document.records || [];
  if (records.some(record => record.needsReview)) throw Error('needsReview が残っています。確認後に false にしてから commit してください。');
  const baseNumber = Number(argument_('--start-number', false) || 1);
  for (const [index, record] of records.entries()) {
    const image = await readFile(join(argument_('--images'), record.sourceImage));
    const imagePath = `batch-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}${extname(record.sourceImage).toLowerCase()}`;
    const upload = await fetch(`${url}/storage/v1/object/family-land-reports/${imagePath}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'image/png', 'x-upsert': 'false' }, body: image });
    if (!upload.ok) throw Error(`画像保存に失敗しました: ${record.sourceImage}`);
    const payload = { ...record, team: record.team.join('・'), levels: record.levels.join('・') };
    const insert = await fetch(`${url}/rest/v1/family_land_reports`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ family_id: family, report_number: baseNumber + index, payload, image_path: imagePath }) });
    if (!insert.ok) throw Error(`戦報保存に失敗しました: ${record.sourceImage}`);
  }
  console.log(`${records.length}件を一門 ${family} に保存しました。`);
}
async function main_() {
  const command = process.argv[2];
  if (command === 'analyze') return analyze_();
  if (command === 'validate') return validate_();
  if (command === 'commit') return commit_();
  console.log(usage);
}
main_().catch(error => { console.error(`失敗: ${error.message}`); process.exitCode = 1; });
