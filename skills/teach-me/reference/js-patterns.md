# lesson-runtime.js — data contract & bespoke patterns

The recurring engine is **`lesson-runtime.js`** — copy it verbatim (SKILL § Runtime) and reference it from the raw HTML as `<script src="lesson-runtime.js"></script>`; `assemble.mjs` inlines it into the single-file deliverable. This doc covers (1) the DATA the lesson supplies for the runtime's components, and (2) the patterns the runtime does NOT own, which you hand-build. The authoritative contract is the header comment of `lesson-runtime.js`; the shapes below summarize it.

## What the lesson provides

### Data globals the runtime reads
- **`LINES`** — `{ id: "narration text" }`, the single source of truth for spoken + read-along text. `say(id)`/`runSeq` play from it. Per-option feedback lines (`fb_<item>_<opt>`) are generated INTO it by the widgets — don't hand-author those.
- **`OBJS`** — `[ { chip:"obj1chip", label:"Position calls", tag:1, keys:["r1","f1"] } ]`, one per objective (N, not fixed at 2): `chip` = topbar chip id · `label` = readout pill · `tag` = the `obj` stamped on FINALS items · `keys` = mark keys that complete it.
- **`LEDGER_ROWS`** — `[ ["markKey","row label"], … ]`, the "what you can do now" list.
- **`M`** — `{ markKey:false, … }` mastery state, one key per gate.
- **`COMMITS`** — ungraded commit cards: `{ id, host:"commit-x", tag, stem, opts:[{t, v:"ok"|"no"|"info", resp, esc?}] }`. The escape option gets `esc:true` (runtime pins it last through the shuffle).
- **`RULINGS`** — graded ruling/MC items: `{ id, mark, kind, title, tx?:[[label,text]], scen?, q, opts:[{ok?, t, why, back?:"#s1|§1 label"}], mutate?:{…same shape}, onFirst?:fn }`. `mutate` is a follow-up with one fact changed, revealed after a correct answer. **The per-item pass callback is `onFirst` (a property), never a 3rd argument** — earlier builds diverged on this.
- **typed items** — `{ mark, kind, title, prompt, model, criteria:[html, …] }`. Runtime gates the model-reveal at 80 chars and credits the mark only when EVERY criterion box is ticked.
- **`buildSorter(cfg)`** — `{ host, stim, lead?, labels:[truthyLabel, falsyLabel], mark, doneMsg, reteach?:"#s3|§3 label", rows:[{p, truth:bool, why, say?}] }`.
- **`FINALS`** — closed-book items: `{ id, obj, title, tx, q, back:"#sN|§N label", opts:[{ok?, t, why}] }`. `id` doubles as the mark key; `obj` matches an `OBJS[].tag`.
- **`LOCK_IDS`** — `["stepdev","linedev", …]`, the bespoke-device ids the runtime locks during the final.
- **`BRIEF_TITLE`, `BRIEF_SCOPE`** — the first line and scoped-out tail of the copyable readout brief.
- **`TM_SLUG`** (optional) — localStorage key for the results history; set it to the topic slug so retakes of a rebuilt lesson share one history. Defaults to a slug of `document.title`. The runtime records each final attempt, shows a running strongest/weakest-objective tally on retakes, and offers the history as a JSON download from the readout.

### Chrome DOM the markup must include
Topbar: `#voicebtn` (`#voicelabel`, `#voicelabelshort`), `#pausebtn` (`#pauseicon`), `#qrbtn` (`.long`, `.short`), each `OBJS[].chip`. Drawer/banner: `#drawer` `#drclose`; `#pausebar` `#pbResume` `#pbOpen` `#pausemsg` `#fpaused`; `#lessonmenu` (`summary` + `.menu a`); `#rail`; `#ledger`. Final: `#finalstage` `#startFinal` `#fitems` `#fprog` `#fback` `#fnext` `#fsubmitrow` `#fsubmit` `#fsubmitnote` `#readout`. Plus a host `<div>` per commit / ruling / typed / sorter.

### init()
Define an `init()` on `DOMContentLoaded` that mounts the builders and wires your bespoke devices:
```js
COMMITS.forEach(buildCommit);
buildRuling(RULINGS[0], document.getElementById("host-r1"));
buildTyped(T1, document.getElementById("host-t1"));
buildSorter(SORT);
renderLedger(); TM_initFinal();
wireChrome(); wireFinalNav(); wireVoiceChrome();
// …then your own devices, using runSeq / seqToggle / fx / fw* as needed
```
Plain ES5-style JS, no dependencies. **Real apostrophes in JS strings** — HTML entities in `textContent` render literally.

