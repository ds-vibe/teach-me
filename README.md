# Teach Me

Teach Me is a Claude Code and Codex skill that turns a topic and its source
material into a voice-capable, single-file interactive HTML lesson.

It is built for learning rather than presentation: observable objectives,
scenario-first teaching, practice with why-feedback, discrimination between
confusable concepts, typed self-assessment against concrete criteria, and a
closed-book final.

**[See the unedited v0.0.1 outputs](https://ds-vibe.github.io/teach-me-this/)**

## A truthful quality snapshot

The examples are the exact files produced by following this skill in Claude
Code. They have not been hand-edited, polished for a showcase, or repaired
after generation. Their imperfections are included deliberately: the examples
show the quality and limitations you should expect out of the box from
`v0.0.1`.

The published snapshot contains:

- an Erie Doctrine lesson with its companion video;
- a Hearsay lesson; and
- an RSUs vs. Options lesson.

Each lesson is one self-contained HTML file. Fonts, narration, interactions,
feedback, and the final live inside the file.

## What the skill does

1. Interviews the educator or learner about grounding material, audience,
   scope, prior capability, teaching shape, voice, and optional AI chat.
2. Designs the pedagogy before the page: objectives, misconceptions, concept
   atoms, confusables, practice coverage, and transfer.
3. Presents real visual frames and teaching-mechanics choices before building.
4. Produces the interactive lesson, optional narration, and an optional brief
   for a companion video.
5. Exercises correct and incorrect paths, checks desktop and mobile renders,
   verifies source quotations, and runs a fresh-context domain and pedagogy
   review.

## Install

### Claude Code

```bash
git clone https://github.com/ds-vibe/teach-me-this.git ~/.claude/skills/teach-me
```

Then ask naturally:

```text
Teach me the hearsay rule.
```

Or invoke the skill directly:

```text
/teach-me the hearsay rule
```

### Codex

```bash
git clone https://github.com/ds-vibe/teach-me-this.git \
  "${CODEX_HOME:-$HOME/.codex}/skills/teach-me"
```

Then ask:

```text
Use $teach-me to teach me the hearsay rule.
```

## Requirements

- Node.js and Playwright Chromium for the render-and-inspect loop
- Playwright WebKit for the phone-sized QA pass
- Optional produced narration: `OPENAI_API_KEY` and `ffmpeg`

No voice key is required. The lesson falls back to browser speech synthesis,
then to a fully silent experience. The silent version must still teach and
assess every objective.

Companion videos are optional sibling deliverables made with a separate video
production skill. The HTML lesson remains the practice and assessment layer.

## Lineage and credit

Teach Me began with the design system, single-file build approach, and
render-inspect-revise quality loop from Derek Schwede's original
[html-explainer](https://github.com/ds-vibe/html-explainer) skill. Those pieces
are now included here, so Teach Me installs as a standalone skill.

Its evidence-graded pedagogy spine adapts and extends Rebecca Fordon's
[teaching-explainer](https://github.com/rlfordon/teaching-explainer), which
itself builds on and credits `html-explainer`. Fordon's adapted rules are
identified in [`reference/pedagogy.md`](reference/pedagogy.md), and the
copyright notices are retained in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

There is no direct outcome research on interactive single-page HTML lessons.
The skill draws carefully from better-studied approaches—including retrieval
practice, worked examples, active learning, and multimedia coherence—without
claiming that the artifact format itself has proven learning gains.

## Safety and limitations

Generated lessons can contain mistakes. For legal, medical, financial, or
other high-stakes subjects, verify the content and cited primary sources before
relying on or distributing it. `v0.0.1` is an initial public release; the
unedited examples intentionally preserve its current rough edges.

## License

MIT. See [LICENSE](LICENSE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
