#!/usr/bin/env node
/* Hybrid prototype — the ASSEMBLER.
 *
 * Deterministic injection of invariant boilerplate + structural validation,
 * with ZERO touch to the creative surface. The LLM authors the full page
 * (design, layout, bespoke demos, all interactivity) but does NOT emit the
 * drop-in overlay/chat scripts; this injects those invariants and validates
 * structure. We do NOT render components from a schema — that's what loses
 * the dynamic formatting and interactive elements.
 *
 * Usage: node assemble.mjs <input.html> [--chat] [-o out.html]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = __dir; // review-mode.js and assistant-dock.js live alongside assemble.mjs in scripts/

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("-"));
if (!input) {
  console.error("usage: node assemble.mjs <input.html> [--chat] [-o out.html]");
  process.exit(1);
}
const oIdx = args.indexOf("-o");
const outPath = oIdx >= 0 ? args[oIdx + 1] : input.replace(/\.html$/i, "") + ".assembled.html";

let html = readFileSync(input, "utf8");
const did = [];

/* Detect the overlay by its JS signature (`launch.id = "rv-launch"`), NOT the bare
 * string "rv-launch" — otherwise the deck-offset CSS rule below (which mentions
 * #rv-launch) is mistaken for the overlay and injection is wrongly skipped. */
const HAS_OVERLAY = (s) => /id\s*=\s*"rv-launch"/.test(s);

/* 1) ensure the page opts the overlay in */
if (!/<body[^>]*\bdata-review-toggle\b/i.test(html)) {
  html = html.replace(/<body([^>]*)>/i, "<body$1 data-review-toggle>");
  did.push("added data-review-toggle to <body>");
}

/* 2) deck-aware: if this is a slide deck, offset the launcher so it can't collide
 *    with the deck's own top-right controls (the bug we hand-fixed on fair use). */
const isDeck = /class="[^"]*\b(slide|deck|deck-viewport)\b|data-deck\b/i.test(html);
if (isDeck && !/#rv-launch\s*\{[^}]*top:64px/.test(html)) {
  // review-mode.js parks the deck launcher bottom-left (it assumes decks put nav top-right);
  // these decks put their counter/nav at the bottom, so override to the empty top-right corner.
  // !important + bottom/left:auto are required to beat review-mode.js's inline styles.
  html = html.replace(/<\/head>/i,
    "<style>/* assembler: keep launcher clear of deck chrome */ body #rv-launch{top:64px!important;right:16px!important;bottom:auto!important;left:auto!important}</style>\n</head>");
  did.push("deck detected → offset review launcher to top-right (no collision)");
}

/* 3) inject the invariant drop-in scripts before </body>, escaping literal </script> */
function block(file, label) {
  const src = readFileSync(resolve(SCRIPTS, file), "utf8").replace(/<\/script>/g, "<\\/script>");
  return `\n<!-- ${label} — injected by assemble.mjs (invariant; do not hand-edit) -->\n<script>\n${src}\n</script>\n`;
}
let inject = "";
const wantChat = args.includes("--chat");
const wantVoiceDock = args.includes("--voice-dock");
/* review-mode is a REVIEWER tool, not a learner feature. Injecting it unconditionally
   shipped a "Review & edit" button in every delivered lesson, where it competed with the
   assistant dock for the same corner and invited the learner to edit the exam. Opt in
   with --review when building a draft to send out for comment. */
const wantReview = args.includes("--review");
if (wantChat || wantVoiceDock) {
  if (wantReview) inject += "<style>#rv-launch{top:auto!important;bottom:16px!important;right:auto!important;left:16px!important}</style>";
  inject += "<script>window.ASSISTANT_DOCK={voice:" + wantVoiceDock + ",chat:" + wantChat + "};</script>";
  inject += block("assistant-dock.js", "BYOK assistant (narration/chat)");
  did.push("injected assistant-dock.js (voice:" + wantVoiceDock + " chat:" + wantChat + ")"
    + (wantReview ? " — review launcher moved bottom-left" : ""));
}
if (!wantReview) did.push("review-mode.js NOT injected (pass --review for a reviewer build)");
else if (!HAS_OVERLAY(html)) { inject += block("review-mode.js", "Review & edit overlay"); did.push("injected review-mode.js (--review)"); }
else did.push("review-mode.js already present — skipped");
const bi = html.lastIndexOf("</body>");
html = bi >= 0 ? html.slice(0, bi) + inject + html.slice(bi) : html + inject;

/* 3.5) inline lesson-runtime.js wherever the raw HTML references it, so the
 *      deliverable is a single file. The lesson keeps <script src="lesson-runtime.js">
 *      in its raw HTML (loads the engine when opened in a browser during the build);
 *      assembly replaces it with the copy-whole engine. The /*__VOICE__*\/{} placeholder
 *      is carried through verbatim for tts.mjs to fill afterward. */
