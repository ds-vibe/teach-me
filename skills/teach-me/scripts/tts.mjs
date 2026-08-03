// teach-me voice pipeline.
// Usage: node scripts/tts.mjs <lesson.raw.html> [voiced-out.html]
//   - Parses the page's own `var LINES={...}` map (single source of truth).
//   - Generates one MP3 per line, applies TTS_SPEED via ffmpeg atempo,
//     caches in ./audio/ keyed by a hash of (engine|voice|speed|text) in
//     audio/.cache.json — a rewritten line regenerates; id-only caches
//     serve stale audio after narration edits. Embeds as data URIs
//     by replacing `/*__VOICE__*/{}`.
//   - Engine detection (override with TTS_ENGINE=openai|elevenlabs):
//       OPENAI_API_KEY present     -> OpenAI gpt-4o-mini-tts (default voice "ash")
//       ELEVENLABS_API_KEY present -> ElevenLabs (default voice "Rachel")
//       neither                    -> exits 0 with a note; build the silent lesson
//         (the in-page engine still gives browser TTS).
//   - Env: TTS_ENGINE, TTS_VOICE, TTS_VOICE_ID (ElevenLabs voice id),
//     TTS_MODEL, TTS_SPEED (default 1.25), TTS_INSTRUCTIONS (OpenAI only).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

// Flags are stripped first so the positional args keep their meaning.
const argv = process.argv.slice(2);
const flagAt = argv.indexOf('--key-file');
let KEY_FILE = null;
if (flagAt !== -1) { KEY_FILE = argv[flagAt + 1]; argv.splice(flagAt, 2); }

const file = argv[0];
if (!file) { console.error('usage: node tts.mjs <lesson.raw.html> [out.html] [--key-file <path>]'); process.exit(1); }
const dir = path.dirname(path.resolve(file));
const out = argv[1] || path.join(dir, path.basename(file).replace('.raw.html', '.voiced.html'));

