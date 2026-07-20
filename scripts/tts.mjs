// teach-me voice pipeline.
// Usage: node scripts/tts.mjs <lesson.raw.html> [voiced-out.html]
//   - Parses the page's own `var LINES={...}` map (single source of truth).
//   - Generates one MP3 per line (OpenAI gpt-4o-mini-tts), applies TTS_SPEED via ffmpeg atempo,
//     caches in ./audio/, embeds as data URIs by replacing `/*__VOICE__*/{}`.
//   - Env: OPENAI_API_KEY (or a .env beside the lesson). Optional: TTS_VOICE (default "ash"),
//     TTS_SPEED (default 1.25), TTS_INSTRUCTIONS (delivery note for the voice).
//   - No key -> exits 0 with a note; build the silent lesson.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const file = process.argv[2];
if (!file) { console.error('usage: node tts.mjs <lesson.raw.html> [out.html]'); process.exit(1); }
const dir = path.dirname(path.resolve(file));
const out = process.argv[3] || path.join(dir, path.basename(file).replace('.raw.html', '.voiced.html'));

let KEY = process.env.OPENAI_API_KEY;
const envPath = path.join(dir, '.env');
if (!KEY && fs.existsSync(envPath)) {
  const m = fs.readFileSync(envPath, 'utf8').match(/OPENAI_API_KEY=(\S+)/);
  if (m) KEY = m[1];
}
if (!KEY) { console.log('no OPENAI_API_KEY — skipping voice; build the silent lesson.'); process.exit(0); }

const VOICE = process.env.TTS_VOICE || 'ash';
const SPEED = parseFloat(process.env.TTS_SPEED || '1.25');
const INSTR = process.env.TTS_INSTRUCTIONS ||
  'Calm, warm teacher. Documentary-calm delivery: measured, clear, quietly engaged. Domain tokens crisp.';

const raw = fs.readFileSync(file, 'utf8');
const m = raw.match(/var LINES=(\{[\s\S]*?\n\});/);
if (!m) throw new Error('LINES map not found in ' + file);
const LINES = new Function('return ' + m[1])();

const audioDir = path.join(dir, 'audio');
fs.mkdirSync(audioDir, { recursive: true });

for (const [id, text] of Object.entries(LINES)) {
  const outFast = path.join(audioDir, id + '.mp3');
  if (fs.existsSync(outFast)) { console.log('skip', id); continue; }
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: VOICE, input: text, instructions: INSTR, response_format: 'mp3' })
  });
  if (!res.ok) throw new Error(id + ' HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300));
  const rawMp3 = path.join(audioDir, id + '.raw.mp3');
  fs.writeFileSync(rawMp3, Buffer.from(await res.arrayBuffer()));
  execSync(`ffmpeg -y -loglevel error -i "${rawMp3}" -filter:a atempo=${SPEED} -ac 1 -b:a 64k "${outFast}"`);
  fs.unlinkSync(rawMp3);
  console.log('ok', id, Math.round(fs.statSync(outFast).size / 1024) + 'KB');
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
