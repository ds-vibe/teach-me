# The QA battery

Runs on every build. This file is self-contained — the static pre-flight, the screenshot loop, and the full prose battery live here (ported from html-explainer and corrected; no cross-read required). Done = all passes clear, not "it builds and looks fine."


## Step 0 — static pre-flight (every box passes before delivery; each is a blocker)

- [ ] No emoji as icons/UI anywhere; a cohesive SVG set, CSS shapes, numerals, or nothing.
- [ ] A real type pairing via web fonts, tokens at `:root` — not the system stack.
- [ ] Horizontal space composed (wide centerpiece / full-bleed bands); prose ~60–70ch but the page is not a narrow column in empty margins.
- [ ] No decorative gradients, rainbow text, bento grids of identical cards, shadow-on-everything.
- [ ] Palette isn't the templated default (cream + lone rust accent); ≥1 accent subject-derived; color semantic.
- [ ] Theme is relevant + cohesive + legible (judged on quality, not amount; never fail a build for committing hard — only for incoherence, irrelevance, illegibility). Prose stays plain regardless of boldness.
- [ ] The JS actually runs — no syntax errors (unescaped apostrophes in strings are the classic), no undefined refs; every widget works, not just renders.
- [ ] Constructive floor: the centerpiece passes the wrongness test; every key concept has an interaction where the learner can be wrong (see pedagogy rule 3).
- [ ] Button hierarchy: primary actions solid and unmissable; secondary ghost/outline.
- [ ] Every check states its verdict in words ("✓ Correct" / "✗ Not quite") AND marks the right option — never color-only.
- [ ] Canvas/WebGL draws its first frame on load, never behind a click.
- [ ] SVG viewBox has ≥16px padding beyond content; no colliding labels at one y-level.
- [ ] Visual variety with one semantic color language; sections don't all look identical.
- [ ] Interactive content inset within the content column; no duplicated `id`s (breaks getElementById widgets).
- [ ] Contrast computed per surface, not eyeballed (≥4.5:1 body, ≥3:1 large); light and dark both if both exist.
- [ ] Spacing on the scale — even section padding, separated hero stack, equal gaps in repeated groups.
- [ ] `<h1>` plainly names the topic; title and intro editorial, not slogans.
- [ ] No stacked headers: at most eyebrow + heading before body; no `<h3>` restating its heading; no lede that adds nothing.
- [ ] No flat redundancy: each key concept has one home; a recurring model restated at NEW depth is fine, same-depth repeats are not.
- [ ] Visuals match the words — direction, order, magnitude, and legend agree with the caption.
- [ ] Accessible and responsive: semantic HTML, keyboard-operable, alt text, real mobile layout, tap targets ≥40px; fixed chrome clears scrolled content (`dvh`, safe-area).
- [ ] No content hidden at `opacity:0` awaiting `IntersectionObserver`; `.reveal` is a no-op marker.
- [ ] Review overlay inlined (`<body data-review-toggle>`) unless the user opted out.
- [ ] The sashimono test: viewed whole, the page reads as one made thing — nothing grafted on, no rhythm breaks between sections.

## The prose battery (drafting standard in SKILL.md Phase 4; this is the enforcement copy)

**Named tells** — scan for overuse of: em-dashes (three per paragraph is a tell) · loaded metaphor nouns ("the spine", "load-bearing", "connective tissue") · "it's not just X — it's Y" · staccato comparison runs · filler openers ("at its core", "put simply") · rhetorical-question transitions · meta-narration ("here's the thing") · tricolon everything · every header a declarative sentence with a period.

**Shapes a wordlist misses** (fresh-eyes read): dismiss-and-pivot ("the real story is Y") · antithesis-to-inflate · setup-then-turn ("…unprecedented. It was not.") · aphoristic one-liners — content sentences included · phantom pointers ("the note on the right" that collapses on mobile) · gating closers ("only once you see…") · precious metaphor verbs.