// A key never arrives through the conversation — it comes from the environment, from a
// .env the user wrote, or from any file named with --key-file (dotfiles are awkward to
// upload on some surfaces). The file may hold OPENAI_API_KEY=… or the bare key. Never
// print the value.
function envCandidates(start) {
  const list = [];
  let d = path.resolve(start);
  for (let i = 0; i < 6; i++) { list.push(path.join(d, '.env')); const up = path.dirname(d); if (up === d) break; d = up; }
  return list;
}
let KEY = process.env.OPENAI_API_KEY;
let EL_KEY = process.env.ELEVENLABS_API_KEY;
for (const p of [KEY_FILE, ...envCandidates(dir), ...envCandidates(process.cwd())]) {
  if (!p || !fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  if (!KEY) { const m = txt.match(/OPENAI_API_KEY\s*=\s*(\S+)/) || txt.trim().match(/^(sk-\S+)$/); if (m) KEY = m[1]; }
  if (!EL_KEY) { const m = txt.match(/ELEVENLABS_API_KEY\s*=\s*(\S+)/); if (m) EL_KEY = m[1]; }
}
if (KEY_FILE && !fs.existsSync(KEY_FILE)) { console.error(`--key-file not found: ${KEY_FILE}`); process.exit(1); }

let ENGINE = process.env.TTS_ENGINE;
if (!ENGINE) ENGINE = KEY ? 'openai' : (EL_KEY ? 'elevenlabs' : 'none');
if (ENGINE === 'openai' && !KEY) { console.error('TTS_ENGINE=openai but no OPENAI_API_KEY.'); process.exit(1); }
if (ENGINE === 'elevenlabs' && !EL_KEY) { console.error('TTS_ENGINE=elevenlabs but no ELEVENLABS_API_KEY.'); process.exit(1); }
if (ENGINE === 'none') {
  console.log('no OPENAI_API_KEY or ELEVENLABS_API_KEY — skipping produced voice.');
  console.log('The lesson still speaks via browser TTS (SKILL.md X.1 degrade ladder).');
  process.exit(0);
}

const VOICE = process.env.TTS_VOICE || (ENGINE === 'openai' ? 'ash' : 'Rachel');
// ElevenLabs addresses voices by id; TTS_VOICE_ID overrides, else a few known defaults.
const EL_VOICES = { Rachel: '21m00Tcm4TlvDq8ikWAM', Adam: 'pNInz6obpgDQGcFmaJgB', Bella: 'EXAVITQu4vr4xnSDxMaL' };
const EL_VOICE_ID = process.env.TTS_VOICE_ID || EL_VOICES[VOICE] || VOICE;
const EL_MODEL = process.env.TTS_MODEL || 'eleven_multilingual_v2';
const SPEED = parseFloat(process.env.TTS_SPEED || '1.25');
const INSTR = process.env.TTS_INSTRUCTIONS ||
  'Calm, warm teacher. Documentary-calm delivery: measured, clear, quietly engaged. Domain tokens crisp.';
console.log(`engine: ${ENGINE} (voice ${ENGINE === 'openai' ? VOICE : VOICE + '/' + EL_VOICE_ID} @ ${SPEED}x)`);

const raw = fs.readFileSync(file, 'utf8');
// Feedback lines are wired into LINES at page runtime (wireVoice), so a static parse
// misses them and feedback audio silently drops to the browser voice. Load the page
// headless and read the finished map; fall back to the static parse without Playwright.
async function collectRuntimeLines() {
  try {
    const { chromium } = await import('playwright');
    const { MUTE_ARGS, muteSpeech } = await import('./mute.mjs');
    const b = await chromium.launch({ args: MUTE_ARGS });
    const pg = await b.newPage();
    await muteSpeech(pg);
    await pg.goto('file://' + path.resolve(file), { waitUntil: 'load' });
    await pg.waitForTimeout(400);
    const lines = await pg.evaluate(() => {
      const out = {};
      for (const [k, v] of Object.entries(window.LINES || {}))
        if (typeof v === 'string' && v.trim()) out[k] = v.replace(/<[^>]+>/g, '');
      return out;
    });
    await b.close();
    if (Object.keys(lines).length) return lines;
  } catch (e) { console.log('headless pass unavailable — static LINES only (' + String(e).slice(0, 60) + ')'); }
  return null;
}
const m = raw.match(/var LINES=(\{[\s\S]*?\});/);
if (!m) throw new Error('LINES map not found in ' + file);
// Evaluating the map runs code from the HTML file — refuse anything beyond a
// plain object literal of string values, so running tts.mjs on a lesson you
// didn't author can't execute arbitrary code.
const stripped = m[1].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
if (!/^[\s{}:,"a-zA-Z0-9_$]*$/.test(stripped)) {
  throw new Error('LINES map contains more than plain string values — refusing to evaluate untrusted code.');
}
const staticLINES = new Function('return ' + m[1])();
const LINES = (await collectRuntimeLines()) || staticLINES;
console.log(Object.keys(LINES).length + ' lines to voice (runtime-wired included)');

const audioDir = path.join(dir, 'audio');
fs.mkdirSync(audioDir, { recursive: true });

// Cache keyed by CONTENT, not just line id — an id-only check serves stale audio
// after narration rewrites, and only Whisper verification would catch it.
const cachePath = path.join(audioDir, '.cache.json');
let cache = {};
if (fs.existsSync(cachePath)) { try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { cache = {}; } }
const lineHash = text =>
  crypto.createHash('sha1').update([ENGINE, ENGINE === 'openai' ? VOICE : EL_VOICE_ID + '|' + EL_MODEL, SPEED, ENGINE === 'openai' ? INSTR : '', text].join('|')).digest('hex');
const saveCache = () => fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1));

