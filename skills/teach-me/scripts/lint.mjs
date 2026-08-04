#!/usr/bin/env node
/* =====================================================================
   lint.mjs — the floors, as failures.

   WHY THIS EXISTS
   Two test builds shipped with a 4-question final, one closed-book item
   per objective, zero free-recall items, 11 narration lines against a
   30-50 budget, and a reviewer overlay in the learner's copy. Every one
   of those had a rule in SKILL.md. Prose floors do not bind; a script
   that prints FAIL does.

   The reviewer subagent should not be spending its context counting. It
   should be judging whether the writing is good and the reasoning sound.
   Everything countable lives here.

   USAGE
     node scripts/lint.mjs <lesson.html> [--len short|medium|full]
                                         [--json] [--no-render]
   Exit 1 on any FAIL. WARNs never fail the build.

   Reads the page's real globals (LINES, FINALS, OBJS, RULINGS…) in a
   headless browser rather than regex-parsing the source, so it cannot be
   fooled by formatting and it sees runtime-registered lines.
   ===================================================================== */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(__dir, '../reference');

/* ---------------------------------------------------------------- config
   Tune these. They are the whole point of the file — every number here is
   a floor that two real builds fell through. */
const CFG = {
  /* Practice has its own band. One pooled budget meant a stricter final ate the
     teaching half: at 4 closed-book items per objective, a two-objective short
     lesson spent 8 of 10 on the exam and had no room left for a mutation twin.
     The final's floor is final-coverage's job, so it is not counted here. */
  practice:     { short: [4, 9],   full: [8, 15] },
  items:        { short: [6, 10],  full: [16, 25] },   // total, reported not gated
  minTyped:     { short: 2,        full: 2 },   // one in practice, one in the final
  minVisuals:   { short: 1,        full: 3 },   // drawn visuals that teach
  minLive:      { short: 1,        full: 2 },   // of those, ones taking learner input
  finalPerObj:  4,     // closed-book items per stated objective. Three lets one miss
                       // be 33% of an objective; four is the first size where passing
                       // on a single miss (3/4) still reads as knowing the material
  minFinalOpts: 4,     // 3 options is a 33% guess floor on a graded exam
  voiceClips:   [20, 40],
  heroWords:    260,
  overlapMax:   0.88,  // per-line content-word overlap with on-screen text
  overlapMean:  0.80,
};

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('-'));
if (!file) { console.error('usage: node lint.mjs <lesson.html> [--len short|full] [--json] [--no-render]'); process.exit(1); }
const lenIdx = argv.indexOf('--len');
let LEN = lenIdx >= 0 ? argv[lenIdx + 1] : 'short';
/* "medium" was a third tier; it collapsed into full. Alias rather than hard-fail —
   a mid-build crash over a habit-typed flag costs more than the looser band. */
let lenAliased = false;
if (LEN === 'medium') { LEN = 'full'; lenAliased = true; }
if (!CFG.items[LEN]) { console.error(`--len must be short|full (got "${LEN}")`); process.exit(1); }
const JSON_OUT = argv.includes('--json');
const RENDER = !argv.includes('--no-render');
/* --drills: a question-battery build (SKILL § Drills mode). Bigger item budgets,
   no visuals floor (visuals appear only where questions need them), tighter hero. */
const DRILLS = argv.includes('--drills');
if (DRILLS) {
  CFG.items      = { short: [20, 30], full: [40, 60] };
  CFG.voiceClips = [8, 60];
  CFG.heroWords  = 140;
}

const out = [];
const add = (level, check, msg) => out.push({ level, check, msg });
const FAIL = (c, m) => add('FAIL', c, m);
const WARN = (c, m) => add('WARN', c, m);
const OK   = (c, m) => add('OK',   c, m);

const src = fs.readFileSync(file, 'utf8');

if (lenAliased) WARN('len', 'there is no "medium" tier any more — linted as full (16-25 items). Lengths are short|full.');

/* ---------------------------------------------------- static source checks */

