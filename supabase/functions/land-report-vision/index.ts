/*
 * アプリの概要: 土地戦報の画像を読取り候補へ変換する、所有者専用のEdge Function。
 * 主な機能: 一門所有者の確認、画像サイズ検証、OpenAI Responses APIによる構造化読取り。
 * 関連ファイル／構成: supabase/config.toml、tools/land-report-import.mjs。
 * 更新日: 2026-09-06
 * メンテナンスメモ: APIキーはSupabase Secretsだけに登録し、画像・解析結果はこの関数で保存しない。
 */

const ALLOWED_ORIGIN = 'https://kumaneko51.github.io';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Json = Record<string, unknown>;

function jsonResponse_(body: Json, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}

function text_(value: unknown, limit = 80): string | null {
  const text = String(value ?? '').trim();
  return text && text.length <= limit ? text : null;
}

function integer_(value: unknown, min = 0, max = 999999): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function validateCandidate_(value: unknown): { candidate: Json; warnings: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('解析結果の形式が不正です。');
  const source = value as Json;
  const warnings: string[] = [];
  const team = Array.isArray(source.team) ? source.team.map((name) => text_(name, 40)) : [];
  const levels = Array.isArray(source.levels) ? source.levels.map((level) => integer_(level, 1, 100)) : [];
  const result = text_(source.result, 10);
  const troops = integer_(source.troops);
  const dead = integer_(source.dead);
  const wounded = integer_(source.wounded);
  const remaining = integer_(source.remaining);
  const enemyTroops = integer_(source.enemyTroops);
  const enemyRemaining = integer_(source.enemyRemaining);

  if (team.length !== 3 || team.some((name) => !name)) warnings.push('部隊名3名を確認してください。');
  if (levels.length !== 3 || levels.some((level) => level === null)) warnings.push('武将レベル3名を確認してください。');
  if (!['勝利', '引分', '敗北'].includes(result || '')) warnings.push('勝敗を確認してください。');
  if ([troops, dead, wounded, remaining].some((number) => number === null)) {
    warnings.push('自軍兵数を確認してください。');
  } else if (troops !== dead + wounded + remaining) {
    warnings.push('自軍兵数の合計（残兵＋戦死＋負傷）が開始兵数と一致しません。');
  }
  if (enemyRemaining !== null && enemyTroops !== null && enemyRemaining > enemyTroops) warnings.push('敵残兵数が敵開始兵数を超えています。');

  return {
    candidate: {
      author: text_(source.author, 40),
      result: ['勝利', '引分', '敗北'].includes(result || '') ? result : null,
      landLevel: integer_(source.landLevel, 1, 20),
      team,
      levels,
      troops,
      dead,
      wounded,
      remaining,
      enemyName: text_(source.enemyName, 80),
      enemyLevel: integer_(source.enemyLevel, 1, 100),
      enemyTroops,
      enemyRemaining,
      season: text_(source.season, 40),
      notes: text_(source.notes, 300)
    },
    warnings
  };
}

async function authenticatedUser_(request: Request): Promise<{ id: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('authorization') || '';
  if (!supabaseUrl || !anonKey || !authorization.startsWith('Bearer ')) throw new Error('ログイン情報を確認できません。');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization }
  });
  if (!response.ok) throw new Error('ログインが必要です。');
  return response.json();
}

async function assertOwner_(familyId: string, userId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('サーバー設定を確認できません。');
  const query = new URLSearchParams({
    select: 'role',
    family_id: `eq.${familyId}`,
    user_id: `eq.${userId}`,
    role: 'eq.owner',
    limit: '1'
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/family_members?${query}`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
  });
  const rows = await response.json();
  if (!response.ok || !Array.isArray(rows) || rows.length !== 1) throw new Error('この一門の登録権限がありません。');
}

function imageDataUrl_(body: Json): string {
  const image = body.image;
  if (!image || typeof image !== 'object' || Array.isArray(image)) throw new Error('画像を指定してください。');
  const { base64, mimeType } = image as Json;
  const mime = String(mimeType || '');
  const encoded = String(base64 || '').replace(/\s/g, '');
  if (!['image/png', 'image/jpeg'].includes(mime)) throw new Error('PNGまたはJPEG画像を指定してください。');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('画像データの形式が正しくありません。');
  const bytes = Math.floor((encoded.length * 3) / 4);
  if (bytes === 0 || bytes > MAX_IMAGE_BYTES) throw new Error('画像は5MB以下にしてください。');
  return `data:${mime};base64,${encoded}`;
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    author: { type: ['string', 'null'] }, result: { type: ['string', 'null'] }, landLevel: { type: ['integer', 'null'] },
    team: { type: 'array', items: { type: ['string', 'null'] } }, levels: { type: 'array', items: { type: ['integer', 'null'] } },
    troops: { type: ['integer', 'null'] }, dead: { type: ['integer', 'null'] }, wounded: { type: ['integer', 'null'] }, remaining: { type: ['integer', 'null'] },
    enemyName: { type: ['string', 'null'] }, enemyLevel: { type: ['integer', 'null'] }, enemyTroops: { type: ['integer', 'null'] }, enemyRemaining: { type: ['integer', 'null'] },
    season: { type: ['string', 'null'] }, notes: { type: ['string', 'null'] }
  },
  required: ['author', 'result', 'landLevel', 'team', 'levels', 'troops', 'dead', 'wounded', 'remaining', 'enemyName', 'enemyLevel', 'enemyTroops', 'enemyRemaining', 'season', 'notes']
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse_({}, 204);
  if (request.method !== 'POST') return jsonResponse_({ error: 'POSTメソッドで呼び出してください。' }, 405);
  try {
    const body = await request.json() as Json;
    const familyId = String(body.familyId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(familyId)) return jsonResponse_({ error: '一門IDの形式が正しくありません。' }, 400);
    const user = await authenticatedUser_(request);
    await assertOwner_(familyId, user.id);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('LAND_REPORT_VISION_MODEL');
    if (!apiKey || !model) throw new Error('画像読取りAPIはまだ設定されていません。');
    const imageUrl = imageDataUrl_(body);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        instructions: '画像は信長の野望・真戦の土地戦報です。読めない項目はnullにし、推測で埋めないでください。teamとlevelsは左から3名の配列として返してください。勝敗は勝利・引分・敗北のいずれかです。数値は整数だけを返してください。',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'この戦報を指定のJSON形式で読み取ってください。' }, { type: 'input_image', image_url: imageUrl, detail: 'high' }] }],
        text: { format: { type: 'json_schema', name: 'land_report', strict: true, schema } }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(String(data?.error?.message || '画像読取りに失敗しました。'));
    const parsed = JSON.parse(String(data?.output_text || ''));
    return jsonResponse_(validateCandidate_(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : '画像読取りでエラーが発生しました。';
    return jsonResponse_({ error: message }, message.includes('権限') || message.includes('ログイン') ? 403 : 400);
  }
});
