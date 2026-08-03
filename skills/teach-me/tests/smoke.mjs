import { chromium } from 'playwright';
const errs=[];
const { MUTE_ARGS, muteSpeech } = await import('../scripts/mute.mjs');
const b=await chromium.launch({args:MUTE_ARGS});const p=await b.newPage();await muteSpeech(p);
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
await p.goto('file://'+process.cwd()+'/tests/harness.html',{waitUntil:'load'});
await p.waitForTimeout(400);
const R=async(name,fn)=>{try{const v=await fn();console.log((v?'✓':'✗')+' '+name);if(!v)errs.push('FAIL: '+name);}catch(e){console.log('✗ '+name+' — '+e.message);errs.push('THREW: '+name+' '+e.message);}};

await R('commit mounted + escape option pinned last', async()=>{
  const opts=await p.$$eval('#commit-c1 .opt',els=>els.map(e=>e.textContent));
  return opts.length===3 && opts[2].includes("Can't say yet");});
await R('ruling mounted', ()=>p.$('#host-r1 .ruling').then(x=>!!x));
await R('sorter mounted (3 rows)', ()=>p.$$eval('#d3-host .sortrow',e=>e.length===3));
await R('typed gate: 79 chars stays disabled', async()=>{
  await p.fill('#host-t1 textarea','x'.repeat(79));
  return p.$eval('#host-t1 .btn',b=>b.disabled)===true?true:await p.$eval('#host-t1 .btn',b=>b.disabled);});
await R('typed gate: 80 chars enables', async()=>{
  await p.fill('#host-t1 textarea','x'.repeat(80));
  return (await p.$eval('#host-t1 .btn',b=>b.disabled))===false;});
await R('ruling wrong answer → .why.bad + retry shows', async()=>{
  await p.click('#host-r1 .ruling .opt:nth-child(2)'); // not guaranteed wrong (shuffled) — just assert a why shows
  return (await p.$eval('#host-r1 .why',w=>w.classList.contains('show')));});
await R('final start → bespoke device locks (LOCK_IDS, bogus id ignored)', async()=>{
  await p.click('#startFinal');await p.waitForTimeout(100);
  return (await p.$eval('#dev-real',d=>d.classList.contains('locked')));});
await R('locked ref click → pause banner shows', async()=>{
  await p.click('#qrbtn');return (await p.$eval('#pausebar',b=>b.classList.contains('show')));});
await R('Resume re-locks (reference goes back to locked)', async()=>{
  await p.click('#pbResume');return (await p.$eval('#qrbtn',b=>b.classList.contains('locked')));});
await R('no verdict styling before submit (final opts have no .right/.wrong)', async()=>{
  const n=await p.$$eval('#fitems .opt.right, #fitems .opt.wrong',e=>e.length);return n===0;});

/* --- closed-book integrity + selected-answer legibility --- */
await R('final dims the lesson body, exempts the section hosting the final', async()=>{
  const on=await p.$eval('body',b=>b.classList.contains('finalon'));
  const host=await p.$eval('#finalstage',f=>f.closest('section').classList.contains('finalhost'));
  const dimmed=await p.$eval('#lesson-body-a',e=>parseFloat(getComputedStyle(e).opacity)<0.3);
  const exam=await p.$eval('#finalstage',e=>parseFloat(getComputedStyle(e).opacity)===1);
  return on&&host&&dimmed&&exam;});

await R('selected final answer stays legible while hovered (hover vs .sel specificity)', async()=>{
  const opt=await p.$('#fitems .fitem.on .opt');
  await opt.click();await opt.hover();await p.waitForTimeout(60);
  const c=await opt.evaluate(e=>{const s=getComputedStyle(e);return{bg:s.backgroundColor,fg:s.color};});
  const rgb=s=>(s.match(/\d+/g)||[]).slice(0,3).map(Number);
  const [a,z]=[rgb(c.bg),rgb(c.fg)];
  const dist=Math.abs(a[0]-z[0])+Math.abs(a[1]-z[1])+Math.abs(a[2]-z[2]);
  if(dist<=90)errs.push('  hovered .sel contrast collapsed: bg '+c.bg+' vs fg '+c.fg);
  return dist>90;});

await R('locks HOLD after every item answered, until submit', async()=>{
  // answer every remaining item; locks must not release before #fsubmit is clicked
  const n=await p.$$eval('#fitems .fitem',e=>e.length);
  for(let i=0;i<n;i++){await p.click('#fitems .fitem.on .opt');
    if(i<n-1){await p.click('#fnext');await p.waitForTimeout(40);}}
  const answered=await p.$eval('#fsubmit',b=>!b.disabled);
  const stillLocked=await p.$eval('#qrbtn',b=>b.classList.contains('locked'));
  const stillDim=await p.$eval('body',b=>b.classList.contains('finalon'));
  if(!answered)errs.push('  precondition failed: not all items registered as answered');
  return answered&&stillLocked&&stillDim;});

