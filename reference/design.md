# The design system (ported from html-explainer; corrected for lessons)

The quality bar for every lesson surface. `usability.md` adds the lesson-specific chrome on top of this.

## The quality bar

**Professionally edited, purposeful, polished — the opposite of auto-generated SaaS texture.** The finished page should feel inevitable, like nail-free joinery: spacing, type, and color consistent, transitions clean, nothing arbitrary or bolted on. Judge any theme on three things, never on "how much theme":

- **Relevant** — the visual language expresses what the topic IS. Letterpress for Gutenberg works because typography is the subject; parchment for the Black Death is costume.
- **Cohesive** — one intentional world; every choice serves the subject. How far the theme goes is set by the user's straight-vs-bold pick.
- **Legible** — the floor at every intensity: per-surface contrast holds, body text reads easily, controls are obvious. A bold theme that costs legibility fails.

**Bold governs design, format, and demos — never prose.** A go-bold lesson gets committed art direction and imaginative interactions; its prose stays in the plain register (SKILL.md Phase 4) regardless. There is no "prose flair dial." This is a deliberate correction to the parent skill, which coupled the two.

## Banned looks (the slop list — enforced in qa.md Step 0)

- **Emoji as icons/UI** — the #1 slop signal. Cohesive SVG set, CSS shapes, numerals, or nothing.
- **Decorative gradients and rainbow color** — color is semantic (carries meaning) or absent.
- **The default bento grid** — a 2×2/3×3 of identical soft-shadow cards as every section's answer.
- **Generic SaaS texture** — drop shadows on everything, faux-3D, Inter-on-pure-white blandness.
- **The templated palette** — cream + a lone rust-orange accent + dark band + green/red chips. Derive at least one accent from the subject.

## Tokens, type, space

- All style in centralized tokens (`:root` CSS variables) — a restyle must be a token swap, not a hunt through markup.
- **A real type pairing** (display + text) via web fonts, never the bare system stack. Section eyebrows read as signposts: weight 600–700, ~13–14px.
- **Spacing on a 4/8px scale**, applied everywhere: even section padding, separated hero elements, equal gaps in repeated groups.
- **Contrast is per-surface.** Compute the WCAG ratio for every text/background pair (≥4.5:1 body, ≥3:1 large) — a color legible on the page fails on a dark band or tinted chip. Light AND dark themes each verified if both exist.
- **Use the horizontal space.** Prose stays ~60–70ch, but the page is not a lonely column: wide centerpiece, full-bleed bands, two-column layouts where they help. Container ~1100–1280px.
- **Square-tiled grids need explicit rows** (`grid-template-columns` AND `grid-template-rows`) or circles distort in filled states.
- **SVG viewBox padding**: ≥16px beyond content bounds on all sides, or text ascenders/descenders silently crop; no two labels at one y-level with overlapping x-ranges.
- **Motion with purpose**; never hide content at `opacity:0` behind `IntersectionObserver` (blank pages in screenshots and on some mobile browsers). `.reveal` must be a no-op marker. Respect `prefers-reduced-motion`.
- **Meaningful graphics — the "so what" test.** Every graphic encodes a relationship; if its one takeaway can't be named in a sentence, it's decoration. Match form to data: spectrum → dot plot · sequence with real gaps → true-scale timeline · part-to-whole → bar/meter · process → flow · "what applies" → matrix. A clean conventional chart beats an exotic one.

## The concept pass (art direction — run at the checkpoint, both straight and bold)

Ideate 2–3 *distinct* directions and commit to the strongest; defaulting is what makes builds generic. Derive from the chosen concept: typefaces that express it, a subject-derived semantic palette, substrate, one recurring motif. Traps: the **era-match costume** (old topic → parchment+serif is a skin, not a concept) and the **swap-litmus** (a look transferable to a different topic unchanged isn't finished). Straight mode still gets one subject-derived element so it reads as *this* topic. Pitch directions as rendered style frames, never text labels.

## Reading shapes

- **Scrolling page** (lesson default): reference, jump-back, side-by-side comparison, depth-on-demand.
- **Deck** (when the material is a linear narrative with discrete beats): one concept per slide; scroll *within* an overflowing slide; advance by buttons AND keyboard (←/→, PageUp/Down, Space) AND swipe — never trap the keyboard; always-visible progress ("4/11"); slide synced to URL hash; quiz inside a deck paginates one question at a time with its own controls. Fixed chrome never overlaps scrolled slide content (`100dvh`, safe-area insets).

## Drop-in widgets (now local to this skill: `scripts/`)

- **`review-mode.js`** — the Review & edit overlay; injected by `scripts/assemble.mjs` by default (`<body data-review-toggle>`). Reviewers edit text in place or leave notes; "Copy notes for LLM" emits a revision brief. Per-browser, no server.
- **`chat-dock.js`** — BYOK "ask the page" chat, injected with `assemble.mjs --chat` when the user opted in. Reader's own key, in memory only; never ship a project key in client code.