const runtimeRef = /<script\s+src=["'][^"']*lesson-runtime\.js["']>\s*<\/script>/i;
if (runtimeRef.test(html)) {
  const rt = readFileSync(resolve(SCRIPTS, "../reference/lesson-runtime.js"), "utf8").replace(/<\/script>/g, "<\\/script>");
  html = html.replace(runtimeRef,
    `<!-- lesson-runtime.js — inlined by assemble.mjs (copy-whole engine; do not hand-edit) -->\n<script>\n${rt}\n</script>`);
  did.push("inlined lesson-runtime.js");
} else did.push("no lesson-runtime.js reference — skipped (lesson inlines its own engine)");

/* 3.6) inline the shell CSS + skin. The lesson keeps two <link>s in its raw HTML —
 *      the copy-whole structural CSS and (quick mode) a skin — so it renders in a
 *      browser during the build; assembly inlines both as one <style>. Flagship omits
 *      the skin <link> and defines its own :root tokens + concept CSS instead. */
const shellRef = /<link\s+rel=["']stylesheet["']\s+href=["'][^"']*lesson-shell\.css["']\s*\/?>/i;
if (shellRef.test(html)) {
  const skinM = html.match(/<link\s+rel=["']stylesheet["']\s+href=["']([^"']*skins\/([a-z0-9-]+)\.css)["']\s*\/?>/i);
  let css = "";
  if (skinM) { css += readFileSync(resolve(SCRIPTS, "../reference/skins/" + skinM[2] + ".css"), "utf8") + "\n"; html = html.replace(skinM[0], ""); }
  css += readFileSync(resolve(SCRIPTS, "../reference/lesson-shell.css"), "utf8");
  html = html.replace(shellRef, `<!-- lesson shell (skin${skinM ? " " + skinM[2] : " — flagship: own tokens"} + structural CSS) — inlined by assemble.mjs -->\n<style>\n${css}\n</style>`);
  did.push("inlined lesson-shell.css" + (skinM ? " + skin:" + skinM[2] : " (flagship, no skin)"));
} else did.push("no lesson-shell.css reference — skipped (lesson inlines its own CSS)");

/* 3.8) inline reference/devices.css and devices.js the same way. These are optional —
 *      a lesson that uses none of the prebuilt devices links neither — but a lesson that
 *      DOES link them must not ship the link, or the deliverable stops being
 *      self-contained and lint.mjs fails it. */
const devCssRef = /<link\s+rel=["']stylesheet["']\s+href=["'][^"']*devices\.css["']\s*\/?>/i;
if (devCssRef.test(html)) {
  const css = readFileSync(resolve(SCRIPTS, "../reference/devices.css"), "utf8");
  html = html.replace(devCssRef, `<!-- devices.css — inlined by assemble.mjs -->\n<style>\n${css}\n</style>`);
  did.push("inlined devices.css");
}
const devJsRef = /<script\s+src=["'][^"']*devices\.js["']>\s*<\/script>/i;
if (devJsRef.test(html)) {
  const js = readFileSync(resolve(SCRIPTS, "../reference/devices.js"), "utf8").replace(/<\/script>/g, "<\\/script>");
  html = html.replace(devJsRef, `<!-- devices.js — inlined by assemble.mjs -->\n<script>\n${js}\n</script>`);
  did.push("inlined devices.js");
}

/* 4) validate the structural bug classes (deterministic) */
const errs = [];
/* Scan only real markup. Comments legitimately show example markup — the shell's own
   slot instructions name <section id="hero">, <section id="final">, <div id="host-r1"> —
   and scanning raw text reported every one of them as a duplicate of the element it was
   describing. Script/style bodies are excluded for the same reason: devices.js builds
   ids by string concatenation (`id="' + id + '-bar"`). */
const markup = html
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (dupes.length) errs.push("duplicate IDs (breaks getElementById widgets): " + dupes.join(", "));
// Only a --review build is supposed to carry the overlay; a learner build must not.
if (wantReview && !HAS_OVERLAY(html)) errs.push("--review passed but the overlay is missing after assembly");
if (!wantReview && HAS_OVERLAY(html)) errs.push("review overlay present in a learner build — rebuild without --review");
if (/<\/script>\s*<\/script>/.test(html)) errs.push("possible unescaped </script> in an injected block");

writeFileSync(outPath, html);
console.log("ASSEMBLED →", outPath);
did.forEach((d) => console.log("  • " + d));
if (errs.length) {
  console.log("\nVALIDATION FAILED:");
  errs.forEach((e) => console.log("  ✗ " + e));
  process.exit(2);
}
console.log("\nVALIDATION PASSED — unique IDs, scripts escaped, review overlay "
  + (wantReview ? "present (reviewer build)" : "correctly absent (learner build)") + ".");
console.log("(containment + visual correctness are verified by the Playwright QA loop, not statically.)");
