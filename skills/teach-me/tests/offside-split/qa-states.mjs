// State walk for lessons/offside-CTRL--0bv3/lesson.html — from scripts/qa-states.template.mjs
import { chromium, webkit, devices } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = process.env.LESSON || 'lesson.html';
const url = 'file://' + path.join(here, LESSON);
const out = path.join(here, 'shots-states');
fs.mkdirSync(out, { recursive: true });
const FAST = !!process.env.QA_FAST;
const AUDIBLE = !!process.env.QA_AUDIO;

const prep = (pg) => pg.addInitScript(({ fast, audible }) => {
  if (!audible) {
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = u => { if (u && u.onend) setTimeout(() => u.onend(new Event('end')), 20); };
      window.speechSynthesis.cancel = () => {};
      window.speechSynthesis.pause = () => {};
      window.speechSynthesis.resume = () => {};
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; return play.apply(this, arguments); };
  }
  if (fast) {
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('play'));
      setTimeout(() => { this.dispatchEvent(new Event('ended')); if (this.onended) this.onended(new Event('ended')); }, 30);
      return Promise.resolve();
    };
  }
}, { fast: FAST, audible: AUDIBLE });

const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); console.log((cond ? '  ok  ' : '  FAIL') + ' ' + name); };

const browser = await chromium.launch({ args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await prep(page);
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(url); await page.waitForTimeout(900);

const shot = (name, sel) => (sel ? page.locator(sel).first() : page).screenshot({ path: path.join(out, name + '.png') });
const rule = async (rootSel, frag) => {
  await page.locator(rootSel + ' .opt', { hasText: frag }).first().click();
  await page.waitForTimeout(250);
};

/* ---- 1 · chrome ---- */
ok('header#topbar exists', await page.locator('header#topbar').count() === 1);
ok('voice label reads Voice: on (embedded)', (await page.locator('#voicelabel').textContent()) === 'Voice: on');
ok('three phase chips', await page.locator('#chip-intro').count() === 1 && await page.locator('#chip-final').count() === 1 && await page.locator('#lessonmenu').count() === 1);
ok('dropdown has 3 section entries', await page.locator('#lessonmenu .menu a').count() === 3);
ok('rail has 5 entries', await page.locator('#rail a').count() === 5);
ok('pause button disabled when idle', await page.locator('#pausebtn').isDisabled());
const oneRow = await page.evaluate(() => document.getElementById('topbar').scrollHeight <= 60);
ok('topbar one row at 1440', oneRow);
const railClear = await page.evaluate(() => {
  const r = document.getElementById('rail'); if (!r) return false;
  const rb = r.getBoundingClientRect(); const mb = document.querySelector('main').getBoundingClientRect();
  return rb.right <= mb.left + 24; /* main has 24px padding; content starts inside */
});
ok('rail clear of content at 1440', railClear);

/* ---- 2 · dropdown jump ---- */
await page.locator('#lessonmenu summary').click(); await page.waitForTimeout(200);
await page.locator('#lessonmenu .menu a', { hasText: '§2' }).click();
let jumped = true;
try { await page.waitForFunction(() => Math.abs(document.getElementById('s2').getBoundingClientRect().top) < 260, null, { timeout: 5000 }); } catch { jumped = false; }
ok('dropdown jump reaches §2', jumped);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);

/* ---- 3 · commits (escape pinned last, reveals respond, read-along) ---- */
for (const c of ['hero', 'c1', 'c2', 'c3']) {
  const lastEsc = await page.evaluate((id) => {
    const host = document.getElementById('commit-' + (id === 'hero' ? 'hero' : id));
    const opts = host.querySelectorAll('.opt');
    const last = opts[opts.length - 1].textContent;
    return /know more|Can't say yet|Still can't say/.test(last);
  }, c);
  ok('commit ' + c + ' escape option renders last', lastEsc);
}
// read-along on hero commit stem — observer catches the transient class in fast mode
await page.evaluate(() => {
  window.__sawReading = false;
  new MutationObserver(() => { if (document.getElementById('stem-hero').classList.contains('reading')) window.__sawReading = true; })
    .observe(document.getElementById('stem-hero'), { attributes: true, attributeFilter: ['class'] });
});
await page.locator('#listen-hero').click();
await page.waitForFunction(() => window.__sawReading === true, null, { timeout: 40000 });
ok('read-along .reading appears on stem', true);
await page.waitForFunction(() => !document.getElementById('stem-hero').classList.contains('reading'), null, { timeout: 40000 });
ok('read-along clears after line', true);
await rule('#commit-hero', 'The goal stands');
ok('hero commit reveal shows', await page.evaluate(() => document.querySelector('#commit-hero .why').classList.contains('show')));
await shot('commit-hero-revealed', '#commit-hero');
await rule('#commit-c1', 'Offside');
ok('c1 wrong reveal marked corrective', await page.evaluate(() => document.querySelector('#commit-c1 .why').classList.contains('bad')));

/* ---- 4 · step-through ---- */
for (let i = 0; i < 3; i++) { await page.locator('#stepnext').click(); await page.waitForTimeout(250); }
ok('step-through reaches frame 4 (Next disabled)', await page.locator('#stepnext').isDisabled());
ok('frame-4 caption states verdict', (await page.locator('#stepcap').textContent()).includes('onside'));
await page.locator('#stepback').click(); await page.waitForTimeout(200);
ok('step Back works', !(await page.locator('#stepnext').isDisabled()));
await shot('step-frame3', '#stepdev');

/* ---- 5 · slider device (label promise: readout matches state) ---- */
const setSlider = async (id, v) => page.locator('#' + id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
await setSlider('attsl', 120);
ok('slider: own half message', (await page.locator('#linereadout').textContent()).includes('own half'));
await setSlider('attsl', 252); await setSlider('defsl', 252);
ok('slider: level message', (await page.locator('#linereadout').textContent()).includes('Level'));
await setSlider('attsl', 300);
ok('slider: offside position message', (await page.locator('#linereadout').textContent()).includes('Offside position'));
await setSlider('attsl', 230); await setSlider('defsl', 252);
await shot('slider-offside', '#linedev');

/* ---- 6 · R1 wrong -> retry -> right -> mutation ---- */
await rule('#host-r1', 'a defender is still between');
ok('R1 wrong: verdict words shown', (await page.locator('#host-r1 .why').first().textContent()).includes('Not quite'));
ok('R1 wrong: right option marked', await page.locator('#host-r1 .opt.right').count() === 1);
ok('R1 wrong: reteach link present', await page.locator('#host-r1 .reteach').count() === 1);
await shot('r1-wrong', '#host-r1');
await page.locator('#host-r1 .retry').first().click(); await page.waitForTimeout(200);
await rule('#host-r1', 'only one opponent is nearer');
ok('R1 correct after retry', await page.evaluate(() => M.r1 === true));
await page.waitForTimeout(300);
ok('R1 mutation appears after correct', await page.locator('#host-r1 .mutwrap .ruling').count() === 1);
await rule('#host-r1 .mutwrap', 'still ahead of the ball');
await page.locator('#host-r1 .mutwrap .retry').click(); await page.waitForTimeout(150);
await rule('#host-r1 .mutwrap', 'level with the second-last opponent is onside');
ok('R1 mutation correct marks ledger', await page.evaluate(() => M.r1m === true));
await shot('r1-mutation', '#host-r1');

/* ---- 7 · typed item ---- */
await page.locator('#host-t1 textarea').fill('Judged when a team-mate plays the ball; compare to second-last opponent and the ball; level is onside.');
await page.locator('#host-t1 .btn', { hasText: 'model answer' }).click(); await page.waitForTimeout(200);
const boxes = page.locator('#host-t1 input[type=checkbox]');
const n = await boxes.count();
ok('typed item has 2-4 criteria checkboxes', n >= 2 && n <= 4);
for (let i = 0; i < n; i++) await boxes.nth(i).check();
ok('typed all-criteria marks ledger', await page.evaluate(() => M.t1 === true));
await shot('t1-revealed', '#host-t1');

/* ---- 8 · R2, R3 + mutation ---- */
await rule('#host-r2', 'he never touched the ball');
await page.locator('#host-r2 .retry').click(); await page.waitForTimeout(150);
await rule('#host-r2', 'he interfered with an opponent');
ok('R2 done', await page.evaluate(() => M.r2 === true));
await rule('#host-r3', 'beyond the whole defence when it was thrown');
await shot('r3-wrong', '#host-r3');
await page.locator('#host-r3 .retry').first().click(); await page.waitForTimeout(150);
await rule('#host-r3', 'received directly from a throw-in');
ok('R3 done', await page.evaluate(() => M.r3 === true));
await page.waitForTimeout(250);
await rule('#host-r3 .mutwrap', 'free kicks are not exempt');
ok('R3 mutation done', await page.evaluate(() => M.r3m === true));

/* ---- 9 · full-check watch + voice-toggle mid-sequence ---- */
await page.evaluate(() => {
  window.__sawDim = false;
  new MutationObserver(() => { if (document.querySelectorAll('#fw .pend').length > 0) window.__sawDim = true; })
    .observe(document.getElementById('fw'), { attributes: true, subtree: true, attributeFilter: ['class'] });
});
await page.locator('#watchfull').click();
await page.waitForTimeout(FAST ? 200 : 3000);
ok('watch running: nodes dimmed', await page.evaluate(() => window.__sawDim === true));
// toggle voice OFF mid-sequence — must complete cleanly (X.2 / XII.6)
await page.locator('#voicebtn').click();
ok('voice label flips to off', (await page.locator('#voicelabel').textContent()) === 'Voice: off');
await page.waitForFunction(() => {
  const b = document.getElementById('watchfull');
  return b.querySelector('.wl').textContent === 'Replay' && document.querySelectorAll('#fw .pend').length === 0;
}, null, { timeout: 120000 });
ok('sequence completed silently; button reads Replay', true);
ok('trace lit ends at terminal (ring present)', await page.evaluate(() => document.querySelector('#fw .leaf.stop').classList.contains('ring')));
await shot('fullcheck-traced', '#fullcheckdev');
await page.locator('#voicebtn').click(); // voice back on
// pause/resume via top bar on a fresh run
await page.locator('#watchfull').click(); await page.waitForTimeout(FAST ? 150 : 1500);
await page.locator('#pausebtn').click(); await page.waitForTimeout(300);
ok('top-bar pause: icon+label read Play', await page.evaluate(() => document.querySelector('#pausebtn .wl').textContent === 'Play' && document.getElementById('pauseicon').innerHTML.includes('M6 4l14')));
await page.locator('#pausebtn').click(); // resume
await page.waitForFunction(() => document.querySelector('#watchfull .wl').textContent === 'Replay', null, { timeout: 120000 });
ok('resumed sequence finishes', true);

/* ---- 9b · rebuild-from-memory (ungraded) ---- */
await page.locator('#rebuildstart').click(); await page.waitForTimeout(300);
ok('rebuild hides the diagram outright (visibility)', await page.evaluate(() => document.getElementById('fw').classList.contains('hiddenv') && getComputedStyle(document.getElementById('fw')).visibility === 'hidden'));
await page.locator('#rbchips .btn', { hasText: 'Did he get involved' }).click(); await page.waitForTimeout(150);
ok('rebuild wrong order answered with guidance', (await page.locator('#rbmsg').textContent()).includes('Not yet'));
await page.locator('#rbchips .btn', { hasText: 'team-mate' }).click(); await page.waitForTimeout(120);
await page.locator('#rbchips .btn', { hasText: 'goal kick, throw-in or corner' }).click(); await page.waitForTimeout(120);
await page.locator('#rbchips .btn', { hasText: 'Did he get involved' }).click(); await page.waitForTimeout(200);
ok('rebuild completes and restores diagram', await page.evaluate(() => !document.getElementById('fw').classList.contains('hiddenv')) && (await page.locator('#rbmsg').textContent()).includes('That is the order'));
await shot('rebuild-done', '#rebuilddev');

/* ---- 10 · drawer ---- */
await page.locator('#qrbtn').click(); await page.waitForTimeout(400);
ok('drawer opens', await page.evaluate(() => document.getElementById('drawer').classList.contains('open')));
ok('drawer has 6 reference entries', await page.locator('#drawer .qr').count() === 6);
await shot('drawer-open');
await page.locator('#drclose').click(); await page.waitForTimeout(400);
ok('drawer closes', await page.evaluate(() => !document.getElementById('drawer').classList.contains('open')));

/* ---- 11 · final: locks, stepper, pause banner, submit ---- */
await page.locator('#startFinal').click(); await page.waitForTimeout(700);
ok('final locks reference', await page.evaluate(() => document.getElementById('qrbtn').classList.contains('locked')));
ok('final locks dropdown', await page.evaluate(() => document.getElementById('lessonmenu').classList.contains('locked')));
ok('final locks rail', await page.evaluate(() => document.getElementById('rail').classList.contains('locked')));
ok('final locks devices', await page.evaluate(() => document.getElementById('linedev').classList.contains('locked')));
ok('stepper shows one item', await page.evaluate(() => document.querySelectorAll('#fitems .fitem.on').length === 1));
// locked reference click -> pause banner (label promise)
await page.locator('#qrbtn').click(); await page.waitForTimeout(300);
ok('locked click opens pause banner', await page.evaluate(() => document.getElementById('pausebar').classList.contains('show')));
await shot('pause-banner');
await page.locator('#pbOpen').click(); await page.waitForTimeout(400);
ok('"Pause final — open reference" opens drawer', await page.evaluate(() => document.getElementById('drawer').classList.contains('open')));
ok('paused note shows', await page.evaluate(() => document.getElementById('fpaused').style.display === 'inline'));
ok('paused: reference unlocked', await page.evaluate(() => !document.getElementById('qrbtn').classList.contains('locked')));
await page.locator('#pbResume').click(); await page.waitForTimeout(400);
ok('resume re-locks + closes drawer', await page.evaluate(() => document.getElementById('qrbtn').classList.contains('locked') && !document.getElementById('drawer').classList.contains('open')));
// answer f1 correct
await rule('#fitem-f1', "arms don't count");
ok('no verdict before submit', await page.evaluate(() => document.querySelectorAll('#fitems .opt.right, #fitems .opt.wrong').length === 0));
ok('answer marked selected', await page.locator('#fitem-f1 .opt.sel').count() === 1);
// keyboard nav
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
ok('ArrowRight advances stepper', (await page.locator('#fprog').textContent()).startsWith('Question 2'));
// f2 answered WRONG on purpose
await rule('#fitem-f2', 'he was offside when the shot was hit');
await page.locator('#fnext').click(); await page.waitForTimeout(200);
await rule('#fitem-f3', 'a save does not reset it');
await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(200);
ok('ArrowLeft goes back', (await page.locator('#fprog').textContent()).startsWith('Question 2'));
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
await page.locator('#fnext').click(); await page.waitForTimeout(200);
await rule('#fitem-f4', 'received directly from a goal kick');
ok('all answered -> locks release before submit', await page.evaluate(() => !document.getElementById('qrbtn').classList.contains('locked') && !document.getElementById('lessonmenu').classList.contains('locked')));
ok('submit enabled when all answered', !(await page.locator('#fsubmit').isDisabled()));
await shot('final-stepper', '#finalstage');
await page.locator('#fsubmit').click(); await page.waitForTimeout(600);
ok('readout shows', await page.evaluate(() => document.getElementById('readout').classList.contains('show')));
ok('score 3/4 rendered', (await page.locator('.scorebig').textContent()) === '3/4');
ok('per-objective pills', (await page.locator('.objrow').textContent()).includes('Position calls · 1/1') && (await page.locator('.objrow').textContent()).includes('Offence calls · 2/3'));
ok('every item reviewable with why', await page.locator('#readout .ritem').count() === 4);
const reteachOk = await page.evaluate(() => Array.from(document.querySelectorAll('#readout .ritem a')).every(a => document.querySelector(a.getAttribute('href'))));
ok('readout reteach links resolve', reteachOk);
ok('brief is copyable block', await page.locator('#briefpre').count() === 1 && await page.locator('#copybrief').count() === 1);
await shot('readout');
// second pass over missed
await page.locator('#retryMissed').click(); await page.waitForTimeout(400);
await rule('#readout', 'offside position alone, with no involvement');
ok('second pass tallies separately', (await page.locator('#p2score').textContent()).includes('Second pass: 1/1'));
ok('ledger f2 marked after retry-correct', await page.evaluate(() => M.f2 === true));
await shot('second-pass');

/* ---- 12 · ledger complete ---- */
ok('all ledger rows done', await page.evaluate(() => Object.keys(M).every(k => M[k])));
ok('objective chips filled', await page.evaluate(() => document.getElementById('obj1chip').classList.contains('done') && document.getElementById('obj2chip').classList.contains('done')));
await shot('ledger', '.ledger');

/* ---- 13 · voice/LINES lints ---- */
const lint = await page.evaluate(() => {
  const keys = Object.keys(LINES);
  const referenced = new Set(['gloss_hero', 'marker_orient', 'marker_final']);
  for (let i = 1; i <= 7; i++) referenced.add('seq_full_' + i);
  COMMITS.forEach(c => { referenced.add('stem_' + c.id); c.opts.forEach((o, j) => referenced.add('fb_' + c.id + '_' + j)); });
  const addR = r => { r.opts.forEach((o, j) => referenced.add('fb_' + r.id + '_' + j)); if (r.mutate) addR(r.mutate); };
  RULINGS.forEach(addR);
  FINALS.forEach(f => f.opts.forEach((o, j) => referenced.add('fb_' + f.id + '_p2_' + j)));
  const orphan = keys.filter(k => !referenced.has(k));
  const missing = Array.from(referenced).filter(k => !LINES[k]);
  const unvoiced = keys.filter(k => !VOICE[k]);
  return { orphan, missing, unvoiced, nLines: keys.length, nVoice: Object.keys(VOICE).length };
});
ok('no orphan LINES (' + lint.nLines + ' lines)', lint.orphan.length === 0);
ok('no missing LINES', lint.missing.length === 0);
ok('every line has embedded audio (' + lint.nVoice + ')', lint.unvoiced.length === 0);
// feedback voice text equals verdict text (single source)
const fbEq = await page.evaluate(() => {
  const strip = s => s.replace(/<[^>]+>/g, '');
  let bad = [];
  RULINGS.forEach(r => {
    r.opts.forEach((o, j) => { const l = LINES['fb_' + r.id + '_' + j]; if (l !== (o.ok ? 'Correct. ' : 'Not quite. ') + strip(o.why)) bad.push(r.id + ':' + j); });
  });
  return bad;
});
ok('feedback voice equals verdict text', fbEq.length === 0);
// no transcript region: no element besides known static ones contains a full spoken line
const noTranscript = await page.evaluate(() => {
  const line = LINES['seq_full_4'];
  return !Array.from(document.querySelectorAll('body *')).some(el => el.children.length === 0 && el.textContent.trim() === line.trim());
});
ok('no transcript region (spoken lines not printed)', noTranscript);
// option order variance across graded items
const variance = await page.evaluate(() => {
  const pos = [];
  document.querySelectorAll('#host-r1 .ruling, #host-r2 .ruling, #host-r3 .ruling').forEach(rl => {
    const os = rl.querySelectorAll('.opts .opt');
    os.forEach((o, i) => { if (o.classList.contains('right')) pos.push(i); });
  });
  return pos;
});
ok('correct-option position varies (' + variance.join(',') + ')', new Set(variance).size > 1);

/* ---- 14 · nothing persisted ---- */
ok('localStorage empty', await page.evaluate(() => localStorage.length === 0));
ok('sessionStorage empty', await page.evaluate(() => sessionStorage.length === 0));

/* ---- 15 · review overlay present, not overlapping topbar ---- */
ok('review launcher present', await page.evaluate(() => !!document.getElementById('rv-launch')));

console.log('\nERRORS:', errors.length ? errors.join('\n') : 'none');
console.log('FAILS:', fails.length ? fails.join(' | ') : 'none');
await browser.close();

/* ---- mobile pass (WebKit ≈ iOS Safari) ---- */
const wb = await webkit.launch();
const ctx = await wb.newContext({ ...devices['iPhone 13'] });
const mp = await ctx.newPage();
await prep(mp);
const merr = [];
mp.on('pageerror', e => merr.push(e.message));
await mp.goto(url); await mp.waitForTimeout(1800);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await mp.screenshot({ path: path.join(out, 'mobile-top.png') });
const oneRowM = await mp.evaluate(() => document.getElementById('topbar').scrollHeight <= 56);
await mp.evaluate(() => document.getElementById('s3').scrollIntoView());
await mp.waitForTimeout(600);
await mp.screenshot({ path: path.join(out, 'mobile-s3.png') });
console.log('mobile overflow px:', overflow, '(must be 0)');
console.log('mobile topbar one row:', oneRowM);
console.log('mobile ERRORS:', merr.length ? merr.join('\n') : 'none');
await wb.close();
if (fails.length || errors.length || merr.length || overflow !== 0) process.exit(1);
console.log('\nALL GREEN');