**The five contrastive classes (examples are the rule; name hits by class, show the plain rewrite):**
- *Verb inflation* — "Interrogate the ownership structure." → "Compare who owns what before and after financing."
- *Oblique abstraction* — "Stakeholders have competing priorities." → "Employees want upside. Investors want to limit dilution. Founders want control."
- *False compression* — "Price the grant." → "Estimate what the grant could be worth under different exit values."
- *False sophistication* — "Navigate the landscape of equity compensation." → "Learn how RSUs and stock options work."
- *Fake insight* (the most pernicious: satisfying to read, adds nothing) — "Equity is ultimately about aligning incentives." → "Startups often pay partly in equity because they cannot match big-company salaries." A tautology dressed as an observation is fake insight even when true.

Ordinary verbs win: identify, compare, calculate, explain, ask, estimate, list, choose, determine, show — never navigate, unlock, interrogate, illuminate, leverage, surface, crystallize, orchestrate, operationalize, contextualize.

**Litmus, per sentence**: who is acting, what are they doing, why; can every abstract noun become concrete; would a domain expert say it aloud? The Atlantic-editor test asks if a sentence would be flagged as performed; the clarity test asks if it makes the idea easier to get. Where they disagree, clarity wins. If the plain version is shorter, clearer, and equally accurate, it ships.

**Mechanical lint** (on the final file; read each hit — appositive dashes pass):
`grep -oE '>[^<]{12,}<' f.html | grep -nEi '\b(not|never|n.t)\b[^.]*\. (it|that|this|they) (is|was|did|are)|—[^—]{1,40}—|(^|\. )[^.]{1,50}(is|are|was|were) not[.!]'`

**Pass structure**: the slop/register pass runs through an agent that did not write the draft (the writer rationalizes its own slop); re-run on any section you edit — slop re-enters during revisions. Rank findings blocker / should-fix / optional; fail only on blockers.

## The reviewer-brief rule (non-negotiable)

Fresh-context reviewers receive **the rules and the project's veto ledger — never the writer's justifications, exemptions, or design defenses.** A writer-authored exemption in the brief defeats the pass. (Proven: an "allowed throughline" exemption written into a reviewer prompt let a metaphor system ship; the same reviewer failed the page once the exemption was removed.)

## Core passes

1. **Quote-and-cite verification** — a fresh-context agent verifies every quotation against the fetched primary source: exact wording, correct locator, correct attribution of actor. If the page claims verbatim quotation, the claim itself is checked (abridgments marked, remainders quoted in full behind expanders — paraphrase styled as rule text is a blocker). **No silent truncation inside quotation marks**: text between quote marks either matches the source through its final word or shows an ellipsis / ends at a real sentence boundary of the source — a quote cut mid-sentence with a period supplied reads as the source's full sentence and is a blocker even when every included word is accurate. Same standard for punctuation swapped in from a different edition of the text than the one cited. (Bitten twice: hearsay 801(d)(1), Erie Rules 3 and 11(a).)
2. **Domain fact pass** — every "always/never/by construction" claim checked against the lesson's own other sections; claims in display copy verified as written at double strength. **Framing devices that assert what people believe ("a common belief says…") are factual claims** — prefer perceptual framing ("at first glance…") unless the belief is sourced.
3. **Domain-legality pass** (rule-governed content — law, chess, procedure, math): every scripted animation step, every diagram branch and edge label, every item's designated answer, and every why-explanation (correct AND wrong options) is verified legal/correct in the domain. A scripted demo is a claim; a wrong arrow in a decision diagram is the worst bug a lesson can ship. Blockers, not suggestions.
4. **Slop pass** — the full prose battery above (Step 0 + named tells + shapes + the five contrastive classes), run by a non-writer agent, re-run on any edited section. Includes: metaphor systems dressing surfaces, mic-drop closers and gists, caption/verdict double-telling (the spoken-line + on-screen pair is sanctioned once; a third telling is not).
   **Register audit (beyond the named shapes — the named-shapes list has passed performed prose twice).** The reviewer judges every sentence of page copy AND the narration `LINES` against the plain-register sample in SKILL.md Phase 4, flagging: figurative verbs where a plain verb exists ("hold" for remember, "vanishes" for can-be-ignored) · forced framing nouns ("is a trade") · incantation phrasing · summarizing pronouncements ("That is the whole X") · load-bearing aphorisms. These are should-fix minimum, blockers when they carry a teaching point. Content sentences are NOT exempt — that exemption is how the last two builds shipped them. The reviewer also names every hit by its contrastive class (prose battery above) and shows the plain rewrite.