/* ---------------------------------------------------------------------
   Generation: bounded concurrency + backoff.

   A full-feedback lesson is 40-60 clips. Serially that is minutes of dead
   wall clock; unbounded it trips provider rate limits and the whole build
   dies partway with half an audio directory. TTS_CONCURRENCY (default 5)
   requests are in flight at once, a 429 or 5xx is retried with exponential
   backoff honouring Retry-After, and only a line that fails every attempt
   aborts the run.
   --------------------------------------------------------------------- */
const CONCURRENCY = Math.max(1, Number(process.env.TTS_CONCURRENCY || 5));
const MAX_RETRY = Number(process.env.TTS_MAX_RETRY || 5);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchClip(id, text, attempt = 0) {
  const req = ENGINE === 'openai'
    ? ['https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: VOICE, input: text, instructions: INSTR, response_format: 'mp3' })
      }]
    : [`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}`, {
        method: 'POST',
        headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: EL_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
      }];

  let res;
  try {
    res = await fetch(...req);
  } catch (e) {                                   // transport blip — same backoff path
    if (attempt >= MAX_RETRY) throw new Error(id + ' network: ' + String(e).slice(0, 160));
    await sleep(Math.min(30000, 800 * 2 ** attempt));
    return fetchClip(id, text, attempt + 1);
  }

  if (res.ok) return Buffer.from(await res.arrayBuffer());

  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt < MAX_RETRY) {
    const ra = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(30000, 800 * 2 ** attempt);
    console.log(`  retry ${id} — HTTP ${res.status}, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRY})`);
    await sleep(waitMs);
    return fetchClip(id, text, attempt + 1);
  }
  throw new Error(id + ' HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300));
}

const pending = [];
for (const [id, text] of Object.entries(LINES)) {
  const outFast = path.join(audioDir, id + '.mp3');
  const h = lineHash(text);
  if (fs.existsSync(outFast) && cache[id] === h) { console.log('skip', id); continue; }
  if (fs.existsSync(outFast)) console.log('regen', id, cache[id] ? '(text or voice settings changed)' : '(no cache record — pre-hash file)');
  pending.push({ id, text, h, outFast });
}

if (pending.length) {
  console.log(`generating ${pending.length} clip(s), ${CONCURRENCY} at a time`);
  let next = 0, done = 0;
  const failures = [];
  const worker = async () => {
    while (next < pending.length) {
      const { id, text, h, outFast } = pending[next++];
      const tmp = path.join(audioDir, id + '.raw.mp3');
      try {
        fs.writeFileSync(tmp, await fetchClip(id, text));
        // ffmpeg is sync and CPU-bound; it serialises naturally against the
        // in-flight fetches, which is what keeps this from thrashing.
        execSync(`ffmpeg -y -loglevel error -i "${tmp}" -filter:a atempo=${SPEED} -ac 1 -b:a 64k "${outFast}"`);
        fs.unlinkSync(tmp);
        cache[id] = h; saveCache();
        console.log(`ok ${id} ${Math.round(fs.statSync(outFast).size / 1024)}KB  (${++done}/${pending.length})`);
      } catch (e) {
        try { fs.existsSync(tmp) && fs.unlinkSync(tmp); } catch {}
        failures.push(String(e.message || e));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  if (failures.length) {
    console.error(`\n${failures.length} clip(s) failed:\n  ` + failures.join('\n  '));
    throw new Error('TTS incomplete — rerun to pick up only the missing lines (the cache keeps the rest).');
  }
}

const map = {};
let total = 0;
for (const id of Object.keys(LINES)) {
  const b = fs.readFileSync(path.join(audioDir, id + '.mp3'));
  total += b.length;
  map[id] = 'data:audio/mpeg;base64,' + b.toString('base64');
}
fs.writeFileSync(out, raw.replace('/*__VOICE__*/{}', JSON.stringify(map)));
console.log('EMBEDDED', Object.keys(map).length, 'lines,', Math.round(total / 1024) + 'KB ->', out);
