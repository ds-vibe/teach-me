# Teach Me 0.0.2

**Teach Me** is a tool for Claude and Codex that builds interactive, single-file HTML lessons: clear teaching, drills with feedback, optional voice and images, and a closed-book final. You answer a short interview, pick a teaching approach and a look, and get one file that runs in your browser.

## Included

- **Interview**: role-aware for students and educators — the educator route builds from your own syllabus and materials
- **Pedagogy**: lessons organize around what the learner is trying to *do* (run an algorithm, compute the payout, analyze the exam question), with clear objectives, worked examples, and immediate feedback
- **Drills**: multiple choice, typed answers, confusable-concept drills, interactive devices, and a closed-book final
- **Drill mode**: ask for drills (or pass `--drills`) and get 20–60 questions as rule cards and batteries instead of a full lesson
- **Results you keep**: each lesson keeps your attempt history in your browser, shows your strongest and weakest areas, and offers a downloadable results file — feed it to your next drills request and it targets your weak spots
- **Voice and chat**: optional narration at build time, plus a dock in the finished page where a reader adds their own key (OpenAI, Anthropic, or ElevenLabs) for narration and an in-page tutor 
- **Runs in**: Claude, Claude Code, Claude Cowork and Codex. Works best in Claude Code.
- **QA gates**: quality checks for content, citations, layout, and pedagogy

## Installation

Pick one:

- **claude.ai and the Claude apps (skill upload)**: download `teach-me-skill.zip` from the [release assets](https://github.com/ds-vibe/teach-me/releases), then upload it as a skill in **Settings → Capabilities → Skills**
- **Claude Code (plugin)**: `/plugin marketplace add ds-vibe/teach-me`, then `/plugin install teach-me@teach-me`
- **Codex or manual (skill folder)**: download `teach-me-skill.zip` (or clone the repo) and put the `teach-me` folder in your skills directory — for example `~/.claude/skills/teach-me`

The plugin and the zip contain the same skill; you only need one.

## Example snapshot

The GitHub Pages site publishes four lessons and the trainer at
[ds-vibe.github.io/teach-me](https://ds-vibe.github.io/teach-me/).

The four lessons are as the skill produced them to show real lesson quality. The only exceptions were minor visual fixes.

The Interval Trainer is different: a custom build with a few revisions.


## Lineage and credit

Teach Me builds on Derek Schwede's original [html-explainer](https://github.com/ds-vibe/html-explainer) skill. Its pedagogy spine adapts and extends Rebecca Fordon's [teaching-explainer](https://github.com/rlfordon/teaching-explainer), which itself builds on and credits `html-explainer`. Rebecca Fordon's copyright and MIT notice are retained in `THIRD-PARTY-NOTICES.md`.

## Known limitations

- A lesson takes about an hour of model time to build; drills are cheaper per question.
- In Claude Code or Codex it runs real commands the whole way and will stop to ask permission for them. Approve up front or turn on auto-approve if you're leaving it alone, or check back now and then — otherwise you return to a build that stalled early and waited.
- Fable 5 in Claude Code produces the best results, but uses a LOT of tokens.
- Lessons are frozen files — later skill fixes don't reach lessons already built.
- Generated educational content can be wrong and must be reviewed before use in high-stakes settings. Lessons are study material, not professional advice.
- Real narration needs an OpenAI or ElevenLabs key (at build time or in the page's dock) plus `ffmpeg` for build-time audio; otherwise the lesson falls back to browser speech.
- Quiz results live in one browser; move between machines with the downloaded results file.
