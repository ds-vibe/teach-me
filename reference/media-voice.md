# Voice and animation

Voice is optional — the lesson must teach in silence, and the strip test verifies it. When voice is on, it does real teaching work: narrated walkthroughs for worked examples, spoken why-feedback on wrong answers, spoken rationales on concept cards. All patterns below are proven on real builds.

## The voice pipeline

- **One `LINES` map is the single source of truth** — a JS object `{id: "spoken text", …}` in the page. `scripts/tts.mjs` parses the page's own map and generates one audio file per line, so spoken audio and on-screen text can never drift; changing a line's text forces regeneration.
- **Per-line audio is the sync mechanism**: each narration line is its own file; a step's visual action (diagram node lighting, board move, highlight) fires at line start, and the next step waits for line end. Deterministic sync, no word timestamps.
- Provider: OpenAI `gpt-4o-mini-tts` (voice/speed configurable; 1.25× applied via ffmpeg `atempo`) or ElevenLabs. Mono 64 kbps MP3, embedded as base64 data URIs. Budget: ~30 lines ≈ 1.3 MB.
- **Transcript-verify** sampled takes with Whisper before shipping — wording and term pronunciation (spell domain tokens for the speech engine: "801 d", "e4").
- **Degrade ladder: embedded MP3 → browser TTS → silent captions.** No key does not mean no voice — the engine falls back to `speechSynthesis` with the same `LINES` text (see js-patterns.md), and only goes silent where that too is unavailable. The strip test still guarantees the bottom tier teaches.

## Browser-TTS fallback tier

When the `VOICE` map is empty but `window.speechSynthesis` exists, `say()` speaks the `LINES` text directly. Zero bytes, no key, and `onend` gives *more* accurate sequence gating than the silent-mode word-count estimate. Ship it with eyes open:

- **Label the toggle "Voice: browser"** so the drop from the produced persona to a platform voice reads as intentional, not broken. "Voice: on" is reserved for embedded audio.
- **Quality is whatever the OS ships** — decent on macOS/iOS, variable on Windows/Android. Never advertise the fallback as equivalent; Chrome's best voices are network-backed, so only embedded MP3s are truly offline-proof.
- **Platform quirks**: iOS Safari wants the first `speak()` inside a user gesture (click-gating covers this); older Chrome cut utterances ~15s in (short per-line text avoids it); `getVoices()` populates async — use the default voice rather than racing the list.
- **Always race a timeout** (`estMs + margin`) against `onend` — a platform that silently never fires the event must not hang a narrated sequence.
- Whisper transcript-verify applies to generated MP3s only; the fallback speaks the on-screen text by construction.

## On-screen rules

- **Every spoken line is visible while spoken, in exactly one place**: the caption area during narration sequences; the verdict box for feedback lines (the verdict text ≈ the spoken sentence). Captions never echo verdicts — double-telling is the most common prose defect.
- **Transcripts appear during playback only.** Caption areas start empty or with a short prompt; never print narration as static default text.
- **Reserve fixed heights** for any element whose text changes during playback — reflow while audio plays reads as broken. Size to the longest line.
- **Nothing plays sound without a click.** Narration behind a Watch/Listen button; feedback voice fires on the learner's own answer click (a user gesture). Global voice toggle in the top bar.
- **Every narrated sequence is pausable** (user-mandated, 2026-07). The launch button toggles Pause/Resume while its sequence plays — audio pauses, silent-mode timers freeze, and the next step's visual action holds until resume. Starting a different sequence cancels the running one and resets its button. Implementation (pause-aware `wait`, `pauseGate`, `seqToggle`, `.wl` label spans) in js-patterns.md — bind every Watch/Listen button through `seqToggle`, never a bare click handler.

## Buttons and affordances

