// 建置出的頁面：CSP 雜湊要涵蓋每段內嵌 script；不能有外部來源；快取鍵要有 slug 前綴。
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(root, 'build.js')], { cwd: root, stdio: 'ignore' });

for (const page of ['index.html', 'app/index.html', 'terms/index.html', 'privacy/index.html', '404.html']) {
  test(`CSP covers inline scripts in dist/${page}`, () => {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    assert.ok(!html.includes('\r'), 'output must use LF line endings');
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
    assert.ok(csp, 'CSP meta missing');
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /connect-src 'self'(;|$)/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.doesNotMatch(csp, /https?:\/\//, 'no external origins allowed');
    const re = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g;
    let m, n = 0;
    while ((m = re.exec(html))) {
      n++;
      const h = crypto.createHash('sha256').update(m[1], 'utf8').digest('base64');
      assert.ok(csp.includes(`'sha256-${h}'`), `inline script #${n} not allowed by CSP`);
    }
    assert.ok(n > 0);
    assert.doesNotMatch(html, /<script[^>]+src="https?:/, 'no external scripts');
    assert.doesNotMatch(html, /\son\w+="/i, 'no inline event handlers');
  });
}

test('每個頁面都有條款與隱私權連結、頁尾署名', () => {
  for (const page of ['index.html', 'app/index.html', 'terms/index.html']) {
    const html = fs.readFileSync(path.join(root, 'dist', page), 'utf8');
    assert.match(html, /\/leaveplan\/terms\//);
    assert.match(html, /\/leaveplan\/privacy\//);
    assert.match(html, /第 02 週作品/);
  }
});

test('storage 與快取名稱都有 leaveplan 前綴', () => {
  const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
  for (const m of app.matchAll(/(?:KEY|THEME) = '([^']+)'/g)) assert.match(m[1], /^leaveplan:/);
  const sw = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
  assert.match(sw, /'leaveplan-' \+ VERSION/);
  assert.doesNotMatch(sw, /__VERSION__/);
});

test('sitemap 與 robots 存在', () => {
  assert.match(fs.readFileSync(path.join(root, 'dist', 'sitemap.xml'), 'utf8'), /weeklyship-ai\.github\.io\/leaveplan\//);
  assert.match(fs.readFileSync(path.join(root, 'dist', 'robots.txt'), 'utf8'), /Sitemap:/);
});
