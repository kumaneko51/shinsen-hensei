const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/function normalizeLoginId_\(value\) \{[\s\S]*?\n    \}\n\n    \/\*\* ログインIDをSupabase内部用の固定アドレスへ安全に変換する。 \*\/\n    async function loginIdEmail_\(value\) \{[\s\S]*?\n    \}/);
assert.ok(match, 'ログインID変換処理が見つかること');

const context = { crypto: webcrypto, TextEncoder, Uint8Array };
vm.createContext(context);
vm.runInContext(match[0], context);

assert.equal(context.normalizeLoginId_(' Player_01 '), 'player_01');
assert.equal(context.normalizeLoginId_('くまねこ51'), 'くまねこ51');
assert.equal(context.normalizeLoginId_('あ'), '');
assert.equal(context.normalizeLoginId_('contains.dot'), '');
assert.equal(context.normalizeLoginId_('a'.repeat(25)), '');

assert.match(html, /data-auth-mode="legacy"/);
assert.match(html, /data-account-login-id-submit/);
assert.doesNotMatch(html, /表示名・メールアドレス・パスワードを入力して登録/);

(async function() {
  const japanese = await context.loginIdEmail_('くまねこ51');
  const repeated = await context.loginIdEmail_('くまねこ51');
  assert.match(japanese, /^[a-f0-9]{64}@id\.kumaneko51\.github\.io$/);
  assert.equal(japanese, repeated);
  assert.equal(await context.loginIdEmail_('contains.dot'), '');
  console.log('login ID auth tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
