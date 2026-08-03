import { readFileSync, writeFileSync, copyFileSync } from 'fs';
const raw = readFileSync('/Users/derek/teach-me/lessons/offside-CTRL--0bv3/lesson.raw.html','utf8');
const cut = raw.indexOf('<script>');
let head = raw.slice(0, cut);
// CSS for the classes the runtime emits where the original used inline styles (readout/final)
const css = `<style>
.fitem .tag{display:inline-block;font:700 12px/1 Archivo,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#22304d;background:#eef2f8;border-radius:999px;padding:6px 11px;margin-bottom:8px}
.fitem h4{font:700 18.5px/1.3 Archivo,sans-serif;margin:0 0 10px}
.fitem .q{font-weight:600;margin:12px 0 2px}
.scorehead{margin-bottom:16px}.scorebig{font:800 40px/1 Archivo,sans-serif;margin:4px 0}
.objrow{margin-top:8px}.objpill{display:inline-block;background:#eef2f8;border-radius:999px;padding:4px 11px;margin:0 6px 4px 0;font:600 13px/1 Archivo,sans-serif}
.secondline{margin-top:12px;font:600 14px/1.5 Archivo,sans-serif}
.ritem{border-top:1px solid #e6e3da;padding:14px 0}.rv{font-weight:700;margin:0 0 6px}.rv.ok{color:#2c6a4a}.rv.no{color:#9a2f2a}
.ryour{margin:8px 0 6px;font-size:16px}.rwhy{margin:0 0 8px;font-size:16px}
.retryrow{margin-top:18px}.briefbox{margin-top:18px;background:#f6f5f1;border-radius:12px;padding:16px}
.brieftitle{font:700 14px/1 Archivo,sans-serif;margin:0 0 8px}.p2head{margin-top:34px}.p2score{font:600 14px/1.5 Archivo,sans-serif;color:#5b6272}
#briefpre{white-space:pre-wrap;font:13px/1.5 ui-monospace,monospace;background:#fff;border:1px solid #e0ddd4;border-radius:8px;padding:10px;margin:8px 0}
</style>`;
head = head.replace('</head>', css + '\n</head>');
const html = head
  + '<script src="../../reference/lesson-runtime.js"></script>\n'
  + '<script src="offside-lesson.js"></script>\n'
  + '</body></html>\n';
writeFileSync('tests/offside-split/lesson.html', html);
copyFileSync('/Users/derek/teach-me/lessons/offside-CTRL--0bv3/qa-states.mjs','tests/offside-split/qa-states.mjs');
console.log('built tests/offside-split/lesson.html ('+html.split('\n').length+' lines)');
