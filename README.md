# Teach Me

**Teach Me** is a tool that builds interactive educational lessons directly from Claude or Codex. Lessons have clear teaching, drills with feedback, optional voice and images, and a closed-book final. You answer a short interview, pick a teaching approach and a look, and get an html lesson that runs in your browser.

Teach Me is also an experiment in using LLMs to orchestrate a high-quality, multi-stage production pipeline - without needing another app.

## Included

- **Interview**: role-aware for students and educators
- **Materials**: bring your own or start from scratch
- **Pedagogy**: organized around what the learner is trying to *do* (run an algorithm, compute the payout, analyze the question), with clear objectives, worked examples, and immediate feedback
- **Questions**: multiple choice, typed answers, confusable-concept drills, interactive devices, and a closed-book final
- **Drill mode**: ask for drills (or add `--drills`) and get 20–60 questions as rule cards and batteries instead of a full lesson
- **Results you keep**: each lesson keeps your attempt history in your browser, shows your strongest and weakest areas, and offers a downloadable results file — feed it to your next drills request and it targets your weak spots
- **Voice and AI chat**: Want voice narration? Or an in-page chatbot? You can add both (details below)
- **Runs in**: Claude and Codex. Best in Claude Code. NOTE: QA does not work on claude.ai.
- **QA gates**: quality checks for content, citations, layout, and pedagogy
- **"Review & edit"**: Need changes? A review copy lets you edit the html directly.

## Installation

Pick one:

