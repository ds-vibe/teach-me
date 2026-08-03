#!/usr/bin/env node
/* images.mjs — generate the lesson's photographs.
 *
 * Same contract as tts.mjs, one channel over: the page declares an IMGPROMPTS map
 * of {id: "prompt"} and an IMAGES stub `/*__IMG__* /{}`. This fills the stub with
 * {id: "data:image/webp;base64,…"} so the finished lesson stays self-contained.
 *
 *   node images.mjs <lesson.raw.html> [out.html] [--key-file <path>] [--quality low|medium|high]
 *
 * Generated images are cached in ./images/ by a hash of (model|quality|size|prompt),
 * so re-running after an edit only regenerates the prompts that changed.
 *
 * Never blocks a build: with no key it says so and leaves the stub alone, and the
 * page falls back to whatever its CSS placeholder is.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = argv[i + 1]; argv.splice(i, 2); return v;
}
const KEY_FILE = flag('key-file', null);
const QUALITY = flag('quality', 'medium');
const SIZE = flag('size', '1024x1024');
const MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';

// Shared below. Wikimedia 400s a bare tool name. Licences: PD/CC0/CC BY in, rest out.
const UA = { 'user-agent': 'teach-me-lesson-build/1.0 (+https://github.com/ds-vibe/teach-me) node-fetch' };
const strip = (v) => String(v || '').replace(/<[^>]+>/g, '').trim().slice(0, 70);
const licFree = (l) => /^(public domain|pd|cc0)/i.test(l);
const licBY = (l) => /^cc[ -]?by/i.test(l) && !/by[-\s]?sa/i.test(l);
const licOK = (l) => licFree(l) || licBY(l);

// --search "query": usable Commons candidates, so nobody guesses a filename.
const SEARCH = flag('search', null);
if (SEARCH) {
  const j = await (await fetch('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=extmetadata|mime&format=json&gsrsearch=' + encodeURIComponent(SEARCH), { headers: UA })).json();
  for (const pg of Object.values(j.query?.pages || {})) {
    const ii = pg.imageinfo?.[0], lic = strip(ii?.extmetadata?.LicenseShortName?.value);
    if (!/^image\//.test(ii?.mime || '') || !licOK(lic)) continue;
    console.log(`${lic.padEnd(15)} https://commons.wikimedia.org/wiki/Special:FilePath/${pg.title.slice(5)}?width=800`
      + (licBY(lic) ? `\n${' '.repeat(16)}credit: ${strip(ii.extmetadata?.Artist?.value)}, ${lic}` : ''));
  }
  process.exit(0);
}

const file = argv[0];
if (!file) { console.error('usage: node images.mjs <lesson.raw.html> [out.html] [--key-file <path>] [--quality medium]'); process.exit(1); }
const dir = path.dirname(path.resolve(file));
const out = argv[1] || file;

// Key: environment, then a .env the user wrote (searched up from the lesson folder to
// the repo root), then --key-file. Never from a conversation.
function envCandidates(start) {
  const list = [];
  let d = path.resolve(start);
  for (let i = 0; i < 6; i++) { list.push(path.join(d, '.env')); const up = path.dirname(d); if (up === d) break; d = up; }
  return list;
}
let KEY = process.env.OPENAI_API_KEY;
for (const p of [KEY_FILE, ...envCandidates(dir), ...envCandidates(process.cwd())]) {
  if (KEY || !p || !fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  const m = txt.match(/OPENAI_API_KEY\s*=\s*(\S+)/) || txt.trim().match(/^(sk-\S+)$/);
  if (m) KEY = m[1];
}

let html = fs.readFileSync(file, 'utf8');
const mapMatch = html.match(/var\s+IMGPROMPTS\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (!mapMatch) { console.error('no IMGPROMPTS map found in ' + file); process.exit(1); }

const prompts = {};
for (const m of mapMatch[1].matchAll(/(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
  prompts[m[1]] = m[2].replace(/\\"/g, '"');
}
const ids = Object.keys(prompts);
console.log(`${ids.length} images declared`);

/* A value that is a URL is FETCHED, not generated — the escape hatch for a topic
   whose subject is a real person, company or event, where an invented picture is
   the wrong answer. Use a public-domain or openly-licensed source; it is embedded
   like any other image, so the lesson stays self-contained. */
const isUrl = (v) => /^https?:\/\//i.test(v);
const needsKey = ids.filter(id => !isUrl(prompts[id]));

if (!KEY && needsKey.length) {
  console.log('no OPENAI_API_KEY — leaving the stub empty; the page keeps its CSS placeholder.');
  process.exit(0);
}

const cacheDir = path.join(dir, 'images');
fs.mkdirSync(cacheDir, { recursive: true });
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

