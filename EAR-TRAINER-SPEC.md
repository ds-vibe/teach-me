# Interval Trainer — spec (v1)

A standalone single-file ear-training app. The gym to the *Hearing Intervals* lesson's classroom. Bold but clean; minimal prose — the teaching lives in the drill loop, the reveal, and the replay.

## Design language

Carry over from the intervals lesson: cream / black / rust-red, poster caps for level titles, one drawn subject element. No emoji, no gradients, no card grids. Text budget: a level intro is **two lines max**; everything else is chrome labels and feedback lines. The two persistent objects (keyboard, ladder) ARE the design.

## The one core object

**Everything lives on one horizontal axis: pitch rises to the right.** No vertical ladder anywhere — one spatial metaphor, never rotated.

**The Keyboard.** Two octaves (C3–C5), drawn SVG/CSS, correct geometry (this is a conventional form — real key widths, black-key placement; measure with getBoundingClientRect). Three jobs:
1. **Demonstrate** — any interval the app plays lights its two keys in sequence, with the anchor lyric under them ("Some-where" over C→C).
2. **Input** — the learner clicks keys to answer. Keys sound on click (immediate audio feedback, always).
3. **Reveal** — after any answer: correct pair lit in green, the learner's wrong key (if any) in rust, then **comparison replay** — your interval, then the right one, back to back. The replay is the teacher; no paragraph explains what the two sounds just did.

**Step counts ride on the keyboard, not beside it.** Distance shows as a bracket arcing over the span from root key to landing key, labeled with the count ("9 steps") — the keyboard says which notes, the bracket says how far, one object saying both.

**The intro morph (level 0 only).** The lesson's ladder appears once, laid flat — a horizontal strip of rungs — then the rungs widen into piano keys in a single animation: "each rung is a key." After that the ladder never returns; the keyboard is the whole visual language.

## Audio

- **Piano (primary): Salamander Grand samples, CC-BY** — ~6 sampled pitches spread across C3–C5, pitch-shifted between them (≤3 semitones shift each way keeps it honest). One credit line in the footer. Budget ~1 MB.
- **Violin (variety tier): VSCO 2 CE, CC0** — 4 sustained samples. No credit required.
- **Synth (fallback + third timbre):** the lesson's oscillator engine, zero assets.
- All playback through one WebAudio engine: melodic (sequential) and harmonic (simultaneous) modes.

**Root progression — fixed first, then roving.** Early levels anchor every interval on C: one less variable while the sounds are new, and the keyboard picture stays stable. Difficulty then comes partly from moving the root: first other white keys (E→B, G→E), then black-key roots (E→C#, F#→D#). By the gauntlet, fully roving roots — so nobody memorizes absolute pitches, they learn distances. The root progression is a difficulty axis alongside interval count, direction, and timbre.

## Curriculum — 12 intervals, staged

Anchors below are the working list; **verify each at build time** (octave = "Somewhere Over the Rainbow", NOT the major sixth — the sixth is "My Bonnie" / NBC chimes).

| Level | New material | Roots | The point |
|---|---|---|---|
| 0 · Start here | Octave, P5, M3 (imports the lesson's three anchors) | C only | On-ramp; skippable via placement drill |
| 1 · The frame | + P4 ("Here Comes the Bride") | C only | **P4 vs P5** — first confusion pair |
| 2 · Major/minor | + m3 ("Smoke on the Water"), m6, M6 ("My Bonnie") | white keys | **m3 vs M3**, m6 vs M6 — the money discriminations |
| 3 · The edges | + m2 ("Jaws"), M2 ("Happy Birthday"), m7, M7 ("Take On Me"), tritone ("The Simpsons") | any root | Full ascending set |
| 4 · Descending | All 12, downward | any root | New anchors (v2 if needed) |
| 5 · Harmonic | Both notes at once | any root | Chord-hearing gateway |
| 6 · The gauntlet | Mixed timbre (piano/violin/synth), mixed direction, adaptive | roving | Transfer — the timbre-generalization fix |

Levels gate on a rolling mastery bar (e.g., 8 of last 10). Locked levels visible and grayed — the map is the motivation.

## Question types

1. **Hear → name.** Interval plays; pick from the level's interval buttons. (The lesson's format.)
2. **Hear → play.** Interval plays with the root key lit; **click the key where it lands.** Wrong key = feedback in the answer's own terms: "you played a fifth — two steps short," both intervals replayed.
3. **Build.** "Play a major sixth up from E." No audio prompt — the learner produces it cold on the keyboard, then hears what they built. (Production; hardest; the one that transfers to real musicianship.)
4. **Anchor match.** Interval plays; "which song starts like this?"
5. **Odd one out / speed rounds** (v2): three pairs, one different; timed streaks.

Every type keeps the replay-forever rule: any sound can be re-heard, unlimited, including inside a question.

## Adaptive engine

- Per-user **confusion matrix** (answered × correct). Question selection weights toward the learner's worst pair, ~70/30 weighted-to-random so it never tunnels.
- Root and timbre randomized within level rules.
- **Stats panel:** per-interval accuracy bars, current streak, confusion heatmap ("you mix up m6 and P5"), sessions log. All localStorage; nothing leaves the browser.

## What v1 ships

Levels 0–3 ascending · piano + synth · question types 1–3 · adaptive engine · stats · the level map with 4–6 grayed out. **v2:** descending, harmonic, violin, anchor-match, speed rounds.

## Non-goals

No accounts, no server, no notation reading (the keyboard is the visual language, not the staff), no chord identification (that's the next product).

## Publish

Self-contained HTML, no external requests (samples as data URIs). Target < 8 MB. Footer: Salamander piano credit (CC-BY), VSCO2 (CC0, credit optional), "AI-built, sounds sampled from real instruments."
