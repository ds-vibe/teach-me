# Teach Me

A skill for Claude and Codex that builds a polished, interactive HTML lesson on a topic you choose: clear teaching, drills with real feedback, optional voice and images, and a closed-book final — delivered as one self-contained file that runs in your browser.

It interviews you first (who the lesson is for, what to cover, how long, how it should look), shows you the teaching approach and style before it builds, and runs its own QA passes before handing over the file. A lesson takes roughly an hour to build.

## Examples

Six sample lessons: <https://ds-vibe.github.io/teach-me/> — hearsay drills, the Erie doctrine, FTC influencer disclosures, liquidation preferences, perioperative cardiac risk, and musical ear training. Open one in your browser and take it.

## Where it runs

- **Claude** — the Claude apps and claude.ai, including Claude Code and Claude Cowork. No local setup needed outside Claude Code.
- **Codex** — supported; the skill loads its Codex-specific runtime notes automatically.

One per-surface difference worth knowing: **generated images need an API key at build time**, so surfaces with no key configured (Cowork, or any run without one) build lessons with drawn visuals instead of AI images. Voice and chat don't have this problem — they work after the fact through the finished page with your own key.

## Getting started

Three ways in:

- **Claude Code** — `/plugin marketplace add ds-vibe/teach-me` then `/plugin install teach-me@teach-me`.
- **claude.ai / Claude apps** — download `teach-me-skill.zip` from the [latest release](https://github.com/ds-vibe/teach-me/releases) and upload it as a skill in Settings → Capabilities → Skills.
- **Manual (Codex or any skills folder)** — download the zip (or clone the repo) and put the `teach-me` folder in your skills directory, e.g. `~/.claude/skills/teach-me`.

Then ask for a lesson: "teach me hearsay," "make a lesson on liquidation preferences for a first-time founder." Answer the interview, pick a teaching approach and a look at the checkpoint, then wait for the file.

Running locally in Claude Code or Codex, the QA tooling needs Node plus Playwright's Chromium and WebKit (`npx playwright install chromium webkit`). Run `node scripts/doctor.mjs` to check your setup.

**Model matters.** Lesson quality tracks the model running the skill, and the gap shows up in judgment work: prose, layout, how much a wrong-answer explanation actually teaches. Use the strongest model you have. Smaller models produce serviceable lessons — the structure and QA gates hold — but expect flatter prose and the occasional miss the self-review doesn't catch.

## Using it well

- **Say who it's for.** "I'm a 1L and exam is in three weeks" and "I'm teaching this to my class" produce very different lessons — the teacher route builds from your own syllabus and materials.
- **Call audibles in your prompt.** "Go lighter on text," "focus on a decision diagram," "tons of drills" — the skill honors them.
- **Use the checkpoint.** Before building, the skill shows 2–3 ways to organize the lesson and 2–3 looks. This is your main steering moment; redirect freely.
- **Big topics become a series.** A lesson holds at most four objectives. When honest coverage needs more, the skill proposes a split — take it. One thin mega-lesson teaches worse than two real ones.

## Drill mode

Add `--drills` to your request (or just ask for drills) when you've already learned the material and want volume: 20–60 questions organized as rule cards and batteries, with a closed-book final. Wrong-answer feedback carries the teaching.

Every lesson and drill set ends with a **Download your results** button. Upload that file to your next drills request and it becomes the calibration: your weakest areas get the biggest batteries, your misses become the distractors, and the new session's results chain onto the same history — repeat as long as you like.

## Results and privacy

Lessons keep your quiz results in your browser only (localStorage on your machine); the readout offers the history as a downloadable JSON file, and nothing is sent anywhere.

Voice, chat and image generation are optional and use your own API key (OpenAI, Anthropic, or ElevenLabs). Without a key the lesson still builds — narration falls back to browser speech and images fall back to drawn visuals. A key pasted into a finished lesson's dock stays in the page for that visit only — it is never stored or written into the file.

## Known limitations

- **A lesson takes about an hour** and a meaningful amount of model usage. Short lessons are faster; drills are cheaper per question.
- **Lessons are frozen files.** Fixes and features added to the skill after a build don't reach lessons already built.
- **Accuracy is strong but not guaranteed.** The QA passes check facts against sources, but treat any lesson as study material, not authority — and read the disclaimers below.
- **Results live in one browser.** Move between machines with the downloaded results file, not by expecting sync.
- **Voice quality without a key is your browser's built-in speech.** Real narration needs an OpenAI or ElevenLabs key at build time or in the page's dock.

## What's here

| | |
|---|---|
| `skills/teach-me/SKILL.md` | the instructions Claude follows |
| `skills/teach-me/reference/` | the lesson runtime, page shell, devices, and screenshots of the quality bar |
| `skills/teach-me/scripts/` | build and QA tooling — assembly, fonts, TTS, images, lint, screenshots, the build clock |
| `.claude-plugin/` | plugin packaging, so Claude Code can install this with one command |
| `trainer/` | a standalone ear-training app built alongside the skill (see `EAR-TRAINER-SPEC.md`) |

## Third-party tools and content

This skill can use **your own accounts with third-party services**, with your permission, to produce parts of a lesson:

- **OpenAI** or **ElevenLabs** — text-to-speech narration, and image generation, using an API key you supply. The key is read from your environment or a `.env` file, never requested in conversation. Usage is billed to your account under those providers' terms.
- **Wikimedia Commons** — where a lesson needs a picture of a real person, company or event, it may fetch and embed an existing file. The build restricts itself to Public Domain, CC0 and CC BY files, refuses CC BY-SA, and requires the credit line a CC BY file owes to appear on the page. Verify anything you publish; automated license checks are a help, not a guarantee.

**You are responsible for your own compliance with third-party terms** — for how you use these tools, for their output, and for the lessons you produce with them. That includes provider terms of service, license conditions on any content the lesson embeds, and any rules that apply where you share the result.

This skill is intended for making lessons for your own learning. It is not built or licensed for commercial use, and generated content in particular carries provider-specific restrictions you would need to check before using it that way.

Lessons are study material. Nothing a lesson says is legal, medical, financial, or other professional advice.
