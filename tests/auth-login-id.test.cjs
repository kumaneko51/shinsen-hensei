const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/function loginIdEmail_\(value\) \{[\s\S]*?\n    \}/);
assert.ok(match, 'loginIdEmail_ が見つかること');

const context = {};
vm.createContext(context);
vm.runInContext(match[0], context);

assert.equal(context.loginIdEmail_('Player_01'), 'player_01@login.shinsen-hensei.invalid');
assert.equal(context.loginIdEmail_(' abc '), 'abc@login.shinsen-hensei.invalid');
assert.equal(context.loginIdEmail_('ab'), '');
assert.equal(context.loginIdEmail_('日本語'), '');
assert.equal(context.loginIdEmail_('contains.dot'), '');
assert.equal(context.loginIdEmail_('a'.repeat(25)), '');

assert.match(html, /data-auth-mode="legacy"/);
assert.match(html, /data-account-login-id-submit/);
assert.doesNotMatch(html, /表示名・メールアドレス・パスワードを入力して登録/);

console.log('login ID auth tests passed');
