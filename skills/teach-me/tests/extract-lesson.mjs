import { readFileSync, writeFileSync } from 'fs';
const app = readFileSync('/Users/derek/teach-me/lessons/offside-CTRL--0bv3/app.js','utf8');
const lines = app.split('\n');
// KEEP only the lesson-half top-level declarations; the runtime owns the rest.
const KEEP = new Set(['LINES','M','LEDGER_ROWS','COMMITS','RULINGS','T1','STEP_FRAMES','stepIx','FINALS','SECIDS',
                      'stepRender','lineRender','startFullSeq','buildRebuild','spy','init']);
const out=[]; let i=0;
const net = s => { let n=0,inStr=0,q; for(let k=0;k<s.length;k++){const c=s[k];
  if(inStr){ if(c==='\\'){k++;continue;} if(c===q)inStr=0; continue; }
  if(c==='"'||c==="'"){inStr=1;q=c;continue;}
  if(c==='/'&&s[k+1]==='/')break;                     // line comment
  if('{[('.includes(c))n++; if('}])'.includes(c))n--; } return n; };
while(i<lines.length){
  const L=lines[i];
  const m=L.match(/^(?:function|var|const|let)\s+([A-Za-z0-9_$]+)/);
  if(m){                                              // a top-level declaration begins
    let depth=0, stmt=[], j=i;
    do { depth+=net(lines[j]); stmt.push(lines[j]); j++; }
    while(j<lines.length && (depth>0 || !/[};]\s*$/.test(stmt[stmt.length-1])));
    if(KEEP.has(m[1])) out.push(...stmt);
    i=j;
  } else { out.push(L); i++; }                        // comments / blank / "use strict"
}
let js = out.join('\n');
// ---- seam patches: adapt offside's data to the runtime's generalized config ----
js = js.replace(/var OBJ1=.*?var OBJ2=.*?;\n?/s,''); // OBJ1/OBJ2 no longer used
const config = `
/* ---- config the generalized runtime reads (were hardcoded in the engine) ---- */
var OBJS=[
 {chip:"obj1chip",label:"Position calls",tag:1,keys:["r1","r1m","t1","f1"]},
 {chip:"obj2chip",label:"Offence calls",tag:2,keys:["r2","r3","r3m","f2","f3","f4"]}
];
var LOCK_IDS=["stepdev","linedev","fullcheckdev","rebuilddev"];
var BRIEF_TITLE="Lesson brief — The Offside Rule (IFAB Law 11, 2026/27 edition)";
var BRIEF_SCOPE="Scoped out of this lesson (candidates for a next one): VAR offside protocol and semi-automated tracking; the deliberate-play vs deflection boundary; Law 11 history; players leaving the field of play.";
`;
// init(): the p2-LINES prep + fOrder/fAns now live in TM_initFinal(); voice/pause wiring in wireVoiceChrome()
js = js.replace(/  FINALS\.forEach\(function\(f\)\{\s*\n\s*f\.opts\.forEach\(function\(o,j\)\{\s*\n\s*LINES\["fb_"\+f\.id\+"_p2_"\+j\][^\n]*\n\s*\}\);\s*\n\s*\}\);/, '  TM_initFinal();');
js = js.replace(/  var bh=document\.getElementById\("voicebtn"\)[\s\S]*?if\(hasVoice\(\)\)setVoiceOn\(true\);else voiceLabel\(\);/, '  wireVoiceChrome();');
js = '"use strict";\n'+config+'\n'+js.replace(/^"use strict";\s*/,'');
writeFileSync('tests/offside-split/offside-lesson.js', js);
// report
const keptFns=[...js.matchAll(/^function ([A-Za-z0-9_$]+)/gm)].map(x=>x[1]);
console.log('offside-lesson.js:', js.split('\n').length, 'lines');
console.log('kept functions:', keptFns.join(', '));
console.log('has TM_initFinal call:', /TM_initFinal\(\)/.test(js));
console.log('has wireVoiceChrome call:', /wireVoiceChrome\(\)/.test(js));
console.log('still references removed engine fn buildRuling def?', /^function buildRuling/m.test(js));