- **Audio controls carry a speaker icon and a color distinct from navigation CTAs** — a text-only "Play" in the CTA color is invisible. Inline SVG, no emoji.
- **Animation triggers carry a camera/video icon** ("Watch"). Place the Watch button in the diagram card's header, not below the fold of the card.
- Small "Listen" buttons on concept cards sit in the label row of the section they voice (e.g., beside the card's rationale label).

## Animation

- **Synthetic motion is live HTML/CSS/JS, not video files.** Rendering an HTML animation to MP4 and embedding it back is a lossy round trip. Reserve actual video for real footage or screen capture — rare in lessons.
- The proven shape: an **animated diagram or worked demo built step-by-step, voice-synced** (per-line gating), then **traced** on a concrete example — and later **rebuilt by the learner** (ordering chips, replay-from-memory). One component serves demo and practice: the watch-board and the practice-board are the same object, so the watch→do transition is seamless.
- Default state shows the COMPLETE diagram; pressing Watch dims and rebuilds it progressively. Never ship interaction-gated content as the default view.
- Respect `prefers-reduced-motion`: transitions off, sequences land instantly.

## Companion video (optional sibling deliverable)

When commissioned at interview (the offer is always made; if `video-explainers` is missing, the interview flags the install requirement and the video phase waits for it — the lesson never does), a fully produced short video ships **beside** the lesson, never inside it. The division of labor is fixed:

- **The video is an advance organizer, not a compressed lesson**: a 3–5 minute high-level gloss of what the page will teach — the problem felt concretely, the shape of the method, what the learner will be able to do — for pre-session orientation (educator's class) or first-contact/replay (learner). It previews the teaching; it does not render every card, and it is never the practice layer: no items, no checks, no mastery claims. The lesson remains the only artifact where learning is verified.
- **The companion script follows a fixed 7-part shape** (user-mandated, 2026-07): (1) an arresting cold-open image · (2) a plain "what is an X?" definition · (3) a fast, explicit one-sentence declaration that this is a companion to a deep-dive interactive page · (4) the basics of the topic, taught plainly · (5) a few tantalizing hints of the page woven through · (6) what you'll learn FROM the page, as concrete capability statements ("you'll store a ten-item list and recall it backwards") — never a feature list · (7) wrap + CTA. Declare the page relationship by scene 3; a lesson referenced mid-video without introduction is a logic-pass failure. **Register: brisk, straightforward spoken prose — applied at DRAFTING time, not repaired at QA** — subject-verb-object, one idea per sentence, at most two arresting images per video; the lesson's plain-register rule (SKILL.md Phase 4) applies to narration at double strength. Communicating, not showing off.
- **Deferral lines, woven in — not just an outro CTA.** At the 2–3 natural compression points where the video glosses what the page does deeply, the narration says so explicitly: "the page walks every exception with the actual rule text" · "you'll rule on eight patterns cold in the final." Each deferral names a REAL feature of the delivered lesson (a promised quiz that doesn't exist is a cross-artifact consistency blocker); 2–3 maximum so the video doesn't become a trailer; the outro still lands the CTA to the lesson (video-explainers' native companion-honesty rule).
- **Content is bound; treatment is not.** The video brief is generated FROM the lesson's Phase 1 architecture — same objectives, organizing structure, verbatim quotes, veto ledger — and divergence between the two artifacts' *claims* is a QA blocker (cross-artifact consistency check, run with quote verification). But production is video-explainers' full pipeline at full strength: decomposition inventory (the lesson's motif as living environment, its method diagram as a set piece performed on camera), storyboard with vetoes, word-level beat sync, motion QA. Do not floor it to slides-in-motion out of caution — decomposition is that skill's default, and the well-produced version is the point of commissioning one.
- **Mechanics belong to video-explainers.** Hand off via a build brief (the programmatic-harness pattern); never edit that skill. Source mode = inherit the lesson's design system (its default). Voice: **default OpenAI `ash` at 1.25× for BOTH lesson and video** — full voice continuity via video-explainers' project-local OpenAI sidecar lane (`openai-tts.mjs` pattern, documented in its pipeline reference); ElevenLabs/HeyGen only if the user asks or the OpenAI lane is unavailable. Apply per-line ~10ms edge fades when assembling narration audio — hard-cut per-line WAVs click at scene boundaries.
- **The video script is claims.** It passes the same unbiased review as the lesson — quote verification and domain-legality on every scripted beat — BEFORE render, when fixes are cheap.
- **Don't embed the MP4 in the lesson** (blows the size budget, duplicates the live engine); don't link to it from the lesson either (breaks self-containment — the CTA direction is video → lesson only). Two files, delivered together, both recorded in PROJECT.md with receipts.
- Skip the offer when the topic's payoff is purely interactive — a companion video of an interaction is a screenshot of a conversation.

## Self-containment

`scripts/fonts.mjs` inlines Google Fonts as data-URI `@font-face` (latin subset, woff2) — the file becomes fully offline- and CSP-proof with zero external requests. Run it on the raw file before assembly. Total budget: keep the finished lesson ≈ 4 MB or under.
