// Inline Google Fonts as data-URI @font-face rules (latin subset, woff2).
import fs from 'fs';

const file = process.argv[2];
let html = fs.readFileSync(file, 'utf8');
const m = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)" rel="stylesheet">/);
if (!m) { console.log('no fonts link found'); process.exit(0); }
const cssUrl = m[1].replace(/&amp;/g, '&');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();

// keep only latin-subset blocks (they carry U+0000-00FF)
const blocks = css.split('@font-face').slice(1).map(b => '@font-face' + b.slice(0, b.indexOf('}') + 1));
const latin = blocks.filter(b => /unicode-range:[^;]*U\+0000-00FF/.test(b));
let out = '';
let total = 0;
for (let b of latin) {
  const u = b.match(/url\((https:[^)]+\.woff2)\)/);
  if (!u) continue;
  const buf = Buffer.from(await (await fetch(u[1])).arrayBuffer());
  total += buf.length;
  b = b.replace(u[1], 'data:font/woff2;base64,' + buf.toString('base64'));
  b = b.replace(/unicode-range:[^;]+;/, '');
  out += b + '\n';
}
html = html.replace(/<link rel="preconnect"[^>]+>\n?/g, '');
html = html.replace(m[0], '<style>\n' + out + '</style>');
fs.writeFileSync(file, html);
console.log('inlined', latin.length, 'faces,', Math.round(total / 1024) + 'KB fonts, ->', file);
