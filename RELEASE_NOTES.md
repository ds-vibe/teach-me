# Teach Me 0.0.1

The first public release of Teach Me: a standalone Claude Code and Codex skill
for building voice-capable, single-file interactive HTML lessons.

## Included

- A role-aware interview for educators and learners
- Grounding in user materials or canonical primary sources
- Observable objectives and a concept-by-concept coverage plan
- Scenario-first teaching and immediate why-feedback
- Confusable-concept drills, mutation pairs, typed criteria checks, and a
  closed-book final
- Optional narration with browser and silent fallbacks
- An optional companion-video brief
- Desktop, phone-sized, interaction-state, source, prose, pedagogy, and domain
  QA gates
- Claude Code and Codex installation metadata

## Unedited example snapshot

The GitHub Pages site publishes three HTML lessons and one Erie Doctrine
companion video exactly as they were produced by following the `v0.0.1` skill
in Claude Code.

They received no hand-editing, post-generation cleanup, or showcase pass.
Imperfections remain on purpose. These are evidence of the release's actual
out-of-the-box quality, not a promise that every output is flawless.

View them at
[ds-vibe.github.io/teach-me-this](https://ds-vibe.github.io/teach-me-this/).

## Lineage and credit

Teach Me builds on Derek Schwede's original
[html-explainer](https://github.com/ds-vibe/html-explainer) skill. Its
evidence-graded pedagogy spine adapts and extends Rebecca Fordon's
[teaching-explainer](https://github.com/rlfordon/teaching-explainer), which
itself builds on and credits `html-explainer`.

Rebecca Fordon's copyright and MIT notice are retained in
`THIRD-PARTY-NOTICES.md`, and adapted pedagogy rules are marked in
`reference/pedagogy.md`.

## Known limitations

- This is an initial release; the published artifacts retain visible rough
  edges.
- Generated educational content can be wrong and must be reviewed before use
  in high-stakes settings.
- Produced narration requires an API key and `ffmpeg`; otherwise the lesson
  uses browser speech or remains silent.
- Companion-video production requires a separate video production skill.