5. **Pedagogy gates** — every objective taught + checked · every scope-inventory item covered with ≥1 retrieval touch · discrimination checks present for every named confusable pair · why-feedback + retry + reteach routing on every wrong answer (quizzes included, not just section practice) · staged practice (interleaved, blocked-then-mixed, cumulative close) · **strip test**: with all voice/media removed, every objective still taught and checkable · access locks release on attempt · audience-floor (no trivial checks for the stated audience) · **item-value audit**: for every drill and check, the reviewer names what the learner must recall or produce that is not on screen at answer time — a screen-answerable item is a blocker regardless of how cleanly it runs, and a drill of the lesson's own invented fixture (rather than the target skill) is a blocker too. Answer-correctness alone does not pass an item. Also verify: typed items self-score against **named criteria** (rule-application items include the because-test), and boundary-drilled rules carry their **mutation pair** with the changed fact sitting on the actual boundary — a mutation whose answer doesn't flip (or flips for a different reason) is a defective pair. **Commit gates**: every concept with a real rationale opens scenario-commit-first (definition-first section order is a should-fix); the lesson has its one reframing opener; the centerpiece interaction passes the wrongness test (watch-only centerpiece is a blocker); history sections are causal chains with at least one predicted link, not dated timelines; micro-commits are ungraded and were NOT counted toward battery sizing.
6. **Render verification** — judge the delivered artifact: screenshots desktop AND mobile, every interactive state **including the wrong-answer paths**. Click every surface that looks interactive in every state — an element that invites a click and answers with silence is a defect; idle states respond with guidance. **Re-read the full-page render after ANY structural HTML edit** — a zero-error state walk does not verify layout; one stray closing tag silently collapses a grid.
7. **Voice verification** (when voiced) — Whisper transcript-verify sampled takes against the `LINES` map; confirm every spoken line is visible on screen when spoken; confirm nothing plays without a user gesture; confirm the voice toggle works. **Test the fallback tier**: load the page with an empty `VOICE` map (stub `/*__VOICE__*/{}` unreplaced) and confirm the toggle reads "Voice: browser", narrated sequences still gate correctly, and captions still appear — the ladder is embedded MP3 → browser TTS → silent, and each rung must not hang.

## Retroactive sweeps

**When a veto or register rule lands mid-project, re-sweep the ENTIRE artifact against it** — previously-passed content and the narration `LINES` map included. A review scoped to "only the new pieces" does not satisfy a new global rule (proven failure: a banned pronouncement survived two scoped reviews inside an already-approved spoken line). Spoken lines are the highest-risk hiding place; nobody re-reads audio.

## The state walk

A Playwright script per lesson (start from `scripts/qa-states.template.mjs`):

- Exercises every interactive path — right AND wrong answers, retries, hints, ordering exercises, drawer open/close/lock, the full closed-book final — asserting **zero page errors and zero console errors**.
- A WebKit iPhone pass asserting **zero horizontal page overflow** (known trap: an off-screen `translateX` panel still extends scroll width in WebKit — hide with `visibility` and clip `overflow-x` on the root).
- Screenshots the key states; READ them, don't just collect them.

## Order of operations

Build → assemble → screenshot loop → state walk → fix → **unbiased fresh-context review** (passes 1–5 in one brief, rules + vetoes only) → fix all blockers and should-fixes → re-run affected passes → full-page render re-read → mobile pass → deliver. Record receipts (what ran, what was found, what was fixed) in the project's planning file.
