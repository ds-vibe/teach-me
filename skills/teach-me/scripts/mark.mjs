// Build instrumentation: stamps wall-clock + cumulative token usage at each phase boundary.
// Tallies the SESSION transcript, which includes main-loop usage (not just subagents).
// Usage: node scripts/mark.mjs "<phase name>"   [run at every phase boundary]
//   TRANSCRIPT=/path/to.jsonl node scripts/mark.mjs "QA"   to force a transcript.
//   LOG=/path/build-log.json  to choose where marks accumulate (default: ./build-log.json).
import fs from 'fs';
import os from 'os';
import path from 'path';

const label = process.argv[2] || 'unnamed';

function findTranscript() {
  if (process.env.TRANSCRIPT) return process.env.TRANSCRIPT;
  const projRoot = path.join(os.homedir(), '.claude', 'projects');
  // Prefer the project dir matching this cwd (…/teach-me-v3 -> -Users-derek-teach-me-v3),
  // falling back to the newest .jsonl across all projects (the active session).
  const munged = (process.env.PWD || process.cwd()).replace(/\//g, '-');
  const dirs = [];
  try { for (const d of fs.readdirSync(projRoot)) dirs.push(path.join(projRoot, d)); } catch { return null; }
  const preferred = dirs.filter(d => path.basename(d).startsWith(munged.split('-lessons')[0]));
  const scan = (preferred.length ? preferred : dirs);
  let best = null, bestT = 0;
  for (const d of scan) {
    let files; try { files = fs.readdirSync(d); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const p = path.join(d, f), t = fs.statSync(p).mtimeMs;
      if (t > bestT) { bestT = t; best = p; }
    }
  }
  return best;
}

/* Which model, at what effort, on which surface — the fields a comparison gallery needs
   and the ones nobody remembers correctly by run nine. Claude transcripts already carry
   all three, so read them rather than asking. Env vars win when set, which is how a
   Codex or other non-Claude run (no transcript to read) labels itself:
     TM_RUN="gpt-5-codex/high"   or   TM_MODEL=… TM_EFFORT=… TM_SURFACE=… */
function runMeta(TRANSCRIPT) {
  const meta = { model: null, effort: null, surface: null, cliVersion: null };
  if (TRANSCRIPT) {
    const models = {}, efforts = {};
    let ent = null, ver = null;
    try {
      for (const line of fs.readFileSync(TRANSCRIPT, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let r; try { r = JSON.parse(line); } catch { continue; }
        const m = r?.message?.model;
        if (m && r.type === 'assistant') models[m] = (models[m] || 0) + 1;
        if (r.effort) efforts[r.effort] = (efforts[r.effort] || 0) + 1;
        if (r.entrypoint) ent = r.entrypoint;
        if (r.version) ver = r.version;
      }
    } catch { /* unreadable transcript is not a build defect */ }
    const top = o => Object.keys(o).sort((a, b) => o[b] - o[a])[0] || null;
    meta.model = top(models);
    meta.effort = top(efforts);
    meta.surface = ent;
    meta.cliVersion = ver;
  }
  if (process.env.TM_RUN) {
    const [m, e] = process.env.TM_RUN.split('/');
    if (m) meta.model = m.trim();
    if (e) meta.effort = e.trim();
  }
  if (process.env.TM_MODEL) meta.model = process.env.TM_MODEL;
  if (process.env.TM_EFFORT) meta.effort = process.env.TM_EFFORT;
  if (process.env.TM_SURFACE) meta.surface = process.env.TM_SURFACE;
  return meta;
}

function tally(TRANSCRIPT) {
  let out = 0, inp = 0, cacheRead = 0, cacheWrite = 0, msgs = 0;
  let text;
  try { text = fs.readFileSync(TRANSCRIPT, 'utf8'); } catch { return { out, inp, cacheRead, cacheWrite, msgs }; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    const u = rec?.message?.usage;
    if (!u) continue;
    msgs++;
    out += u.output_tokens || 0;
    inp += u.input_tokens || 0;
    cacheRead += u.cache_read_input_tokens || 0;
    cacheWrite += u.cache_creation_input_tokens || 0;
  }
  return { out, inp, cacheRead, cacheWrite, msgs };
}

const TRANSCRIPT = findTranscript();

// Resolve the log to the active RUN DIRECTORY regardless of cwd. Running mark.mjs from
// the skill root for early phases and the run dir later split the marks across two files
// and produced nonsense negative deltas (the second file restarts its own tally).
/* The FIRST mark is stamped at the end of the interview, before any HTML exists — so a
   run dir keyed on lesson.raw.html is not findable yet and "build start" landed in the
   repo-root log while every later mark landed in the lesson dir. Start and end in two
   files means totalSec restarts at 0 and no checkpoint can compute real elapsed time.
   Accept any lessons/<slug>/ directory, and migrate a stray root log into the run dir
   the moment one appears. */
function findRunDir() {
  if (process.env.RUN_DIR) return process.env.RUN_DIR;
  for (const root of ['lessons', '../lessons', '../../lessons']) {
    let entries; try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    let best = null, bestT = 0;
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const p = path.join(root, e.name);
      const mt = fs.statSync(p).mtimeMs; if (mt > bestT) { bestT = mt; best = p; }
    }
    if (best) return best;
  }
  return null;
}
const runDir = findRunDir();

function migrateRootLog(target) {
  const root = path.join(process.cwd(), 'build-log.json');
  if (!runDir || path.resolve(root) === path.resolve(target) || !fs.existsSync(root)) return;
  if (fs.existsSync(target)) return;                 // run dir already has its own history
  let stray; try { stray = JSON.parse(fs.readFileSync(root, 'utf8')); } catch { return; }
  if (!stray.marks || !stray.marks.length) return;
  const ageH = (Date.now() - Date.parse(stray.marks[stray.marks.length - 1].at)) / 3.6e6;
  if (ageH > 6) return;                              // belongs to some older build, leave it
  fs.writeFileSync(target, JSON.stringify(stray, null, 2));
  fs.renameSync(root, root.replace(/\.json$/, '.migrated.json'));
  console.log('  (moved ' + stray.marks.length + ' earlier mark(s) into ' + path.dirname(target) + ')');
}
const LOG = process.env.LOG || (runDir ? path.join(runDir, 'build-log.json') : path.join(process.cwd(), 'build-log.json'));
migrateRootLog(LOG);

// Subagent usage lives in separate transcripts the main tally can't see (the reviewer's
// 50k output showed up nowhere). Point AGENT_LOGS at them — comma-separated files or dirs
// of .jsonl/.output — to fold their cumulative output tokens in as a separate field.
function subagentOut() {
  const spec = process.env.AGENT_LOGS; if (!spec) return 0;
  let out = 0;
  for (const patt of spec.split(',')) {
    let files = [];
    try { files = fs.statSync(patt).isDirectory() ? fs.readdirSync(patt).map(f => path.join(patt, f)) : [patt]; } catch { continue; }
    for (const f of files) {
      if (!/\.(jsonl|output)$/.test(f)) continue;
      try { for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l.trim()) continue; let r; try { r = JSON.parse(l); } catch { continue; } out += r?.message?.usage?.output_tokens || 0; } } catch {}
    }
  }
  return out;
}
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { transcript: TRANSCRIPT, marks: [] };
const meta = runMeta(TRANSCRIPT);
// refresh every mark: an env var set mid-build should still label the run
log.run = Object.assign({}, log.run, Object.fromEntries(Object.entries(meta).filter(([, v]) => v)));
const now = Date.now();
const t = tally(TRANSCRIPT);
const prev = log.marks[log.marks.length - 1];
const d = prev ? prev.cum : { out: 0, inp: 0, cacheRead: 0, cacheWrite: 0, msgs: 0 };
const mark = {
  label, at: new Date(now).toISOString(),
  elapsedSec: prev ? Math.round((now - Date.parse(prev.at)) / 1000) : 0,
  totalSec: log.marks.length ? Math.round((now - Date.parse(log.marks[0].at)) / 1000) : 0,
  cum: t,
  subagentOutCum: subagentOut(),
  delta: { out: t.out - d.out, inp: t.inp - d.inp, cacheRead: t.cacheRead - d.cacheRead, cacheWrite: t.cacheWrite - d.cacheWrite, msgs: t.msgs - d.msgs },
};
log.marks.push(mark);
fs.writeFileSync(LOG, JSON.stringify(log, null, 2));

