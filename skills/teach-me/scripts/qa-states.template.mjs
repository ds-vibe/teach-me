// teach-me state walk — copy per lesson, fill the TODOs, keep the structure.
// Drives EVERY interactive path (wrong answers included), collects page/console errors,
// screenshots key states, then a WebKit iPhone pass asserting zero horizontal overflow.
// Run: node qa-states.mjs   (symlink html-explainer's node_modules for playwright)
//
// SILENT BY DEFAULT: headless is NOT silent. `speechSynthesis` hands text to the OS speech
// service (macOS exposes ~180 voices even in headless Chromium), so a QA click on a
// Watch/Listen button reads your narration out loud — and Chromium's `--mute-audio` does
// NOT cover it. That is why builds seem to "randomly" start talking: during the build the
// raw page has no embedded audio yet, so say() correctly falls to the browser-TTS tier.
// Every run therefore stubs browser TTS and mutes media. `QA_AUDIO=1` opts back in.
// The lesson file is never modified — the stub is injected into the test page only.
//
// FAST MODE (XII.7): `QA_FAST=1 node qa-states.mjs` also collapses media playback so
// narrated sequences resolve in milliseconds instead of real time. Use it for EVERY rerun
// while fixing; reserve one normal-speed run for the final green pass — that one still
// verifies the real audio path (element created, not paused, currentTime advancing).
import { chromium, webkit, devices } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import { MUTE_ARGS, muteSpeech } from './mute.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = 'lesson.html';                       // TODO
const url = 'file://' + path.join(here, LESSON);
const out = path.join(here, 'shots-states');
const FAST = !!process.env.QA_FAST;
const AUDIBLE = !!process.env.QA_AUDIO;   // opt in to real sound; silent otherwise

// Applied to EVERY page — desktop AND the WebKit mobile pass, or the mobile pass talks.
const prep = (pg) => pg.addInitScript(({ fast, audible }) => {
  if (!audible) {
    // Browser-TTS tier: goes to the OS speech service, which --mute-audio does not touch.
    // Resolve onend so sequence promises still settle and pacing stays realistic.
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = u => { if (u && u.onend) setTimeout(() => u.onend(new Event('end')), 20); };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.pause = () => {};
      window.speechSynthesis.resume = () => {};
    }
    // Embedded-MP3 tier (what actually ships): mute but keep the element REAL, so
    // paused / currentTime assertions still prove the shipped audio path plays.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; return play.apply(this, arguments); };
  }
  if (fast) {
    // Media resolves near-instantly; sequence chains keyed to `ended` collapse to ~30ms/line.
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('play'));
      setTimeout(() => this.dispatchEvent(new Event('ended')), 30);
      return Promise.resolve();
    };
  }
}, { fast: FAST, audible: AUDIBLE });

const browser = await chromium.launch({ args: MUTE_ARGS });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await muteSpeech(page);
await prep(page);
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(url); await page.waitForTimeout(700);

// Label promises are assertions (XII.7): a button that SAYS what it does gets a check
// that the effect observably happened — a label can claim an effect that never occurred,
// and a no-error click walk passes it.
const assertState = async (desc, sel, pred) => {
  const ok = await page.locator(sel).first().evaluate(pred);
  if (!ok) throw new Error('LABEL PROMISE FAILED: ' + desc);
};
// e.g. await assertState('"Pause final" opens the reference', '#drawer', el => el.classList.contains('open'));

// Deterministic wait — NEVER assert on a fixed waitForTimeout after starting a sequence.
// In fast mode the sequence can finish before the timeout, or after it, and the assertion
// then reads the wrong moment; this exact race cost two harness-debug iterations in a real
// build. Wait for the END STATE, not a duration. Use for anything a sequence produces.
const settle = (pred, ms = 20000) => page.waitForFunction(pred, null, { timeout: ms });
// e.g. after clicking Watch:  await settle(() => document.querySelector('#fw .leaf.stop')?.classList.contains('ring'));

const shot = async (name, sel) => (sel ? page.locator(sel).first() : page)
  .screenshot({ path: path.join(out, name + '.png') });
