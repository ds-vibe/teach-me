#!/usr/bin/env node
// Preflight: verifies the QA loop can actually run before a build reaches Phase 5.
// Every failure below has stopped a real first-time user.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let fail = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m, fix) => { console.log(`  FAIL  ${m}\n        → ${fix}`); fail++; };

console.log("teach-me doctor\n");

// 1. Node
const major = Number(process.versions.node.split(".")[0]);
major >= 18 ? ok(`node ${process.versions.node}`)
            : bad(`node ${process.versions.node} is too old`, "install Node 18 or newer");

// 2. Playwright module
let chromium, webkit;
try {
  ({ chromium, webkit } = await import("playwright"));
  ok("playwright module resolves");
} catch {
  bad("playwright is not installed", `cd ${root} && npm install`);
}

// 3. Browser binaries — both. WebKit is a separate download and Phase 5 requires it.
for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  if (!type) continue;
  try {
    const b = await type.launch();
    await b.close();
    ok(`${name} binary launches`);
  } catch {
    bad(`${name} binary missing`, `cd ${root} && npx playwright install chromium webkit`);
  }
}

// 4. Skill scripts present
for (const f of ["assemble.mjs", "shoot.mjs", "tts.mjs", "fonts.mjs", "images.mjs", "review-mode.js",
                 "qa-states.template.mjs", "mark.mjs", "mute.mjs", "lint.mjs"]) {
  existsSync(join(root, "scripts", f)) ? ok(`scripts/${f}`) : bad(`scripts/${f} missing`, "re-clone the skill");
}
// The gates and the optional device library — a build that silently lacks these ships
// without its floors enforced, which is exactly the failure they exist to prevent.
for (const f of ["lesson-runtime.js", "lesson-shell.css", "lesson-shell.html", "devices.css", "devices.js"]) {
  existsSync(join(root, "reference", f)) ? ok(`reference/${f}`) : bad(`reference/${f} missing`, "re-clone the skill");
}

// 5. Voice tier (optional — never blocks)
// A key may live in the environment OR in a .env file, which is what tts.mjs reads.
// Never report "no key" from the environment alone, and never print the value.
const envFileKey = [process.cwd(), root]
  .map((d) => join(d, ".env"))
  .filter(existsSync)
  .some((p) => /^(OPENAI|ELEVENLABS)_API_KEY=\S/m.test(readFileSync(p, "utf8")));
if (process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY || envFileKey) {
  ok(`voice key present (${envFileKey ? ".env file" : "environment"}) — produced narration via API`);
} else {
  console.log("  note  no voice key found (environment or .env).");
}

// 6. What this environment can actually do — the interview menu (II.1 #7) offers only
//    what passes here. A .env route is nonsense on a surface with no writable disk.
let canWrite = false;
try {
  const probe = join(process.cwd(), ".teachme-probe");
  writeFileSync(probe, "x"); unlinkSync(probe); canWrite = true;
} catch {}

let hasFfmpeg = false;
try { execSync("ffmpeg -version", { stdio: "ignore" }); hasFfmpeg = true; } catch {}

let canReach = false;
try {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  const r = await fetch("https://api.openai.com/v1/models", { method: "GET", signal: ctl.signal });
  clearTimeout(t);
  canReach = r.status > 0;          // 401 is a pass: the network got there
} catch {}

canWrite  ? ok("writable working directory — a `.env` key route is possible")
          : console.log("  note  no writable directory — do NOT offer the .env option");
hasFfmpeg ? ok("ffmpeg present")
          : console.log("  note  no ffmpeg — build-time narration unavailable");
canReach  ? ok("network reaches api.openai.com — build-time narration possible")
          : console.log("  note  no egress to the provider — build-time narration unavailable");

// Report capability; the interview (SKILL.md II.1 #7) decides which options to show.
const buildTime = canWrite && hasFfmpeg && canReach;
console.log(buildTime
  ? "  →     this environment can produce embedded narration (a .env key route works)"
  : "  →     no build-time narration here — offer the reader-key dock or browser voice");

console.log(fail ? `\n${fail} blocker(s). Fix before building.` : "\nAll clear.");
process.exit(fail ? 1 : 0);