- **Claude apps (skill upload)**: download `teach-me-skill.zip` from the [latest release](https://github.com/ds-vibe/teach-me/releases/latest/download/teach-me-skill.zip), then upload it as a skill in **Settings → Capabilities → Skills**
- **Claude Code (plugin)**: `/plugin marketplace add ds-vibe/teach-me`, then `/plugin install teach-me@teach-me`
- **Codex or manual (skill folder)**: download `teach-me-skill.zip` (or clone the repo) and put the `teach-me` folder in your skills directory — for example `~/.claude/skills/teach-me`

Then ask for a lesson: "/teach-me hearsay," "make a lesson on liquidation preferences for a first-time founder." Answer the interview, pick a teaching approach and a look at the checkpoint, then wait for the file.

In Claude Code or Codex, the QA tooling needs Node plus Playwright's Chromium and WebKit (`npx playwright install chromium webkit`). Run `node scripts/doctor.mjs` to check your setup.

Each build creates a `lessons/<topic>` folder in whatever directory you launched Claude Code or Codex from — the finished lesson plus its working files (audio cache, screenshots, build log). Start from a folder you want that in, and put your `.env` in that folder or any parent so voice and images can find your key.

## Examples

Check out [ds-vibe.github.io/teach-me](https://ds-vibe.github.io/teach-me/) for real examples — FTC influencer disclosures, contract formation via the $82,000 thumbs-up case, Impressionism vs Expressionism, hearsay drills, and liquidation preferences. Open one in your browser and take it.

The lessons are as the skill produced them, to show real lesson quality — warts and all*. 

*Exceptions: (1) minor visual fixes in the contracts lesson and (2) the Interval Trainer is a custom built app with a few revisions. 

## Voice, rich images, and AI chat

Your lesson can include voice, rich AI images and an AI chat dock (tutor). These are optional, but worth trying. You need your own API keys - OpenAI for all three, Anthropic for chat and/or ElevenLabs for voice.

How it works depends on asset type and environment:
- Chat: Add your key to the finished lesson dock
- Voice: Add your key to the finished lesson dock OR to your .env file at build time (Claude Code / Codex)
- Images: Must add key to .env file at build time, can't add later

Rich AI images means photography-quality. Even without these, you'll still get visuals, graphs, playable animations, etc.

## Using it well

- **Start with a "short" lesson** and try it out!
- **Customize and call audibles.** The more context you give, the better the results. Add your own materials. At the checkpoint, give clear direction like "go lighter on text," "focus on a decision diagram," "tons of drills" — the skill honors them.
- **Use the checkpoint.** Before building, the skill shows 2–3 ways to organize the lesson and 2–3 looks. This is your main steering moment; redirect freely.
- **Big topics become a series.** A lesson holds at most four objectives. When honest coverage needs more, the skill proposes a split — take it. One thin mega-lesson teaches worse than two real ones.
- **Use the strongest model you have.** Expect best quality with Fable 5 or 5.6 Sol — prose, layout, teaching. Other models produce serviceable lessons, but expect flatter prose and the occasional miss the self-review doesn't catch.
- **Don't wander off mid-build.** In Claude Code or Codex the skill runs real commands that may need your permission — Node scripts, a headless browser, file writes, sometimes a web lookup. Either keep tabs on the build or auto-approve, otherwise your build may stall.

## Known limitations

- **Pedagogy**: Teach Me is informed by real evidence, but its results haven't been studied (it's brand new). 
- **Time and Tokens**: A lesson takes 1+ hours to build. That also means a lot of tokens, especially if you use a powerful model.
- **Mistakes**: Generated content can be wrong and must be reviewed before use in high-stakes settings. Study material, not professional advice.
- **Spaced repetition**: Requires manual effort. Once you finish a lesson, you can download your results and use them for --drills. But you have to remember to do it and there are no automatic reminders.

## Results and privacy

Lessons keep your quiz results in your browser only (localStorage on your machine); the readout offers the history as a downloadable JSON file, and nothing is sent anywhere. A key pasted into a finished lesson's dock stays in the page for that visit only — it is never stored or written into the file.

## What's here

| | |
|---|---|
| `skills/teach-me/SKILL.md` | the instructions Claude follows |
| `skills/teach-me/reference/` | the lesson runtime, page shell, devices, and screenshots of the quality bar |
| `skills/teach-me/scripts/` | build and QA tooling — assembly, fonts, TTS, images, lint, screenshots, the build clock |
| `.claude-plugin/` | plugin packaging, so Claude Code can install this with one command |
| `trainer/` | a standalone ear-training app built alongside the skill |

## Third-party tools and content

This skill can use **your own accounts with third-party services**, with your permission, to produce parts of a lesson:

- **OpenAI**, **Anthropic**, or **ElevenLabs** — voice narration, image generation, and the in-page chat tutor, using an API key you supply (OpenAI covers all three; Anthropic is chat, ElevenLabs is voice). At build time the key is read from your environment or a `.env` file, never requested in conversation. In a finished lesson, a key added to the page's dock stays in the page for that visit only. Usage is billed to your account under those providers' terms.
- **Wikimedia Commons** — where a lesson needs a picture of a real person, company or event, it may fetch and embed an existing file. The build restricts itself to Public Domain, CC0 and CC BY files, refuses CC BY-SA, and requires the credit line a CC BY file owes to appear on the page. Verify anything you publish. Automated license checks are a help, not a guarantee.

**You are responsible for your own compliance with third-party terms** — for how you use these tools, for their output, and for the lessons you produce with them. That includes provider terms of service, license conditions on any content the lesson embeds, and any rules that apply where you share the result.

This skill is intended for making lessons for your own learning. It is not built or intended for commercial use, and generated content in particular carries provider-specific restrictions you would need to check before using it that way.

Lessons are study material. Nothing a lesson says is legal, medical, financial, or other professional advice.

## Lineage and credit

Teach Me builds on Derek Schwede's original [html-explainer](https://github.com/ds-vibe/html-explainer) skill. Its pedagogy spine adapts and extends Rebecca Fordon's [teaching-explainer](https://github.com/rlfordon/teaching-explainer), which itself builds on `html-explainer`. Rebecca Fordon's copyright and MIT notice are retained in `THIRD-PARTY-NOTICES.md`.
