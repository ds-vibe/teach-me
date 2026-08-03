import { chromium } from 'playwright';
const { MUTE_ARGS, muteSpeech } = await import('../scripts/mute.mjs');
const b=await chromium.launch({args:MUTE_ARGS});const p=await b.newPage();await muteSpeech(p);
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto('file://'+process.cwd()+'/tests/offside-split/lesson.html',{waitUntil:'load'});
// Give say() real duration WITHOUT audio: make estMs-based pacing run (voiceOn true, no stub here).
await p.waitForTimeout(300);
await p.locator('#watchfull').click();          // start the diagram trace (7 steps, real estMs pacing)
await p.waitForTimeout(400);                     // mid-sequence
const enabledMid = await p.$eval('#pausebtn', b=>!b.disabled);
await p.locator('#pausebtn').click();            // global pause
await p.waitForTimeout(150);
const readsPlay = await p.$eval('#pausebtn .wl', s=>s.textContent) === 'Play'
  && await p.$eval('#pauseicon', i=>i.innerHTML.includes('M6 4l14'));
await p.locator('#pausebtn').click();            // resume
await p.waitForTimeout(150);
const resumed = await p.$eval('#pausebtn .wl', s=>s.textContent) === 'Pause';
console.log((enabledMid?'✓':'✗')+' #pausebtn ENABLED mid-sequence (global pause available)');
console.log((readsPlay?'✓':'✗')+' click → icon+label read Play (paused)');
console.log((resumed?'✓':'✗')+' click again → resumes (label back to Pause)');
console.log(errs.length?('✗ errors: '+errs.join('; ')):'✓ zero console/page errors');
await b.close();