const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));
console.log(
  `[${label}] +${mark.elapsedSec}s (total ${Math.floor(mark.totalSec / 60)}m${mark.totalSec % 60}s) | ` +
  `phase tokens: out ${k(mark.delta.out)} / cache-read ${k(mark.delta.cacheRead)} / cache-write ${k(mark.delta.cacheWrite)} | ` +
  `cumulative out ${k(t.out)}` + (TRANSCRIPT ? '' : '  [no transcript found — tokens are 0]')
);
if (!log.marks.length || log.marks.length === 1) {
  const r = log.run || {};
  const label2 = [r.model || '?', r.effort || '?'].join(' / ') + (r.surface ? ' · ' + r.surface : '');
  console.log('  run: ' + label2 + ((!r.model || !r.effort)
    ? '   (set TM_RUN="model/effort" — no transcript to read it from)' : ''));
}

/* ===================== checkpoint verdict =====================
   A time budget the model has to evaluate for itself is a time budget it talks itself
   past — three test builds ran 50, 62 and 95 minutes against a 30 minute rule in prose.
   So the checkpoint states the verdict and the required action, and exits non-zero when
   the budget is blown. Exit 2 (not 1) so a blown budget is distinguishable from a crash.

   Budgets are minutes from the FIRST mark, and scale with lesson length — a short
   lesson held to the full budget means the clock only ever bites on full builds.
   Pass --len short|full at "build start"; it persists in build-log.json, so later
   marks inherit it. Override per build with TM_BUDGET="draft=12,lint clean=22".
   ============================================================== */
