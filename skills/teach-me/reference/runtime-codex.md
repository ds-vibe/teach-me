# Codex runtime

Apply this file only when running `teach-me` in Codex. `SKILL.md`
remains the source of truth for pedagogy, scope, and delivery requirements.

## Interview and checkpoint

- Treat facts, choices, and uploaded materials already supplied by the user as
  answered. Do not ask for them again.
- Collect only the unanswered canonical interview decisions: role, learning
  goals and trouble areas, current ability, lesson length, visual direction,
  and AI extras.
- Use structured or clickable input when the active surface supports it. Use a
  concise numbered prompt otherwise. Explain BYOK in plain language.
- Do not research or build before the interview is settled.
- At the canonical checkpoint, show the selected 2–3 real style frames and
  teaching approaches. Wait for the user's choice before building the lesson.

## Sources, keys, and permissions

- Inspect attached and local materials first. When the user requests canonical
  material, browse for authoritative primary or official sources.
- Request scoped approval when a sandbox boundary blocks an in-scope command.
  A restricted browser launch or network probe can fail inside the sandbox even
  when the installed capability works, so verify outside it before reporting a
  missing dependency.
- Never ask for or accept an API key in chat. Check only whether an environment
  variable, project `.env`, or user-named key file exists; never print its value.
- If voice or chat was selected and no build-time key is available, retain the
  finished page's reader-key dock. Do not silently substitute browser speech.
- If generated images were selected but no build-time key is available, use
  drawn teaching visuals or omit the generated images. Do not ship broken image
  placeholders or claim that images were generated.

## Build and browser work

1. Keep a short plan through interview, checkpoint, build, and verification.
2. From the lesson workspace, run
   `node <skill-root>/scripts/doctor.mjs --from <lesson-workspace>` before
   building. Do not change into the skill root first; capability and key
   discovery must begin from the workspace where the lesson will be built.
3. Create the lesson in its own suffixed directory and stamp the canonical
   build clock at each required milestone.
4. Use the canonical shell, runtime, assembler, media scripts, lint, and adapted
   state-walk script. Do not rewrite their behavior inside a lesson.
5. Serve the assembled artifact over local HTTP for browser inspection. Do not
   use `lesson.raw.html` or rely on a `file://` preview.
6. Inspect desktop and mobile screenshots and exercise the real interactions.
   Treat deterministic Playwright checks and visual inspection as separate
   evidence.

## Independent review

- Two independent fresh-context reviewers in parallel, whatever the length: the
  canonical rules-and-accuracy reviewer and the cold learner reviewer. A short
  lesson is a shorter lesson, not a cheaper build — see SKILL.md § Quality checks.
- Give reviewers the artifact, sources, user choices, and applicable rules only.
  Do not provide the writer's rationale or expected findings.
- Reviewers report evidence and do not edit. Merge findings, fix blockers once,
  then rerun lint and the affected browser checks.

## Delivery receipt

Report the assembled learner file, lesson length, included AI extras, source
grounding, lint result, browser/state checks, screenshots inspected, independent
review result, defects fixed, and any intentionally omitted scope. Claim only
checks that actually completed.