---

## Patterns the runtime does NOT own — hand-build these

### Bespoke devices
Boards, sliders, step-throughs, counting grids — the topic's own interactive centerpieces (SKILL § Interactions). Reach for the runtime's helpers: `runSeq(steps, done, btn)` for a narrated trace, `seqToggle(btn, startFn)` to make a launch button pause/resume its own sequence, and the `fx` / `fwAll` / `fwDim` / `fwShow` / `fwLit` / `fwReset` toolkit to light diagram nodes. Register any device that must lock during the final in `LOCK_IDS`.

`hl:` on a runSeq step highlights that selector while its line plays. Walkthrough steps over a device use it — the lit node is what the narration is describing. **Gloss clips over prose never do** (SKILL § Multimedia): omit `hl` and the step just plays. Don't point `hl` at a paragraph whose text the clip isn't reading.

### Ordering chips
Shuffled chips clicked into sequence; wrong click says earlier/later; slots fill green; reset rebuilds. `order.sort(function(){return Math.random()-0.5;})` — browser-side randomness is fine. (Bespoke — the runtime has no ordering builder.)

### Animated decision diagram
Grammar in SKILL.md IX.8: drawn edges, coded terminals, one exit geometry, real splits, trace lights the ending node. The proven markup (the Erie framework build) — copy this shape, don't improvise a grid:

```html
<div class="fw">                                     <!-- spine: nodes stacked, edges DRAWN between -->
  <div class="fnode"><span class="fq">START</span>A state-law claim in federal court</div>
  <div class="fedge"><span class="bar"></span></div> <!-- .bar = a real vertical connector line -->
  <div class="fnode"><span class="fq">QUESTION 1</span>Is a federal directive on point?</div>
  <div class="fedge"><span class="yes">YES → TRACK 1</span><span class="no">NO → TRACK 2</span></div>
  <div class="fsplit">                               <!-- a real fork: two labeled, color-tinted tracks -->
    <div class="track t1"><p class="th">Track 1 · Rules Enabling Act</p>
      <div class="fnode">…</div>
      <div class="leafrow">                          <!-- terminals: FILLED pills, outcome color = the answer -->
        <div class="leafcell"><p class="el">YES</p><div class="leaf fd">APPLY THE FEDERAL DIRECTIVE</div></div>
        <div class="leafcell"><p class="el">NO</p><div class="leaf st">STATE LAW (VIA TRACK 2)</div></div>
      </div>
    </div>
    <div class="track t2">…</div>
  </div>
  <p class="fnote">footnoted caveats live under the diagram, not inside nodes</p>
</div>
```

- **Question nodes** are light outlined boxes with an eyebrow label; **terminals** are filled pills; **outcome color is semantic and consistent** across the whole diagram (every federal-law outcome one color, every state-law outcome the other — never one green for two different endpoints).
- **Straight spine with exits** (no fork): exits keep ONE side and one visual identity, with a drawn stem per exit — never leaf-left / label-right siblings around a center column, and never "if yes ↓" floating in an empty column. If continue-polarity flips mid-path, the geometry must show it.
- **Default = complete diagram visible.** Watch dims (`.pend{opacity:.18}` is fine *for the Watch animation*, driven by the runtime's `fw*` toolkit), then reveals step-by-step voice-synced, then traces a worked example — the trace lights the node where the analysis **ends**, rings that terminal, and stops. (For a rebuild-from-memory drill the diagram is hidden outright, not dimmed — SKILL.md VII.3.)
- Every edge label and branch is domain-checked in QA — a wrong arrow is the worst shippable bug.
- Wrap in `.treescroll{overflow-x:auto}` with a min-width so phones scroll the diagram, not the page.

### Quick Reference drawer — markup/CSS you must get right (behavior is in the runtime)
`wireChrome` implements the drawer, the closed-book lock, and the pause banner. Your job is the markup/CSS:
- Closed state: `transform:translateX(105%)` AND `visibility:hidden` (WebKit counts off-screen transforms toward scroll width) + `html,body{overflow-x:clip}`; a sticky `.drhead` (title + Close) inside the panel.
- The locked button stays clickable, styled "Reference locked" (never `disabled`) — the runtime opens the pause banner on a locked click. The banner (`#pausebar` with `#pbResume` / `#pbOpen`) is the ONLY exit from a locked final; a locked surface must open it, never fail silently.

## State-walk QA script
Start from `scripts/qa-states.template.mjs`. Every wrong path clicked, every widget driven end-to-end, `pageerror` + `console.error` collected, key states screenshotted, then a WebKit iPhone pass asserting zero horizontal overflow. Read the screenshots.