const BUDGETS = {
  short: { 'draft': 12, 'lint clean': 25, 'review done': 35 },
  full:  { 'draft': 20, 'lint clean': 40, 'review done': 55 },
};
const lenArg = (() => {
  const i = process.argv.indexOf('--len');
  const v = i >= 0 ? String(process.argv[i + 1] || '').toLowerCase() : '';
  return v === 'medium' ? 'full' : v;              // the medium tier collapsed into full
})();
const LEN = BUDGETS[lenArg] ? lenArg : (BUDGETS[log.run && log.run.len] ? log.run.len : 'full');
log.run = Object.assign({}, log.run, { len: LEN });
fs.writeFileSync(LOG, JSON.stringify(log, null, 2));
const budget = { ...BUDGETS[LEN] };
if (process.env.TM_BUDGET) {
  for (const pair of process.env.TM_BUDGET.split(',')) {
    const [key, mins] = pair.split('=');
    if (key && Number(mins) > 0) budget[key.trim().toLowerCase()] = Number(mins);
  }
}
// match the most specific budget key contained in the label ("draft done" -> "draft")
const hit = Object.keys(budget)
  .filter(key => label.toLowerCase().includes(key))
  .sort((a, b) => b.length - a.length)[0];

if (hit) {
  const mins = mark.totalSec / 60;
  const cap = budget[hit];
  if (mins <= cap) {
    console.log(`  ✓ checkpoint "${hit}": ${mins.toFixed(0)} min of ${cap} (${LEN}) — on budget.`);
  } else {
    console.log(
      `  ✗ checkpoint "${hit}": ${mins.toFixed(0)} min, budget ${cap}.\n` +
      `    CUT SCOPE NOW, before the next pass. Drop one objective and its section whole.\n` +
      `    Do NOT thin the final, drop typed items, or skip wrong-answer narration to catch up —\n` +
      `    those are floors and scripts/lint.mjs will fail the build anyway.`
    );
    process.exit(2);
  }
}
