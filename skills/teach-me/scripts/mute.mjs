/* =====================================================================
   mute.mjs — keep build-time automation silent.

   WHY
   Every Playwright pass (screenshots, state walks, smoke tests, the TTS
   line-collector) loads a real lesson with voice ON, because that is how
   lessons ship. Left alone the machine talks: browser speech reads the
   narration aloud, and on a voiced build the embedded clips play too.

   WHAT THIS DOES NOT DO
   It never touches lesson state. voiceOn stays true, the toggle still
   reads "Voice: on", and nothing calls setVoiceOn(false) — the delivered
   page is unchanged. Silence is imposed on the BROWSER, not the lesson.

   HOW, without distorting timing
   - window.speechSynthesis is removed. say() then takes the estMs pacing
     branch, so a narrated sequence still takes the same wall-clock time
     it would with speech — the screenshots you take mid-sequence land on
     the same frames. (Muting speech any other way changes that pacing.)
   - Media elements are muted at play() time rather than stubbed, so
     embedded clips still fire `onended` and still pace runSeq correctly.
   - Chromium also gets --mute-audio as a backstop.

   USAGE
     import { MUTE_ARGS, muteSpeech } from './mute.mjs';
     const browser = await chromium.launch({ args: MUTE_ARGS });
     const page = await browser.newPage();
     await muteSpeech(page);          // BEFORE page.goto()
   Accepts a Page or a BrowserContext.
   ===================================================================== */

export const MUTE_ARGS = ['--mute-audio'];

const INIT = () => {
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      get() { return undefined; }
    });
  } catch { /* older engines: leave it, --mute-audio still applies */ }

  try {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.muted = true;
      this.volume = 0;
      return play.apply(this, arguments);
    };
  } catch { /* non-fatal */ }

  window.__TM_MUTED__ = true;
};

/** Install the silencer. Must be called before the first navigation. */
export async function muteSpeech(target) {
  await target.addInitScript(INIT);
  return target;
}

/** Assert the silencer actually took, after a page has loaded. */
export async function assertMuted(page) {
  const ok = await page.evaluate(
    () => window.__TM_MUTED__ === true && typeof window.speechSynthesis === 'undefined'
  );
  if (!ok) throw new Error('mute.mjs: speech was NOT muted — call muteSpeech(page) before goto()');
  return true;
}
