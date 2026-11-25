// Build src/ into dist/ for GitHub Pages (served at /leaveplan/). No dependencies.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'dist');
// LF 換行，CSP 雜湊才會和 GitHub Pages 實際送出的位元組一致。
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n');

function renderPage(rel) {
  return read(rel).replace(/<!--#include ([\w.-]+)-->/g, (_, f) => read(f).trimEnd());
}
const PAGES = [['index.html', 'index.html'], ['app/index.html', 'app/index.html'], ['terms/index.html', 'terms/index.html'], ['privacy/index.html', 'privacy/index.html'], ['404.html', '404.html']];

// Content-Security-Policy 以 <meta> 提供（GitHub Pages 無法送 header）。內嵌 script 只允許精確的 SHA-256 雜湊。
function withCSP(html) {
  const hashes = [];
  html.replace(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g, (_, body) => {
    hashes.push(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  });
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'", "manifest-src 'self'", "worker-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`;
  if (!/<head>\n/.test(html)) throw new Error('CSP: <head> not found');
  return html.replace(/<head>\n/, (m) => `${m}${meta}\n`);
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const write = (rel, data) => {
    const p = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  };
  for (const [from, to] of PAGES) write(to, withCSP(renderPage(from)));
  for (const f of ['style.css', 'core.js', 'app.js', 'landing.js', 'manifest.webmanifest']) write(f, read(f));
  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og.png']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  const hash = crypto.createHash('sha256');
  for (const f of ['index.html', 'app/index.html', 'terms/index.html', 'privacy/index.html', 'style.css', 'core.js', 'app.js', 'landing.js']) hash.update(fs.readFileSync(path.join(OUT, f)));
  const version = hash.digest('hex').slice(0, 10);
  write('sw.js', read('sw.js').replace('__VERSION__', version));

  const site = 'https://weeklyship-ai.github.io/leaveplan/';
  const day = new Date().toISOString().slice(0, 10);
  write('.nojekyll', '');
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'terms/', 'privacy/'].map((p) => `  <url><loc>${site}${p}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  console.log(`sw version ${version}`);
  for (const f of ['index.html', 'app/index.html', 'style.css', 'core.js', 'app.js', 'landing.js']) console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1)} KB`);
}
module.exports = { renderPage, PAGES, withCSP };
if (require.main === module) build();
