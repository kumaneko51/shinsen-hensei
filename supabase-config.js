/*
 * アプリの概要: GitHub Pages から Supabase へ接続する公開設定。
 * 主な機能: ブラウザ用のプロジェクトURLと Publishable key を提供する。
 * 関連ファイル／構成: index.html、supabase/schema.sql、supabase-config.js
 * 更新日: 2026-08-30
 * 更新履歴:
 *   - 2026-08-30: Supabase Publishable key によるクラウド同期接続を追加。
 * メンテナンスメモ:
 *   - Publishable key は RLS を有効にしたブラウザ公開用のキーであり公開可能。
 *   - service_role キー、データベースパスワードは絶対にこのファイルへ保存しない。
 */

window.SUPABASE_CONFIG = {
  url: 'https://mbccwagtnohvdayxghsh.supabase.co',
  publishableKey: 'sb_publishable_QpLN_7V2mS3qB-kGyWP1wA_SPhPBvxp'
};
