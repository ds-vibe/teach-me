// Inline the piano samples into index.src.html -> dist/interval-trainer.html
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, 'index.src.html'), 'utf8');

const samples = {};
for (const f of fs.readdirSync(path.join(dir, 'samples')).sort()) {
  if (!f.endsWith('.mp3')) continue;
  const b = fs.readFileSync(path.join(dir, 'samples', f));
  samples[f.replace('.mp3', '')] = 'data:audio/mpeg;base64,' + b.toString('base64');
}

const out = src.replace('/*__SAMPLES__*/{}', JSON.stringify(samples));
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
const dest = path.join(dir, 'dist', 'interval-trainer.html');
fs.writeFileSync(dest, out);
console.log(dest, (out.length / 1048576).toFixed(2) + ' MB', Object.keys(samples).length + ' samples');
