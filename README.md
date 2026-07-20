# Teach Me

**Teach Me** is a standalone Claude Code skill for building voice-capable,
single-file interactive HTML lessons.

It is built for learning and teaching. Clear educational goals, scenario-first teaching, 
and drills with immediate feedback. 


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

## Codex status

`v0.0.1` is not a validated Codex release. The repository contains preliminary
Codex interface metadata, and much of the core instruction format is portable,
but the workflow has not yet been optimized for Codex or forward-tested on
Codex-generated lessons. A proper Codex port is planned. Until that work ships,
use this release in Claude Code.

## Requirements

- Node.js and Playwright Chromium for the render-and-inspect loop
- Playwright WebKit for the phone-sized QA pass
- Optional produced narration: OpenAI or ElevenLabs credentials and `ffmpeg`

No voice key is required. The lesson falls back to browser speech synthesis,
then to a fully silent experience. The silent version must still teach and
assess every objective.

Companion videos are optional sibling deliverables made with a separate video
production skill. The HTML lesson remains the practice and assessment layer.

## Lineage and credit

Teach Me began with my original [html-explainer](https://github.com/ds-vibe/html-explainer) skill. 

Its evidence-graded pedagogy spine adapts and extends Rebecca Fordon's
[teaching-explainer](https://github.com/rlfordon/teaching-explainer), which
itself builds on and credits `html-explainer`. Fordon's adapted rules are
identified in [`reference/pedagogy.md`](reference/pedagogy.md), and the
copyright notices are retained in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

There is no direct outcome research on interactive single-page HTML lessons.
The skill draws from better-studied approaches -- including retrieval
practice, worked examples, active learning, and multimedia coherence. 

## Safety and limitations

Generated lessons can contain mistakes. For legal, medical, financial, or
other high-stakes subjects, verify the content and cited primary sources before
relying on or distributing it. `v0.0.1` is an initial public release; the
unedited examples intentionally preserve its current rough edges.

## License

MIT. See [LICENSE](LICENSE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