const results = {};
const mimes = {};                     // fetched files keep their own type; generated are webp
let made = 0, cached = 0, fetched = 0;
const credits = [];
const refused = [];
for (const id of ids) {
  if (isUrl(prompts[id])) {
    const url = prompts[id];
    const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp|gif)$/i) || [, 'webp'])[1].toLowerCase();
    const mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
    const cachePath = path.join(cacheDir, hash(url) + '.' + ext);
    const metaPath = cachePath + '.lic.json';
    if (fs.existsSync(cachePath)) {
      results[id] = fs.readFileSync(cachePath).toString('base64'); mimes[id] = mime; cached++;
      /* Restore the licence from the sidecar: on a cache hit the API is never called,
         and without this a rebuild would quietly skip the attribution gate. */
      try {
        const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (m.by) credits.push({ id, lic: m.lic, who: m.who, url });
      } catch {}
      continue;
    }
    process.stdout.write(`  ${id} ← ${url.slice(0, 48)} … `);
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) { console.log('FAILED ' + r.status); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(cachePath, buf);
      results[id] = buf.toString('base64'); mimes[id] = mime; fetched++;
      console.log(`${Math.round(buf.length / 1024)}KB`);
      // Commons is not uniformly PD — check before embedding.
      const wm = url.match(/Special:FilePath\/([^?]+)/);
      if (wm) {
        try {
          const api = 'https://commons.wikimedia.org/w/api.php?action=query&titles=File:'
            + wm[1] + '&prop=imageinfo&iiprop=extmetadata&format=json';
          /* One retry: this lookup fails transiently, and the failure path drops the
             image, so a network blip must not cost a legitimate picture. */
          let j = null;
          for (let a = 0; a < 2 && !j; a++) {
            try {
              const rr = await fetch(api, { headers: UA });
              const tt = await rr.text();
              const parsed = JSON.parse(tt);
              if (parsed?.query?.pages) j = parsed;
            } catch {}
            if (!j && a === 0) await new Promise(r => setTimeout(r, 700));
          }
          if (!j) throw new Error('licence lookup failed twice');
          const e = Object.values(j.query.pages)[0]?.imageinfo?.[0]?.extmetadata || {};
          const lic = strip(e.LicenseShortName?.value) || 'UNKNOWN';
          const who = strip(e.Artist?.value) || 'unknown author';
          /* Allowlist: Public Domain, CC0, CC BY. CC BY-SA is refused on purpose —
             share-alike scares people off reusing the lesson — as is anything whose
             terms we could not read. Refused files are dropped, not just flagged. */
          if (!licOK(lic)) {
            delete results[id]; delete mimes[id]; fetched--;
            try { fs.unlinkSync(cachePath); } catch {}
            refused.push({ id, lic, url });
            console.log(`     licence: ${lic} — REFUSED (allowed: Public Domain, CC0, CC BY)`);
          } else if (licBY(lic)) {
            credits.push({ id, lic, who, url });
            fs.writeFileSync(metaPath, JSON.stringify({ lic, who, by: true }));
            console.log(`     licence: ${lic} — CREDIT REQUIRED: “${who}, ${lic}”`);
          } else {
            fs.writeFileSync(metaPath, JSON.stringify({ lic, who, by: false }));
            console.log(`     licence: ${lic}`);
          }
        } catch (err) {
          /* Fail CLOSED. Embedding a picture whose terms nobody could read is the
             one outcome worse than losing it — a transient API blip used to ship
             an unknown-licence image silently. */
          delete results[id]; delete mimes[id]; fetched--;
          try { fs.unlinkSync(cachePath); } catch {}
          refused.push({ id, lic: 'unreadable licence', url });
          console.log('     licence: COULD NOT READ — dropped (' + err.message.slice(0, 60) + ')');
        }
      }
    } catch (e) { console.log('FAILED ' + e.message.slice(0, 80)); }
    continue;
  }
  const key = hash([MODEL, QUALITY, SIZE, prompts[id]].join('|'));
  const cachePath = path.join(cacheDir, key + '.webp');
  if (fs.existsSync(cachePath)) {
    results[id] = fs.readFileSync(cachePath).toString('base64'); cached++; continue;
  }
  process.stdout.write(`  ${id} … `);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
    body: JSON.stringify({
      model: MODEL, prompt: prompts[id], n: 1, size: SIZE, quality: QUALITY,
      output_format: 'webp', output_compression: 70,
    }),
  });
  if (!res.ok) { console.log('FAILED ' + res.status + ' ' + (await res.text()).slice(0, 200)); continue; }
  const data = await res.json();
  const b64 = data.data[0].b64_json;
  fs.writeFileSync(cachePath, Buffer.from(b64, 'base64'));
  results[id] = b64; made++;
  console.log(`${Math.round(Buffer.from(b64, 'base64').length / 1024)}KB`);
}

const literal = '{' + Object.entries(results)
  .map(([k, v]) => `${k}:"data:${mimes[k] || 'image/webp'};base64,${v}"`).join(',') + '}';
html = html.replace(/\/\*__IMG__\*\/\{\}/, '/*__IMG__*/' + literal);
fs.writeFileSync(out, html);

const bytes = Object.values(results).reduce((a, v) => a + Buffer.from(v, 'base64').length, 0);
console.log(`\n${made} generated, ${fetched} fetched, ${cached} from cache → ${out}`);
console.log(`embedded ${(bytes / 1024 / 1024).toFixed(2)} MB of images (XI.1 budget for the whole lesson is ~15 MB)`);
if (refused.length) {
  console.log('\nREFUSED — licence outside the allowed set (Public Domain, CC0, CC BY):');
  for (const c of refused) console.log(`  ${c.id}: ${c.lic} — ${c.url}`);
  console.log('  Pick a different file, or draw it instead.');
}

/* Attribution is a condition of CC BY, so verify it landed on the PAGE rather than
   trusting that a printed reminder was acted on. Both the author and the licence
   name have to appear somewhere in the delivered HTML. */
if (credits.length) {
  const flat = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const missing = credits.filter(c => {
    const who = c.who.split(/[,(]/)[0].trim();
    return !(who.length > 2 && flat.includes(who) && flat.replace(/[-\s]/g, '').toLowerCase()
      .includes(c.lic.replace(/[-\s]/g, '').toLowerCase()));
  });
  if (missing.length) {
    console.log('\nATTRIBUTION MISSING from the page — CC BY requires it. Add a caption or credits line:');
    for (const c of missing) console.log(`  ${c.id}: “${c.who}, ${c.lic}” — ${c.url}`);
    process.exit(1);
  }
  console.log(`\nattribution present for ${credits.length} CC BY image(s)`);
}
