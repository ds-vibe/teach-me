# The voice pipeline (technical)

Mechanics only. What voice is for and where it goes: SKILL.md V.5 and Part X. Component code: `js-patterns.md`.

## Getting the key to the build

**A key never arrives through the conversation** (SKILL.md II.1 #7) — never read a key file yourself, never echo a value, never write one into the lesson.

`tts.mjs` finds a key from the environment or a `.env` in the project folder (it searches up to the repo root, so one `.env` there serves every run directory). `--key-file <path>` is an escape hatch for surfaces where a dotfile is awkward — `node scripts/tts.mjs lesson.raw.html --key-file key.txt`, holding `OPENAI_API_KEY=…`, `ELEVENLABS_API_KEY=…`, or the bare key; tell the user to delete it afterward.

`doctor.mjs` reports what it found and what this environment can do — writable disk, ffmpeg, provider egress — which is what lets the interview's options 1 and 2 appear only when they're real. Where the build environment can't produce audio at all (no disk, no egress), the reader-key dock still can, because generation happens in the reader's own browser; failing that, browser TTS.

## Generation

- **`LINES` is the single source of truth, read at runtime.** `tts.mjs` loads the page headless and reads `window.LINES` *after* the page's own wiring runs, so lines added by `wireVoice()` (per-option feedback) are voiced too. A static parse of the source misses them and silently leaves feedback on the browser tier. Falls back to parsing `var LINES={…}` when Playwright is unavailable.
- **Per-line audio is the sync mechanism**: one file per line; a step's visual action fires at line start and the next step waits for line end. Deterministic, no word timestamps.
- **Engines.** OpenAI `gpt-4o-mini-tts` (default `ash`) or ElevenLabs `eleven_multilingual_v2` (default voice Rachel; `TTS_VOICE_ID` for any other). Detection: `OPENAI_API_KEY` → OpenAI, else `ELEVENLABS_API_KEY` → ElevenLabs, else exit 0 with a note and build the silent lesson. Override with `TTS_ENGINE=openai|elevenlabs`. Any engine emitting one file per line slots in unchanged — the contract is only that.
- **Env:** `TTS_ENGINE` · `TTS_VOICE` · `TTS_VOICE_ID` · `TTS_MODEL` · `TTS_SPEED` (default 1.25, applied via ffmpeg `atempo`) · `TTS_INSTRUCTIONS` (OpenAI only).
- **Cache is keyed by content**, not id — `(engine|voice|speed|instructions|text)` — so editing a line regenerates only that line and a pure CSS change costs nothing. Cache lives in `audio/.cache.json`.
- Encode mono 64 kbps MP3, embedded as base64. Full feedback voice runs ~2–3 MB; budget in XI.1.
- **Transcript-verify** sampled takes with Whisper before shipping. Spell domain tokens for the engine: `"801 d"`, `"e4"`.

## BYOK runtime tier (`scripts/assistant-dock.js`)

When the build has no key, the **learner** supplies one instead. Injected by `assemble.mjs --voice-dock`; `--chat` adds the ask-the-page tab to the same panel and the same key field. The dock generates one MP3 per `LINES` entry in the browser and writes each into `VOICE[id]` — the same map `tts.mjs` fills at build time, so `say()` needs no changes. A line not yet generated is simply absent from `VOICE` and falls through to browser speech, so the ladder degrades per line.

A key starting `sk-` is treated as OpenAI, anything else as ElevenLabs, so a reader pastes either without choosing a provider first.

Measured on a 27-line lesson (Chromium and WebKit, `file://`):

- **First line playable ~2.5s**, on the button press — never mid-sequence. All 27 in ~18s at 5-way concurrency, in lesson order, so audio stays ahead of the reader. **Use 2 lanes for ElevenLabs** — it caps concurrency by plan and returns 429 rather than queueing; retry those with backoff.
- **Cached reload 0.1s** — no network, no second charge.
- CORS is fine: `api.openai.com/v1/audio/speech` returns `200 audio/mpeg` to a `file://` page in both engines.
- **Safari cannot persist on `file://`** — IndexedDB accepts the open and rejects the write. The dock falls back to an in-memory cache (one generation per page load) and says so. Served over HTTP, both engines persist.

Once generation succeeds the launcher must say so — "✓ Narration ready", never still "Add narration" — and where the audio can't persist (a `file://` page in Safari) the panel warns plainly not to reload, because a reload means paying again. Dock audio arrives at 1.0 while `tts.mjs` bakes 1.25x in with ffmpeg, so the dock sets `window.VOICE_RATE` and `say()` applies it; voice and instructions match the build-time defaults so the two tiers sound alike.

Rules: the key lives in the input for that page load only. Show the cost estimate before the first call and never generate without an explicit click — a key entered for chat must not silently become 30 TTS calls.

## Browser-TTS fallback tier

With an empty `VOICE` map and `window.speechSynthesis` present, `say()` speaks the `LINES` text directly. Zero bytes, no key, and `onend` gates sequences more accurately than the silent-mode word-count estimate. Ship it knowing:

- **Quality is whatever the OS ships** — decent on macOS/iOS, variable on Windows/Android. Chrome's best voices are network-backed, so only embedded MP3s are truly offline-proof.
- **Platform quirks**: iOS Safari wants the first `speak()` inside a user gesture (click-gating covers it); older Chrome cut utterances ~15s in (short per-line text avoids it); `getVoices()` populates async — use the default rather than racing the list.
- **Always race a timeout** (`estMs + margin`) against `onend`; a platform that never fires the event must not hang a sequence.
- Whisper verification applies to generated MP3s only — the fallback speaks the on-screen text by construction.

Toggle labels are set in X.1, not here.

## Testing the ladder

Load with the stub `/*__VOICE__*/{}` unreplaced and confirm the toggle reads "Voice: browser", sequences still gate, and read-along highlights still track. No rung may hang, including voice switched off mid-sequence. Required gate: XII.6.

## Self-containment

`scripts/fonts.mjs` inlines Google Fonts as data-URI `@font-face` (latin subset, woff2) — zero external requests. Run it on the raw file before assembly.