// Reviewer overlay must not reach a learner.
// Match the overlay's MARKUP. The shell ships a defensive `#rv-launch{...}` CSS rule
// that positions the launcher when a reviewer build does include it — matching that
// selector failed every learner build for carrying a style rule and nothing else.
if (/id\s*=\s*["']rv-launch["']/.test(src) || /Review &amp;? ?& ?edit/.test(src))
  FAIL('review-overlay', 'review-mode.js is in the delivered file — rebuild without --review');
else OK('review-overlay', 'no reviewer overlay');

// Self-contained: <a href> to the web is fine (citations); a fetched resource is not.
const remote = [...src.matchAll(/<(?!a\b)([a-z]+)\b[^>]*?\b(?:src|href)=["'](https?:\/\/[^"']+)/gi)]
  .map(m => `${m[1]}: ${m[2].slice(0, 60)}`);
if (remote.length) FAIL('self-contained', `${remote.length} external resource(s): ` + remote.slice(0, 3).join(', '));
else OK('self-contained', 'no external requests');

// The engine is copy-whole. A hand-edited inline copy silently forks every lesson.
const refRuntime = path.join(REF, 'lesson-runtime.js');
if (fs.existsSync(refRuntime)) {
  // tts.mjs replaces the /*__VOICE__*/{} placeholder with the audio map, so that line
  // differs in every voiced build by design. Compare everything else.
  const want = fs.readFileSync(refRuntime, 'utf8').split('\n').map(l => l.trim())
    .filter(l => l.length > 25 && !l.includes('__VOICE__'));
  const missing = want.filter(l => !src.includes(l));
  if (!src.includes('lesson-runtime.js')) WARN('runtime-verbatim', 'no inlined runtime found — is this an assembled build?');
  else if (missing.length) FAIL('runtime-verbatim',
    `${missing.length}/${want.length} runtime lines differ — the engine was hand-edited, or this lesson predates the current reference/lesson-runtime.js`);
  else OK('runtime-verbatim', `engine matches reference (${want.length} lines)`);
}

/* ------------------------------------------------------- rendered checks */
let data = null;
if (RENDER) {
  const { chromium } = await import('playwright');
  const { MUTE_ARGS, muteSpeech } = await import('./mute.mjs');
  const browser = await chromium.launch({ args: MUTE_ARGS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await muteSpeech(page);
  const consoleErrs = [];
  page.on('pageerror', e => consoleErrs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(file), { waitUntil: 'load' });
  await page.waitForTimeout(900);

  data = await page.evaluate(() => {
    const g = k => (typeof window[k] !== 'undefined' ? window[k] : null);
    /* Lessons vary: a global may be an array, a single object, or absent. Coerce
       rather than assume — an exception here reads as "lint is broken" when the
       real finding is "this lesson is shaped differently". */
    const arr = v => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);
    const opts = o => arr(o && o.opts);
    const vis = document.body.innerText || '';
    const hero = document.querySelector('#hero') || document.querySelector('header');
    return {
      shapes: ['FINALS', 'OBJS', 'RULINGS', 'COMMITS', 'SORT', 'LINES', 'VOICE']
        .map(k => k + ':' + (typeof window[k] === 'undefined' ? 'absent' : Array.isArray(window[k]) ? 'array' : typeof window[k])),
      LINES: g('LINES') || {},
      visText: vis,
      VOICE: Object.keys(g('VOICE') || {}),
      /* The scenario text, for the variety check. tx is a table of rows, so flatten it. */
      FINALS: arr(g('FINALS')).map(f => ({ id: f.id, obj: f.obj, nopts: opts(f).length, typed: !!f.typed,
        text: [f.title, f.scen, f.q, JSON.stringify(f.tx || '')].join(' ') })),
      OBJS: arr(g('OBJS')).map(o => ({ label: o.label, tag: o.tag, keys: arr(o.keys) })),
      RULINGS: arr(g('RULINGS')).map(r => ({
        id: r.id, hasMut: !!r.mutate,
        text: [r.title, r.scen, r.q, JSON.stringify(r.tx || '')].join(' '),
        mutText: r.mutate ? [r.mutate.title, r.mutate.scen, r.mutate.q].join(' ') : '',
        wrong: opts(r).filter(o => !o.ok).length,
        mutWrong: r.mutate ? opts(r.mutate).filter(o => !o.ok).length : 0,
        mutId: r.mutate ? r.mutate.id : null,
      })),
      COMMITS: arr(g('COMMITS')).map(c => ({ id: c.id, wrong: opts(c).filter(o => o.v === 'no').length })),
      SORT: g('SORT') ? { rows: arr(g('SORT').rows).length } : null,
      /* Bespoke devices are per-lesson markup with no shared shape, so a graded one
         declares itself: data-item on the host. Illustrations stay unmarked. */
      deviceItems: document.querySelectorAll('[data-item]').length,
      /* An image that generated but is only named in prose — "[photo of a contract]"
         in a message bubble while the picture sits in IMAGES unplaced. */
      imgPlaced: (() => {
        const src = new Set([...document.querySelectorAll('img')].map(i => (i.getAttribute('src') || '').slice(0, 64)));
        const have = Object.entries(window.IMAGES || {}).map(([k, v]) => [k, String(v).slice(0, 64)]);
        return { unplaced: have.filter(([, v]) => v.startsWith('data:') && !src.has(v)).map(([k]) => k) };
      })(),
      bracketed: (document.body.innerText.match(/\[(?:photo|image|picture|screenshot) [^\]]{0,40}\]/gi) || []).slice(0, 5),
      /* Doubled verdict: the widgets render "✓ Correct — " / "✗ Not quite — " in front
         of every response, and the audio gets the same prefix. A response that then
         opens by restating it reads "✓ Correct — Right, …". The prefix is added at
         render time, but the authored text is right here, and the prefix is constant —
         so match the opener against the verdict the option already carries. */
      doubled: (() => {
        const OK_RE = /^(right|correct|yes|exactly|true)\b/i;
        const NO_RE = /^(wrong|incorrect|no|not quite|nope|false)\b/i;
        const hits = [];
        const scan = (id, o, isOk) => {
          const t = String((o && (o.why || o.resp)) || '').replace(/<[^>]+>/g, '').trim();
          if (!t) return;
          if ((isOk ? OK_RE : NO_RE).test(t)) hits.push(id + ': "' + t.slice(0, 42) + '…"');
        };
        arr(g('COMMITS')).forEach(c => opts(c).forEach((o, j) => scan(c.id + '.' + j, o, o.v === 'ok')));
        const rulings = arr(g('RULINGS'));
        rulings.forEach(r => {
          opts(r).forEach((o, j) => scan(r.id + '.' + j, o, !!o.ok));
          if (r.mutate) opts(r.mutate).forEach((o, j) => scan(r.mutate.id + '.' + j, o, !!o.ok));
        });
        arr(g('FINALS')).forEach(f => opts(f).forEach((o, j) => scan(f.id + '.' + j, o, !!o.ok)));
        return hits;
      })(),
      visuals: (() => {
        const DEV = '.cmp,.defs,.timeline,.steps,.fork,.zones,.dials,.chart,#fw,.device,[data-visual]';
        const CHROME = '#topbar,header,#drawer,.opt,button,.abtn';
        const out = new Set();
        document.querySelectorAll(DEV).forEach(e => { if (!e.closest(CHROME)) out.add(e); });
        // svg/canvas count when they are big enough to be a diagram, not a button icon
        document.querySelectorAll('svg,canvas').forEach(e => {
          if (e.closest(CHROME)) return;
          const r = e.getBoundingClientRect();
          if (r.width < 80 && r.height < 80) return;
          out.add(e.closest(DEV) || e);
        });
        return out.size;
      })(),
      live: (() => {
        const DEV = '.cmp,.defs,.timeline,.steps,.fork,.zones,.dials,.chart,#fw,.device,[data-visual]';
        const CHROME = '#topbar,header,#drawer,.opt,.abtn';
        const seen = new Set();
        document.querySelectorAll(DEV + ',svg,canvas').forEach(e => {
          if (e.closest(CHROME)) return;
          const host = e.closest(DEV) || e.parentElement;
          if (!host || seen.has(host)) return;
          const r = (e.tagName === 'svg' || e.tagName === 'CANVAS') ? e.getBoundingClientRect() : { width: 999, height: 999 };
          if (r.width < 80 && r.height < 80) return;
          // the learner can move it: a control inside the visual or in its immediate wrapper
          /* "Movable" must not depend on whether the author used <button> or a div with
             a handler — a clickable board built from divs is still interactive. Accept a
             control, an explicit data-visual="live", or descendants styled clickable. */
          const clickable = () => [...host.querySelectorAll('*')].slice(0, 400)
            .some(n => getComputedStyle(n).cursor === 'pointer');
          if (host.matches('.zones,.dials,.chart') ||
              host.getAttribute?.('data-visual') === 'live' ||
              host.querySelector('input,select,button:not(.abtn),[role=button],[tabindex]') ||
              (host.parentElement && host.parentElement.querySelector('input[type=range],button:not(.abtn)')) ||
              clickable())
            seen.add(host);
        });
        return seen.size;
      })(),
      /* An item that points at a picture must have one. A topo-map build shipped an
         opening commit reading "here is a patch of hillside" with an option "no way to
         tell from this picture", and no picture on the page. Demonstratives only —
         a bare "the map" is often fact-pattern content, not a screen reference. */
      orphanRefs: (() => {
        /* Demonstratives and deixis only. A bare "the painting" is usually fact-pattern
           content ("the painting she saw at the gallery"), not a screen reference. */
        const DEIX = /\b(?:this|that|these|those)\s+(?:picture|image|photo|photograph|diagram|map|painting|figure|screenshot|drawing|shape|lines)\b|\bshown\s+(?:above|below|here)\b|\bpictured\b|\bin\s+the\s+(?:picture|image|photo|diagram)\b/i;
        const VIS = 'img,svg,canvas';
        const big = (e) => { const r = e.getBoundingClientRect(); return r.width >= 80 || r.height >= 80; };
        const near = (el) => {
          /* The card, its immediate neighbours, and a tight wrapper only. Climbing to
             body found an unrelated visual belonging to a different item. */
          const zones = [el, el.previousElementSibling, el.nextElementSibling];
          const w = el.parentElement;
          if (w && w !== document.body && w.tagName !== 'MAIN' && w.children.length <= 4) zones.push(w);
          return zones.some(z => z && [...z.querySelectorAll(VIS)].some(v => !v.closest('button,.abtn') && big(v)));
        };
        const cards = [...document.querySelectorAll('.ruling,.fitem,[id^="commit-"]')];
        return cards.filter(c => DEIX.test(c.innerText || '') && !near(c))
          .map(c => ((c.innerText || '').trim().split('\n')[0] || c.id).slice(0, 52));
      })(),
      /* Tiled grids — board, calendar, heatmap, dot grid. A grid with no explicit
         grid-template-rows collapses its empty rows, so cells stop being square and
         the page still looks plausible. Uniform tiles are the assertion. */
      tiling: (() => {
        const bad = [];
        for (const g of document.querySelectorAll('*')) {
          const cs = getComputedStyle(g);
          if (!/grid/.test(cs.display)) continue;
          const kids = [...g.children].filter(k => k.getBoundingClientRect().width > 0);
          if (kids.length < 16) continue;                       // not a tiling
          const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
          if (cols < 3) continue;                               // a list, not a board
          const w = kids.map(k => Math.round(k.getBoundingClientRect().width));
          const h = kids.map(k => Math.round(k.getBoundingClientRect().height));
          const spread = (a) => Math.max(...a) - Math.min(...a);
          // >2px of variation across tiles is a collapse, not a rounding artefact
          if (spread(w) > 2 || spread(h) > 2) {
            const id = g.id ? '#' + g.id : (String(g.className).split(' ')[0] ? '.' + String(g.className).split(' ')[0] : g.tagName);
            bad.push(`${id} tiles vary ${Math.min(...w)}-${Math.max(...w)}w x ${Math.min(...h)}-${Math.max(...h)}h`);
          }
        }
        return bad;
      })(),
      commitCount: arr(g('COMMITS')).length,
      typedCount: document.querySelectorAll('.ruling.typed').length,
      heroWords: hero ? (hero.innerText.trim().split(/\s+/).filter(Boolean).length) : null,
      visText: vis,
    };
  });

  // horizontal overflow at both widths
  for (const [label, w] of [['desktop', 1440], ['mobile', 390]]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => {
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 1) return { doc: de.scrollWidth - de.clientWidth };
      // an overflow trapped INSIDE a scroll container never touches documentElement,
      // which is how clipped diagrams pass a naive overflow assertion
      const inner = [...document.querySelectorAll('*')].filter(el => {
        if (el === document.body || el === document.documentElement) return false;
        const s = getComputedStyle(el);
        // auto/scroll on a wide child is intentional (a scrollable table); it is only a
        // defect when the container is narrower than the viewport and clips its content
        return s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0;
      }).map(el => (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName));
      return inner.length ? { inner: [...new Set(inner)].slice(0, 4) } : null;
    });
    if (over?.doc) FAIL('overflow-' + label, `page scrolls horizontally by ${over.doc}px at ${w}px`);
    else if (over?.inner) WARN('overflow-' + label, `content clipped inside scroll container(s) at ${w}px: ${over.inner.join(', ')}`);
    else OK('overflow-' + label, `no horizontal overflow at ${w}px`);
  }

  if (consoleErrs.length) FAIL('console', `${consoleErrs.length} error(s): ` + consoleErrs[0].slice(0, 120));
  else OK('console', 'no console or page errors');

  /* --- hero balance: in a two-column hero, a side column that runs out well before
     the text column leaves a dead band under it. Direction matters and is the whole
     check: a card TALLER than the text is a magazine layout and always passes; only
     text-taller-than-card by a wide margin reads as a hole. Prior builds confirmed
     both directions. Desktop only — mobile stacks to one column. */
  {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(250);
    const hb = await page.evaluate(() => {
      const g = document.querySelector('.herogrid');
      if (!g || getComputedStyle(g).display !== 'grid' || g.children.length < 2) return null;
      const h = [...g.children].map(c => Math.round(c.getBoundingClientRect().height));
      return { text: h[0], side: h[1] };
    });
    if (!hb) OK('hero-balance', 'no two-column hero grid');
    else if (hb.text - hb.side > 150)
      WARN('hero-balance', `hero side column ends ${hb.text - hb.side}px before the text column — a dead band under the card. Rebalance: shorten the text, grow the card, or drop the second column.`);
    else if (hb.side - hb.text > 550)
      WARN('hero-balance', `hero side column runs ${hb.side - hb.text}px past the text — the text column reads as a hole beside it. Cap the card's image height, move it below the hero, or add a line of text.`);
    else OK('hero-balance', `hero columns end together (text ${hb.text}px, side ${hb.side}px)`);
  }

  /* --- sequencing: a Listen/Watch button must sit at the TOP of what it plays.
     Rendered geometry, not DOM order — what the learner sees is the rule. Only the
     button's position is mechanizable; "a concept's first appearance is never an
     interaction" is semantic and stays a fresh-review item. */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  const late = await page.evaluate(() => {
    const BLOCK = 'section, article, .card, .device, .ruling, .cmp, .zones, .steps, .timeline, .dials, .chart, .fork, .treescroll';
    const out = [];
    /* Sequence launchers only — the runtime marks them .abtn / [data-say] / a .wl label
       span. Matching every button by its words caught MCQ options whose answer text
       happened to contain "play". */
    for (const b of document.querySelectorAll('.abtn, [data-say], button:has(.wl)')) {
      if (b.closest('#topbar, header, .topbar, #drawer')) continue;   // global chrome, not a section control
      if (b.classList.contains('opt')) continue;                      // an answer choice, never a launcher
      const cont = b.closest(BLOCK) || b.parentElement;
      if (!cont) continue;
      const cb = cont.getBoundingClientRect(), bb = b.getBoundingClientRect();
      if (cb.height < 200) continue;              // a short card: position barely matters
      const room = Math.max(1, cb.height - bb.height);
      const rel = (bb.top - cb.top) / room;       // 0 = flush top, 1 = flush bottom
      if (rel > 0.5) out.push(`"${(b.textContent || '').trim().slice(0, 24)}" sits ${Math.round(rel * 100)}% down its block`);
    }
    return out;
  });
  if (late.length) FAIL('sequencing', `${late.length} listen/watch control(s) below the content they play — move to the top: ` + late.slice(0, 3).join(' · '));
  else OK('sequencing', 'listen/watch controls precede the content they play');

  /* --- contrast: the shell reads every colour from :root, so a legible palette is
     checkable before anyone looks at a screenshot. */
  const contrast = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const lum = (c) => {
      const f = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    /* Alpha matters: the soft verdict tints ship as rgba(...,.14). Reading one as
       opaque compares a tint against its own base colour and reports 1.0:1. */
    const parse = (raw) => {
      const s = (raw || '').trim();
      let m = s.match(/^#([0-9a-f]{3})$/i);
      if (m) return { c: [...m[1]].map(h => parseInt(h + h, 16)), a: 1 };
      m = s.match(/^#([0-9a-f]{6})$/i);
      if (m) return { c: [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
      m = s.match(/^rgba?\(([^)]+)\)$/i);
      if (m) {
        const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        if (p.length < 3 || p.slice(0, 3).some(n => isNaN(n))) return null;
        return { c: p.slice(0, 3), a: p.length > 3 && !isNaN(p[3]) ? p[3] : 1 };
      }
      return null;                                 // var()/oklch/named — skip rather than guess
    };
    const over = (top, bot) => top.a >= 1 ? top.c : top.c.map((v, i) => v * top.a + bot[i] * (1 - top.a));
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const page = parse(cs.getPropertyValue('--bg'));
    const base = page ? over(page, [255, 255, 255]) : [255, 255, 255];
    /* Only pairs the shell actually renders as text-on-surface. --good/--danger are
       border and accent colours, never body text on their own tint. */
    const PAIRS = [
      ['--fg', '--bg'], ['--fg', '--surface'], ['--fg', '--surface2'],
      ['--fg2', '--bg'], ['--fg2', '--surface'],
      ['--band-fg', '--band'],
      ['--fg', '--good-soft'], ['--fg', '--danger-soft'],   // verdict panels
      ['--muted', '--bg'],                                   // legitimately lighter — warn only
    ];
    const bad = [], soft = [];
    for (const [f, b] of PAIRS) {
      const fRaw = parse(cs.getPropertyValue(f)), bRaw = parse(cs.getPropertyValue(b));
      if (!fRaw || !bRaw) continue;
      const bg = over(bRaw, base);
      const r = ratio(over(fRaw, bg), bg);
      if (r < 4.5) (f === '--muted' ? soft : bad).push(`${f} on ${b} = ${r.toFixed(1)}:1`);
    }
    return { bad, soft };
  });
  if (contrast.bad.length) FAIL('contrast', `below 4.5:1 — ` + contrast.bad.join(' · '));
  else OK('contrast', 'body and verdict text clear 4.5:1');
  if (contrast.soft.length) WARN('contrast', `secondary text under 4.5:1 — ` + contrast.soft.join(' · '));

  /* --- a11y: the runtime half of this (announced feedback, options that keep the
     tab order) is guaranteed by runtime-verbatim. What that cannot see is what the
     lesson itself authors: a teaching diagram with no accessible name is a blank to
     anyone not looking at it, and a control whose only label is an icon is unusable.
     Decorative art is exempt — it just has to say so with aria-hidden. */
  const a11y = await page.evaluate(() => {
    const bad = { svg: 0, btn: [] };
    document.querySelectorAll('svg').forEach(s => {
      if (s.closest('[aria-hidden="true"]') || s.getAttribute('aria-hidden') === 'true') return;
      const named = s.querySelector('title') || s.getAttribute('aria-label') || s.getAttribute('role') === 'presentation';
      if (!named) bad.svg++;
    });
    document.querySelectorAll('button, a[href]').forEach(b => {
      const t = (b.textContent || '').trim();
      if (t || b.getAttribute('aria-label') || b.getAttribute('title')) return;
      bad.btn.push(b.id || b.className || b.tagName.toLowerCase());
    });
    return bad;
  });
  if (a11y.svg) WARN('a11y-names', `${a11y.svg} svg element(s) with no <title>, aria-label, or aria-hidden — a teaching diagram needs a name, decorative art needs aria-hidden="true"`);
  else OK('a11y-names', 'every svg is named or explicitly decorative');
  if (a11y.btn.length) FAIL('a11y-names', `control(s) with no accessible name: ${a11y.btn.slice(0, 5).join(' · ')}`);

  await browser.close();
}

/* --------------------------------------------------------- floor checks */
if (data) {
  const d = data;

  // --- item budget
  const nRulings = d.RULINGS.length + d.RULINGS.filter(r => r.hasMut).length;
  /* Commits are ungraded and sit outside the budget (SKILL: § the opening commit) —
     counting them made a lesson with 9 graded items read as 11 and overshoot. */
  /* A sorter is as many judgements as it has rows — counting it as one read a
     five-row sorter as a single item and made rich lessons look thin. Devices say
     so themselves with data-item on the host, because nothing in their markup
     distinguishes a graded one from an illustration. */
  const nSort = d.SORT ? d.SORT.rows : 0;
  const practice = nRulings + d.typedCount + nSort + (d.deviceItems || 0);
  const total = practice + d.FINALS.length;
  const [plo, phi] = CFG.practice[LEN];
  const breakdown = `${nRulings} ruling/mutation + ${d.typedCount} typed + ${nSort} sorter row(s) + ${d.deviceItems || 0} device; ${d.FINALS.length} final and ${d.commitCount || 0} commit(s) counted separately`;
  if (practice < plo) FAIL('practice-budget', `${practice} practice items, ${LEN} needs ${plo}-${phi} (${breakdown})`);
  else if (practice > phi) WARN('practice-budget', `${practice} practice items, above the ${LEN} range ${plo}-${phi} (${breakdown})`);
  else OK('practice-budget', `${practice} practice items in range ${plo}-${phi} (${breakdown})`);
  OK('item-budget', `${total} items total (${practice} practice + ${d.FINALS.length} final)`);

  /* At least one contrastive pair. Same scenario, one fact changed, answer flips —
     the strongest discrimination drill the format has, and previously specified in
     one word inside a list of question types, which produced lessons with none. */
  /* One per objective, not one per lesson: a flat floor of 1 became a target, and a
     four-ruling lesson shipped a single twin attached to the scenario the reader had
     already met five times, so it landed as more of the same rather than as a new
     discrimination. Each objective needs its own contrastive pair. */
  const nMut = d.RULINGS.filter(r => r.hasMut).length;
  const nObj = d.OBJS.length || 1;
  if (nMut < nObj) FAIL('mutation-pair', `${nMut} mutation pair(s) for ${nObj} objective(s) — each objective needs one item that re-runs its own scenario with a single fact changed`);
  else OK('mutation-pair', `${nMut} mutation pair(s) across ${nObj} objective(s)`);

  /* No scenario-variety check here on purpose. One case carrying the hero, the
     walkthrough, the diagram and half the items is a real defect — a lesson can be
     correct and still read as repetitive — but it does not survive measurement. In a
     build that felt exactly that way the most-repeated content word was 1.9% of the
     text against 1.8% for "yes", so any threshold that caught it would fire on
     everything. It belongs to the cold-learner reviewer, not to a counter. */

  /* A picture the build paid for, described in prose and then not shown. The prompt
     was written, the image generated, and the text says "[photo of a contract]" where
     the picture belongs — so the learner reads about the thing instead of seeing it. */
  const unplaced = (d.imgPlaced && d.imgPlaced.unplaced) || [];
  const brackets = d.bracketed || [];
  if (brackets.length && unplaced.length)
    FAIL('image-placed', `prose stands in for a picture that exists: ${brackets.join(', ')} — unplaced in IMAGES: ${unplaced.join(', ')}`);
  else if (brackets.length)
    WARN('image-placed', `bracketed stand-in(s) in the text: ${brackets.join(', ')} — write the thing or show it, don't describe a slot`);
  else if (unplaced.length)
    WARN('image-placed', `generated but never rendered: ${unplaced.join(', ')}`);
  else OK('image-placed', 'no described-but-missing pictures');

  // --- free recall: the format that gets dropped first under time pressure
  /* Written responses are counted per ZONE. A lesson can clear a global minimum with
     two typed items in practice and none in the final, which leaves the closed-book
     instrument pure recognition — the one place free recall matters most. */
  const typedFinal = d.FINALS.filter(f => f.typed).length;
  /* .ruling.typed is the practice count only — the final's items are not in the DOM
     until the exam starts, so the two numbers add, they don't overlap. */
  const typedPractice = d.typedCount;
  const typedTotal = typedPractice + typedFinal;
  /* Nothing counted visuals, so a page of multiple choice with nothing to look at or
     move passed every gate. Devices carry known classes; bespoke ones are svg/canvas
     in the content column. "Live" means the learner can move it. */
  const [vLo, lLo] = [CFG.minVisuals[LEN], CFG.minLive[LEN]];
  if (DRILLS) OK('visual-floor', `waived (--drills) — ${d.visuals} drawn visual(s); visuals appear only where questions need them`);
  else if (d.visuals < vLo) FAIL('visual-floor', `${d.visuals} drawn visual(s), ${LEN} needs ${vLo} — this format is not a page of multiple choice`);
  else if (d.live < lLo) FAIL('visual-floor', `${d.visuals} visual(s) but only ${d.live} the learner can move, ${LEN} needs ${lLo}`);
  else OK('visual-floor', `${d.visuals} drawn visual(s), ${d.live} the learner can move`);

  if (d.tiling && d.tiling.length)
    FAIL('tiling', `${d.tiling.length} tiled grid(s) with uneven cells — add explicit grid-template-rows: ` + d.tiling.slice(0, 2).join(' · '));
  else OK('tiling', 'tiled grids have uniform cells');

  if (d.orphanRefs && d.orphanRefs.length)
    FAIL('visual-ref', `${d.orphanRefs.length} item(s) point at a picture that isn't beside them: ` + d.orphanRefs.slice(0, 3).map(t => `"${t}…"`).join(' · '));
  else OK('visual-ref', 'every item that names a picture has one beside it');

  if (d.doubled && d.doubled.length)
    WARN('doubled-verdict', `${d.doubled.length} response(s) restate the verdict the widget already printed — ` + d.doubled.slice(0, 3).join(' · '));
  else OK('doubled-verdict', 'no response restates its own verdict');

  const minT = CFG.minTyped[LEN];
  if (typedPractice < 1) FAIL('free-recall', `no written response in practice — everything before the final is recognition`);
  else if (typedFinal < 1) FAIL('free-recall', `no written response in the final (${typedPractice} in practice) — set typed:true with model + criteria on one FINALS item`);
  else if (typedTotal < minT) FAIL('free-recall', `${typedTotal} written response(s), ${LEN} needs ${minT}`);
  else OK('free-recall', `${typedTotal} written response(s) — ${typedPractice} in practice, ${typedFinal} in the final`);

  // --- closed-book coverage per objective
  if (!d.OBJS.length) WARN('final-coverage', 'no OBJS defined — cannot check per-objective coverage');
  else {
    const finalIds = new Set(d.FINALS.map(f => f.id));
    const thin = d.OBJS.map(o => ({ label: o.label, n: o.keys.filter(k => finalIds.has(k)).length }))
                       .filter(o => o.n < CFG.finalPerObj);
    if (thin.length) FAIL('final-coverage', thin.map(o => `"${o.label}" has ${o.n} closed-book item(s), needs ${CFG.finalPerObj}`).join('; '));
    else OK('final-coverage', `every objective has ${CFG.finalPerObj}+ closed-book items`);
  }

  // --- guess floor
  /* Written items are exempt: they have no options by construction, and free-recall
     above REQUIRES one in the final — so counting them here made the two checks
     mutually unsatisfiable and failed every lesson that obeyed both. */
  const thinOpts = d.FINALS.filter(f => !f.typed && f.nopts < CFG.minFinalOpts);
  if (thinOpts.length) FAIL('guess-floor', `${thinOpts.length} final item(s) with <${CFG.minFinalOpts} options (${thinOpts.map(f => f.id).join(', ')})`);
  else if (d.FINALS.length) OK('guess-floor', `all final items have ${CFG.minFinalOpts}+ options`);

  // --- voice, only when the build is voiced
  const voiced = d.VOICE.length > 0;
  if (!voiced) WARN('voice', 'no embedded clips — silent build, voice checks skipped');
  else {
    const [vlo, vhi] = CFG.voiceClips;
    if (d.VOICE.length < vlo) FAIL('voice-budget', `${d.VOICE.length} clips, budget is ${vlo}-${vhi}`);
    else if (d.VOICE.length > vhi) WARN('voice-budget', `${d.VOICE.length} clips, above ${vhi}`);
    else OK('voice-budget', `${d.VOICE.length} clips in range`);

    // every wrong-answer path must have audio, including mutations
    const want = [];
    d.COMMITS.forEach(c => { for (let i = 0; i < c.wrong; i++) want.push('fb_' + c.id); });
    d.RULINGS.forEach(r => {
      for (let i = 0; i < r.wrong; i++) want.push('fb_' + r.id);
      for (let i = 0; i < r.mutWrong; i++) want.push('fb_' + r.mutId);
    });
    const have = new Set(d.VOICE);
    const uncovered = [...new Set(want)].filter(pre => ![...have].some(k => k.startsWith(pre + '_')));
    if (uncovered.length) FAIL('voice-feedback', `no audio on wrong-answer feedback for: ${uncovered.join(', ')}`);
    else if (want.length) OK('voice-feedback', `every wrong-answer path voiced (${new Set(want).size} items)`);
  }

  // --- narration must add, not read the screen back
  const stop = new Set('the a an of to in is it that this and or if not was were be been for on as with by you your they what how when at from so its'.split(' '));
  const visWords = new Set((d.visText.toLowerCase().match(/[a-z']+/g) || []));
  /* Read-along stems are SUPPOSED to match the screen word for word — the skill asks
     for voice on question stems. Scoring them as echoes penalised the intended
     pattern, so exempt stem keys; feedback and gloss lines still get measured. */
  const ratios = Object.entries(d.LINES).filter(([k]) => !/^stem[_-]/i.test(k)).map(([k, v]) => {
    const w = (String(v).toLowerCase().match(/[a-z']+/g) || []).filter(x => !stop.has(x) && x.length > 2);
    return w.length ? { k, r: w.filter(x => visWords.has(x)).length / w.length, n: w.length } : null;
  }).filter(Boolean);
  if (ratios.length) {
    const mean = ratios.reduce((s, x) => s + x.r, 0) / ratios.length;
    const echoes = ratios.filter(x => x.r >= CFG.overlapMax && x.n >= 10);
    if (mean > CFG.overlapMean) FAIL('voice-adds', `narration restates the screen — mean overlap ${mean.toFixed(2)} (max ${CFG.overlapMean})`);
    else OK('voice-adds', `mean narration/screen overlap ${mean.toFixed(2)}`);
    if (echoes.length) WARN('voice-echo', `${echoes.length} line(s) read the screen back: ${echoes.slice(0, 5).map(x => x.k).join(', ')}`);
  }

  // --- hero
  if (d.heroWords == null) WARN('hero', 'no #hero found');
  else if (d.heroWords > CFG.heroWords) FAIL('hero', `hero is ${d.heroWords} words (max ${CFG.heroWords}) — cut before the first interaction`);
  else OK('hero', `hero ${d.heroWords} words`);
}

/* ------------------------------------------------- elapsed build clock
   The clock is only real if it was started. SKILL.md tells the model to stamp
   "build start" at the end of the interview, but that is prose, and prose is what
   this whole file exists because of — the first three test builds left either no
   log or a split one. So a missing clock FAILS here rather than passing quietly. */
/* Only the log beside the lesson counts. A repo-root build-log.json belongs to some
   other build and reports a bogus elapsed time for this one. */
const logPath = [path.join(path.dirname(path.resolve(file)), 'build-log.json')]
  .find(p => fs.existsSync(p));
if (!logPath) {
  FAIL('clock', 'no build-log.json beside the lesson — run `node scripts/mark.mjs "build start"` at the end of the interview, and again at "draft done" / "lint clean"');
} else {
  let marks = null, run = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    marks = parsed.marks || []; run = parsed.run || {};
  } catch { marks = null; }
  if (!marks) FAIL('clock', 'build-log.json is unreadable — the build clock cannot be verified');
  else {
    const start = marks.find(m => /start/i.test(m.label));
    if (!start) FAIL('clock', `build-log.json has no "build start" mark (found: ${marks.map(m => m.label).join(', ') || 'nothing'}) — the clock never started`);
    else {
      const mins = Math.round((Date.now() - new Date(start.at).getTime()) / 60000);
      const seen = marks.map(m => m.label.toLowerCase());
      const missed = ['draft', 'lint clean'].filter(k => !seen.some(l => l.includes(k)));
      if (missed.length) WARN('clock', `${mins} min elapsed; no checkpoint stamped for: ${missed.join(', ')}`);
      else OK('clock', `${mins} min elapsed, ${marks.length} checkpoints stamped`);

      /* Everything a comparison gallery card needs, from one command. Reported, never
         failed — an unlabelled run is still a valid lesson, just not a comparable one. */
      const last = marks[marks.length - 1] || {};
      const cum = last.cum || {};
      const spend = (cum.out || 0) + (last.subagentOutCum || 0);
      if (run.model || run.effort) {
        OK('run', `${run.model || '?'} / ${run.effort || '?'}`
          + (run.surface ? ` · ${run.surface}` : '')
          + ` — ${mins} min, ${Math.round(spend / 1000)}k output tokens`);
      } else {
        WARN('run', `unlabelled — set TM_RUN="model/effort" before mark.mjs to make this build comparable`
          + ` (${mins} min, ${Math.round(spend / 1000)}k output tokens)`);
      }
    }
  }
}

/* ------------------------------------------------------------- report */
const fails = out.filter(o => o.level === 'FAIL');
const warns = out.filter(o => o.level === 'WARN');
if (JSON_OUT) {
  console.log(JSON.stringify({ file, len: LEN, fails: fails.length, warns: warns.length, results: out }, null, 2));
} else {
  const icon = { FAIL: '✗', WARN: '!', OK: '✓' };
  for (const o of out) console.log(`${icon[o.level]} ${o.check.padEnd(18)} ${o.msg}`);
  console.log('');
  if (fails.length) console.log(`✗ ${fails.length} FAIL, ${warns.length} WARN — fix the failures before delivering.`);
  else if (warns.length) console.log(`✓ no failures, ${warns.length} warning(s) to look at.`);
  else console.log('✓ all floors met.');
}
process.exit(fails.length ? 1 : 0);
