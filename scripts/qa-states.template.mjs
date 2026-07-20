// teach-me state walk — copy per lesson, fill the TODOs, keep the structure.
// Drives EVERY interactive path (wrong answers included), collects page/console errors,
// screenshots key states, then a WebKit iPhone pass asserting zero horizontal overflow.
// Run: node qa-states.mjs   (symlink html-explainer's node_modules for playwright)
import { chromium, webkit, devices } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const LESSON = 'lesson.html';                       // TODO
const url = 'file://' + path.join(here, LESSON);
const out = path.join(here, 'shots-states');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto(url); await page.waitForTimeout(700);

const shot = async (name, sel) => (sel ? page.locator(sel).first() : page)
  .screenshot({ path: path.join(out, name + '.png') });
const rule = async (rootSel, frag) => {                    // answer an MC item by option text
  await page.locator(rootSel + ' .opt', { hasText: frag }).first().click();
  await page.waitForTimeout(200);
};
const typedDo = async (rootSel, score) => {                // complete a typed self-score item
  await page.locator(rootSel + ' textarea').fill('An attempt long enough to unlock the model answer.');
  await page.locator(rootSel + ' .btn', { hasText: 'model answer' }).click();
  await page.locator(rootSel + ' .ss', { hasText: score }).click();
};

// TODO per lesson — the walk MUST include, in lesson order:
//   1. every narrated sequence played to completion (wait generously; voice > silent timers)
//   2. every MC/ruling item: one WRONG answer (screenshot the verdict + reteach pointer),
//      retry, then the right answer
//   3. every typed item via typedDo()
//   4. ordering / bespoke widgets: wrong path first, then complete
//   5. quick-reference drawer: open, close; closed-book final: start (assert locked),
//      answer all items (assert unlocked), screenshot progress
//   6. the mastery ledger fully checked (screenshot)

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

// ---- mobile pass (WebKit ≈ iOS Safari) ----
const wb = await webkit.launch();
const ctx = await wb.newContext({ ...devices['iPhone 13'] });
const mp = await ctx.newPage();
const merr = [];
mp.on('pageerror', e => merr.push(e.message));
await mp.goto(url); await mp.waitForTimeout(1500);
const overflow = await mp.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
await mp.screenshot({ path: path.join(out, 'mobile-top.png') });
console.log('mobile overflow px:', overflow, '(must be 0)');
console.log('mobile ERRORS:', merr.length ? merr.join('\n') : 'none');
await wb.close();
