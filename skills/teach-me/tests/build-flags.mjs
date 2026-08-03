/* What assemble.mjs puts in the file, per flag. No browser — this is about what
   gets injected, not what it does once loaded.

   Worth having because the failure mode is silent: a user picks "chat dock" at the
   interview, the flag never gets passed, and the delivered lesson looks complete.
   Nothing downstream notices, because a page with no dock is a valid page. */
import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dir = mkdtempSync(join(tmpdir(), 'tm-flags-'));
const src = join(dir, 'lesson.html');
writeFileSync(src, '<!doctype html><html><head><title>t</title></head><body><p>x</p></body></html>');

const errs = [];
const R = (name, fn) => {
  try { const v = fn(); console.log((v ? '✓ ' : '✗ ') + name); if (!v) errs.push('FAIL: ' + name); }
  catch (e) { console.log('✗ ' + name + ' — ' + e.message); errs.push('THREW: ' + name + ' ' + e.message); }
};

/* Returns the assembled HTML for a flag set. */
function build(flags, tag) {
  const out = join(dir, 'out-' + tag + '.html');
  execFileSync('node', ['scripts/assemble.mjs', src, ...flags, '-o', out], { stdio: 'pipe' });
  return readFileSync(out, 'utf8');
}
const hasDock    = h => /window\.ASSISTANT_DOCK\s*=/.test(h);
const hasOverlay = h => /id\s*=\s*"rv-launch"/.test(h);
const dockCfg    = h => (h.match(/window\.ASSISTANT_DOCK=\{voice:(\w+),chat:(\w+)\}/) || []).slice(1).join('/');
const dockCount  = h => (h.match(/BYOK assistant/g) || []).length;

// --- the learner build: neither tool, or the learner can edit their own exam
R('no flags → no dock, no review overlay', () => {
  const h = build([], 'plain');
  return !hasDock(h) && !hasOverlay(h);
});

// --- the review copy, now built for every delivery
R('--review → overlay present, still no dock', () => {
  const h = build(['--review'], 'rev');
  return hasOverlay(h) && !hasDock(h);
});
R('--review → body opts the overlay in (works from file://, no ?edit needed)', () => {
  const h = build(['--review'], 'rev2');
  return /<body[^>]*\bdata-review-toggle\b/i.test(h);
});

// --- dock variants: the three combinations a user can pick at the interview
R('--chat → dock configured chat-only', () => {
  const h = build(['--chat'], 'chat');
  return hasDock(h) && dockCfg(h) === 'false/true' && dockCount(h) === 1;
});
R('--voice-dock → dock configured voice-only', () => {
  const h = build(['--voice-dock'], 'voice');
  return hasDock(h) && dockCfg(h) === 'true/false' && dockCount(h) === 1;
});
R('--voice-dock --chat → ONE dock carrying both', () => {
  const h = build(['--voice-dock', '--chat'], 'both');
  return hasDock(h) && dockCfg(h) === 'true/true' && dockCount(h) === 1;
});

// --- the two tools together: they claim the same corner unless one is moved
R('--review --chat → both present, review launcher moved off the dock', () => {
  const h = build(['--review', '--chat'], 'revchat');
  return hasOverlay(h) && hasDock(h) && /#rv-launch\{[^}]*bottom:16px!important/.test(h);
});

rmSync(dir, { recursive: true, force: true });
console.log('\n' + (errs.length ? ('❌ ' + errs.length + ' problem(s):\n' + errs.join('\n')) : '✅ all build-flag checks passed'));
process.exit(errs.length ? 1 : 0);
