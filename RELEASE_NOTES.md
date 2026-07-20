# Teach Me 0.0.1

**Teach Me** is a standalone Claude Code skill for building voice-capable,
single-file interactive HTML lessons.

## Included

- **Goals Interview**: Role aware for students and/or educators
- **Grounding**: Your materials or canonical primary sources
- **Pedagogy**: Clear objectives and coverage, scenario-first teaching, and
  immediate feedback
- **Drills**: Multiple choice, typed answers, confusable-concept drills,
  mutation pairs, and a closed-book final
- **Voice**: Optional narration with OpenAI, ElevenLabs or browser voice
- **Video**: Optional companion video (uses HyperFrames and separate skill)
- **QA gates**: Quality checks for content, citations and pedagogy

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
