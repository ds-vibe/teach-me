# Lesson chrome and usability

`reference/design.md` owns the design system (tokens, type, palette, banned looks, contrast, spacing). These are the lesson-specific rules on top — all proven on real builds.

## The unified concept card

One repeating anatomy for every concept, rule, or exception — never a two-column jumble of rule boxes and examples with unclear pairing. **The card is the resolution, not the opener**: concepts with a real rationale get a scenario and a one-click commit ABOVE the card (step 0), so the rule text lands as the answer to a question the learner just committed on.

0. **Scenario + commit** (where the concept is a new-enough idea — judgment, not a stamp): a concrete case, two or three buttons, reveal keyed to the learner's choice. Ungraded; not part of the item battery. **The reveal's styling is keyed too** (user-mandated, 2026-07): an affirming reveal is green with a ✓, a corrective one red with a ✗ (gold ± for partly-right) — a corrective reveal dressed in the affirmative green reads as a wrong verdict mark. Ungraded means unscored, not unsignaled.
1. **Header** (accent surface): rule/concept identifier · plain-noun title · one-line gist (a compression, not a slogan) · **source link** (e.g., "FRE ↗") top-right.
2. **Rationale, when the concept earns one** — why it exists / what it's for, tied to the lesson's master rationale, labeled in the domain's idiom ("Purpose", "The sound", etc. — the literal "WHY THIS EXISTS" label was the hearsay build's framing, not a template) (+ Listen button when voiced).
3. **The source text, verbatim** — key phrases highlighted; long provisions abridged with the remainder quoted **in full** behind a `<details>` expander (paraphrase styled as source text is a QA blocker). If the page claims verbatim quotation anywhere, the claim must be exactly true.
4. **Worked example** — in the lesson's example device (testimony transcript, board position, code snippet).
5. **Quick check** — one fast item, right on the card or immediately after the card group.

Paired cards in a two-column grid get a fixed header min-height so their bodies align.

## Quick Reference shelf (default ON for legal / technical / rule-based topics)

- A side panel of compact per-item summaries — the whole rule system at a glance — plus **full-text source links** at the bottom.
- Opened from a **plainly labeled button in the persistent top bar** ("Quick Reference" — never a cryptic side tab; users miss those).
- **Sticky header and Close button** inside the panel so it can be dismissed from any scroll depth.
- **Lockable** during closed-book work; the button states why ("Reference locked"); unlocks when every final item is answered. **The lock is never a dead end**: the locked button stays clickable and opens a pause banner — "Final in progress — closed book. [Resume final] [Pause final — open reference]". Pausing reopens the reference (progress line says so); Resume re-locks; answered items persist across pause. Full pattern in js-patterns.md.
- WebKit trap: hide the closed panel with `visibility:hidden` (not only `translateX`) and set `overflow-x:clip` on the root, or the off-screen panel extends mobile scroll width.

## Source links

Every quoted primary source links out to its canonical text (statute → official text, filing → docket, spec → standard) — a small marker on the quoting element plus the full set in the Quick Reference. For US law, Cornell LII is a stable default.

## Flow and orientation

- **"Next · [section] ↓"** link at the end of every section, hero through checklist. Smooth-scroll anchors.
- Objective chips in the top bar fill as objectives complete; a **mastery checklist** section at the end tracks every gate; an all-done note appears when complete.
- Section eyebrows number the path (§1…§N) and match the roadmap in the hero.
- On phones: collapse the chips, keep title + voice toggle + Quick Reference on one slim row.

## Structural visuals

Visuals earn their place by carrying **structure the text would otherwise have to serialize** — the method as a decision diagram (the centerpiece rule; the highest-value visual a lesson has), a timeline rail for a case line or historical sequence, a comparison panel for paired tests or contrasting regimes, a spatial diagram where the worked example has real geometry. An all-text major section triggers a **check, not a mandate**: "does this material have structure a diagram would carry?" If yes, draw it; if no, text is correct — decorative illustration is the slop the QA battery already bans, and every diagram is a claim the domain-legality pass must verify.

## Layout

- **Diagrams sit beside their explaining text** (text column slightly wider), never stacked full-width; the diagram's own captions and footnotes run the full card width. **Cut any list that restates what the diagram shows.**
- Container ~1180–1280px; cards use the width; prose stays ~66–72ch. Card body text ≥16px; rule text ≥16px — lessons are read slowly, err larger than an article would.
- Practice blocks separate from teaching with a labeled divider ("Practice · §N") and real margin.
- Wide content (trees, tables) scrolls in its own `overflow-x:auto` container on small screens — the page never scrolls horizontally.
- Move the review-overlay launcher to the bottom corner (`#rv-launch{top:auto!important;bottom:16px!important}`) so it never overlaps the top bar.

## Delivery

The single self-contained file is the artifact. Phone OSes open file attachments in JavaScript-disabled previews ("the page is broken") — when mobile matters, **propose** hosting with the command ready and **wait for the user's explicit choice**. Never deploy anywhere unprompted.