const rule = async (rootSel, frag) => {                    // answer an MC item by option text
  await page.locator(rootSel + ' .opt', { hasText: frag }).first().click();
  await page.waitForTimeout(200);
};
const typedDo = async (rootSel) => {                       // complete a typed self-score item
  await page.locator(rootSel + ' textarea').fill('An attempt long enough to unlock the model answer.');
  await page.locator(rootSel + ' .btn', { hasText: 'model answer' }).click();
  // Typed items self-score against NAMED CRITERIA as checkboxes (SKILL.md VII.8),
  // which replaced the old Got-it/Partly/Missed-it row. If your build still has a
  // single-verdict control, the build is wrong, not this template.
  const boxes = page.locator(rootSel + ' input[type=checkbox]');
  const n = await boxes.count();
  if (n === 0) throw new Error(`${rootSel}: no criterion checkboxes — typed items must self-score against 2–4 named criteria, not a global verdict (SKILL.md VII.8)`);
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
};

// Collapsed-column lint (XII.5a backstop, DESKTOP only). Behavioral walks pass a page
// that LOOKS broken — a text column starved to one-word-per-line throws no error and
// breaks no click. On the wide 1440px viewport, any multi-word text box under ~150px
// wide and much taller than wide is a collapsed flex/grid cell (a missing flex:1 /
// min-width:0, or a row that should stack). Catch it mechanically so it doesn't ride on
// the look pass being run. Call after any state that BUILDS new layout (final, readout).
const checkNarrow = async (label) => {
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('p,span,li,div,td,dd,dt,figcaption').forEach(el => {
      if (el.children.length > 1) return;                 // leaf-ish text only
      const t = (el.textContent || '').trim();
      if (t.split(/\s+/).length < 6) return;              // enough words that it must wrap
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < 150 && r.height > r.width * 2)
        out.push({ w: Math.round(r.width), h: Math.round(r.height),
                   sel: el.className || el.tagName, txt: t.slice(0, 50) });
    });
    return out;
  });
  bad.forEach(b => errors.push(`LAYOUT LINT [${label}]: collapsed text ${b.w}×${b.h}px (${b.sel}) — "${b.txt}…"`));
  return bad.length;
};
await checkNarrow('initial load');

// TODO per lesson — the walk MUST include, in lesson order:
//   1. every narrated sequence played to completion (wait generously; voice > silent timers)
//   2. every MC/ruling item: one WRONG answer (screenshot the verdict + reteach pointer,
//      and in the full-speed pass confirm the wrong answer SPEAKS its why — V.5),
//      retry, then the right answer
//   3. every typed item via typedDo()
//   4. ordering / bespoke widgets: wrong path first, then complete; rebuild-from-memory
//      drills: assert the artifact is actually hidden (visibility/display), not dimmed (VII.3)
//   5. quick-reference drawer: open, close; closed-book final: start (assert locked),
//      answer all items (assert unlocked), screenshot progress
//   6. the mastery ledger fully checked (screenshot)
//   7. every label promise asserted via assertState() — pause banners, "open reference",
//      lock/unlock buttons: the stated effect, not just a clean click
//   8. voice-toggle mid-sequence (XII.6): start a sequence, toggle voice OFF, assert the
//      sequence still completes or stops cleanly (Watch button leaves its Pause state) —
//      an audio promise with no timeout hangs the chain forever
//   9. LINES orphan lint (XII.6): evaluate in-page — every LINES key referenced by a
//      sequence step or item voice field, every referenced key exists, and keys follow
//      the <slot>_<component> naming (V.5). Orphaned audio is stale-plan residue and
//      can contradict the live answer key.
//  10. option-order variance (XI.2): across the graded items, assert the correct option's
//      rendered position VARIES (a fixed correct-first order is gameable), and any
//      escape option ("it depends", "can't tell yet") renders LAST.
//  11. no transcript regions (V.5): assert no element fills with the spoken line's text
//      during playback (query for the old .caption/.cap patterns); read-along steps
//      toggle .reading on their on-page target instead — assert that class appears
//      during the step and clears after.
//  12. re-run checkNarrow('<state>') after any step that BUILDS layout — the final
//      stepper, the readout, a revealed card — collapsed columns often appear only in
//      dynamically-inserted DOM the initial-load scan never saw.

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

// ---- mobile pass (WebKit ≈ iOS Safari) ----
const wb = await webkit.launch();
const ctx = await wb.newContext({ ...devices['iPhone 13'] });
await muteSpeech(ctx);
const mp = await ctx.newPage();
await prep(mp);                                   // WebKit talks too — 68 system voices
const merr = [];
mp.on('pageerror', e => merr.push(e.message));
await mp.goto(url); await mp.waitForTimeout(1500);
const overflow = await mp.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
await mp.screenshot({ path: path.join(out, 'mobile-top.png') });
console.log('mobile overflow px:', overflow, '(must be 0)');
console.log('mobile ERRORS:', merr.length ? merr.join('\n') : 'none');
await wb.close();
