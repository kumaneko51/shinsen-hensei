/*
 * アプリの概要: Qookkaの公開スナップショットを日本語版編成アプリ用に変換するEdge Function。
 * 主な機能: snapshot_idの検証、公開API取得、武将・戦法IDを名称付き一覧として返却する。
 * 関連ファイル／構成: supabase/config.toml、index.html、master.json。
 * 更新日: 2026-08-30
 * 更新履歴:
 *   - 2026-08-30: 初版。Qookka公開スナップショットの所持品取込を追加。
 *   - 2026-08-30: 公開設定の翻訳表を参照し、武将・戦法名を日本語化。
 * メンテナンスメモ:
 *   - Qookka側の公開仕様が変わった場合は、QOOKKA_API_URLとレスポンス解析を更新する。
 *   - 個人情報・認証情報は受け取らず、公開snapshot_idだけを外部APIへ送る。
 */

const CONFIG = {
  QOOKKA_API_URL: 'https://p11386-platform.qookkagames.com/sns/web/api/cache/get_player_share_snapshot',
  QOOKKA_CONFIG_URL: 'https://p11386-media-cdn.qookkagames.com/P11386/sns/public_config/release/cfg.json',
  GAME_ID: 's11',
  ALLOWED_ORIGIN: 'https://kumaneko51.github.io'
};

/**
 * CORSを含むJSONレスポンスを作成する。
 * @param {object} body 応答本文。
 * @param {number} status HTTPステータス。
 * @returns {Response} HTTPレスポンス。
 */
function jsonResponse_(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': CONFIG.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}

/**
 * Qookka APIのレスポンスをJSONとして取得する。
 * @param {string} url 取得先URL。
 * @returns {Promise<any>} JSONデータ。
 */
async function fetchJson_(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Origin: CONFIG.ALLOWED_ORIGIN,
      Referer: `${CONFIG.ALLOWED_ORIGIN}/`
    }
  });
  if (!response.ok) throw new Error(`外部データの取得に失敗しました: ${response.status}`);
  return response.json();
}

/**
 * 文字列を外部APIのURLパラメータ用に符号化する。
 * @param {object} value 符号化する値。
 * @returns {string} URLエンコード済みJSON。
 */
function encodeQuery_(value: object): string {
  return encodeURIComponent(JSON.stringify(value));
}

/**
 * snapshot APIの配列から指定ビューのプレイヤーデータを取り出す。
 * @param {any[]} entries 外部APIのdata配列。
 * @param {string} viewName data_view_type。
 * @returns {any} 該当するプレイヤーデータ。
 */
function findViewData_(entries: any[], viewName: string): any {
  const entry = entries.find((item) => item?.selector?.data_view_type === viewName);
  return entry?.player_data || {};
}

/**
 * Qookka設定の翻訳表から、日本語名を内部名で引ける辞書を作成する。
 * @param {any[]} translations 公開設定の多言語翻訳表。
 * @returns {Record<string, string>} 内部名と日本語名の対応表。
 */
function buildJapaneseNameMap_(translations: any[]): Record<string, string> {
  const japaneseNames: Record<string, string> = {};
  (Array.isArray(translations) ? translations : []).forEach((item) => {
    if (item?.id && item?.ja) japaneseNames[String(item.id)] = String(item.ja);
  });
  return japaneseNames;
}

/**
 * Qookka設定から所持IDを日本語名称付きの安全な最小データへ変換する。
 * @param {any[]} owned 所持データ。
 * @param {any[]} definitions 設定マスター。
 * @param {Record<string, string>} japaneseNames 内部名と日本語名の対応表。
 * @returns {Array<{id: string, name: string}>} 名称付き所持データ。
 */
function resolveOwnedNames_(owned: any[], definitions: any[], japaneseNames: Record<string, string>): Array<{ id: string; name: string }> {
  const namesById: Record<string, string> = {};
  definitions.forEach((item) => {
    const internalName = String(item.name || item.show_name || '');
    namesById[String(item.id)] = japaneseNames[internalName] || String(item.show_name || item.name || '');
  });
  return owned.map((item) => {
    const id = String(item?.type || item?.id || '');
    return { id, name: namesById[id] || '' };
  }).filter((item) => item.id && item.name);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse_({}, 204);
  if (request.method !== 'POST') return jsonResponse_({ error: 'POSTメソッドで呼び出してください。' }, 405);

  try {
    const body = await request.json();
    const snapshotId = String(body?.snapshotId || '');
    if (!/^[a-f0-9]{24}$/i.test(snapshotId)) return jsonResponse_({ error: 'snapshot_idの形式が正しくありません。' }, 400);

    const selectors = [
      { selector_type: 'view', data_view_type: 'hero' },
      { selector_type: 'view', data_view_type: 'skill' }
    ];
    const snapshotUrl = `${CONFIG.QOOKKA_API_URL}?_json=${encodeQuery_({ game_id: CONFIG.GAME_ID, selectors, snapshot_id: snapshotId })}`;
    const [snapshot, config] = await Promise.all([fetchJson_(snapshotUrl), fetchJson_(CONFIG.QOOKKA_CONFIG_URL)]);
    if (snapshot?.code !== 0 || !Array.isArray(snapshot?.data)) return jsonResponse_({ error: '公開スナップショットを読み込めませんでした。' }, 422);

    const japaneseNames = buildJapaneseNameMap_(config?.multi_lang || []);
    const heroes = resolveOwnedNames_(findViewData_(snapshot.data, 'hero').heros || [], config?.hero || [], japaneseNames);
    const skills = resolveOwnedNames_(findViewData_(snapshot.data, 'skill').skills || [], config?.skill || [], japaneseNames);
    return jsonResponse_({ heroes, skills, summary: { heroCount: heroes.length, skillCount: skills.length } });
  } catch (error) {
    return jsonResponse_({ error: error instanceof Error ? error.message : '取込処理でエラーが発生しました。' }, 500);
  }
});