await R('submit releases locks and undims', async()=>{
  await p.click('#fsubmit');await p.waitForTimeout(150);
  const unlocked=await p.$eval('#qrbtn',b=>!b.classList.contains('locked'));
  const undimmed=await p.$eval('body',b=>!b.classList.contains('finalon'));
  return unlocked&&undimmed;});

/* --- feedback voice + ledger honesty + readout completeness ---
   Each of these runs on a FRESH page. On the shared page above they silently pass no
   matter what the runtime does: the earlier clicks have already answered r1 correctly,
   which builds the mutation widget and seeds its lines as a side effect. */
const fresh=async()=>{const q=await b.newPage();await muteSpeech(q);
  await q.goto('file://'+process.cwd()+'/tests/harness.html',{waitUntil:'load'});
  await q.waitForTimeout(300);return q;};

await R('mutation feedback lines exist at INIT (tts.mjs can see them)', async()=>{
  const q=await fresh();
  const r=await q.evaluate(()=>{
    const muts=(window.RULINGS||[]).filter(x=>x.mutate).map(x=>x.mutate);
    const keys=Object.keys(window.LINES||{});
    return {muts:muts.map(m=>m.id),
            missing:muts.filter(m=>!keys.some(k=>k.startsWith('fb_'+m.id+'_'))).map(m=>m.id),
            wrongCount:muts.reduce((n,m)=>n+m.opts.filter(o=>!o.ok).length,0),
            seeded:muts.reduce((n,m)=>n+keys.filter(k=>k.startsWith('fb_'+m.id+'_')).length,0)};});
  await q.close();
  if(!r.muts.length){errs.push('  fixture has no mutation ruling — check would be vacuous');return false;}
  if(r.missing.length)errs.push('  no feedback lines seeded for mutation(s): '+r.missing.join(', '));
  if(r.seeded<r.wrongCount)errs.push(`  seeded ${r.seeded} of ${r.wrongCount} wrong-answer lines`);
  return !r.missing.length&&r.seeded>=r.wrongCount;});

await R('ledger does NOT credit a correct answer picked after the reveal', async()=>{
  const q=await fresh();
  // M pre-declares its keys as false, so assert on the VALUE — a key count never moves.
  const res=await q.evaluate(()=>{
    const r=(window.RULINGS||[])[0];
    const d=document.querySelector('#host-r1 .ruling');
    const byText=t=>[...d.querySelectorAll('.opt')].find(o=>o.textContent===t);
    const wrongText=r.opts.find(o=>!o.ok).t, okText=r.opts.find(o=>o.ok).t;
    const before=!!window.M[r.mark];
    byText(wrongText).click();                              // wrong → reveals the answer
    const revealed=!!d.querySelector('.opt.right');
    d.querySelector('.retry').click();                      // Try again re-renders
    const okBtn=byText(okText);
    const rerendered=!!okBtn&&!okBtn.disabled;              // proves render() actually ran
    if(okBtn)okBtn.click();                                 // click the now-known answer
    return {before,after:!!window.M[r.mark],revealed,rerendered,mark:r.mark};});
  await q.close();
  if(res.before)errs.push('  precondition: '+res.mark+' was already marked before the run');
  if(!res.revealed)errs.push('  precondition: wrong answer did not reveal the correct option');
  if(!res.rerendered)errs.push('  precondition: Try again did not re-enable the options');
  if(res.after)errs.push('  ledger credited '+res.mark+' for an answer picked after the reveal');
  return !res.before&&res.revealed&&res.rerendered&&!res.after;});

await R('readout prints the correct answer on every missed item', async()=>{
  const q=await fresh();
  const res=await q.evaluate(async()=>{
    document.getElementById('startFinal').click();
    await new Promise(r=>setTimeout(r,120));
    // deliberately answer EVERY item wrong, so the readout must show the corrections
    for(let i=0;i<window.FINALS.length;i++){
      const f=window.FINALS[i], wrong=f.opts.find(o=>!o.ok).t;
      const item=document.getElementById('fitem-'+f.id);
      [...item.querySelectorAll('.opt')].find(o=>o.textContent===wrong).click();
      const nx=document.getElementById('fnext'); if(!nx.disabled)nx.click();
    }
    document.getElementById('fsubmit').click();
    await new Promise(r=>setTimeout(r,150));
    const html=document.getElementById('readout').innerHTML;
    return {missed:(html.match(/✗ Missed/g)||[]).length,
            shown:(html.match(/class="rright"/g)||[]).length,
            n:window.FINALS.length};});
  await q.close();
  if(res.missed!==res.n)errs.push(`  precondition: expected ${res.n} missed, got ${res.missed}`);
  if(res.shown<res.missed)errs.push(`  ${res.missed} missed item(s) but only ${res.shown} showed the correct answer`);
  return res.missed===res.n&&res.shown>=res.missed;});

console.log('\n'+(errs.length?('❌ '+errs.length+' problem(s):\n'+errs.join('\n')):'✅ zero console/page errors, all checks passed'));
await b.close();process.exit(errs.length?1:0);
