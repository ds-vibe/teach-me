# Proven JS components

Canonical implementations from real builds. Adapt per lesson — inline in the raw file, plain dependency-free ES5-style JS. Two standing rules: **use real apostrophes in JS strings** (HTML entities in `textContent` render literally — recurring bug), and no library survives unchanged: rename, restyle, extend to fit the lesson.

## Voice engine

Three-tier degrade: embedded MP3 → browser TTS (`speechSynthesis`, same `LINES` text) → silent captions. Toggle label reflects the tier: "Voice: on" / "Voice: browser" / "Voice: unavailable".

```js
var VOICE=/*__VOICE__*/{};                 // scripts/tts.mjs replaces this with {id: dataURI}
var voiceOn=true,curAudio=null,curUtter=null;
function hasKeyVoice(){for(var k in VOICE)return true;return false;}
function hasVoice(){return hasKeyVoice()||!!window.speechSynthesis;}
function stopVoice(){
  if(curAudio){curAudio.pause();curAudio=null;}
  if(curUtter){window.speechSynthesis.cancel();curUtter=null;}
}
function say(id){
  if(!voiceOn||!LINES[id])return Promise.resolve();
  if(VOICE[id])return new Promise(function(res){
    stopVoice();
    var a=new Audio(VOICE[id]);curAudio=a;
    a.onended=function(){res();};a.onerror=function(){res();};
    a.play().then(null,function(){res();});
  });
  if(window.speechSynthesis)return new Promise(function(res){
    stopVoice();
    var u=new SpeechSynthesisUtterance(LINES[id]);curUtter=u;
    u.rate=1.1;
    u.onend=function(){res();};u.onerror=function(){res();};
    window.speechSynthesis.speak(u);
    setTimeout(res,estMs(LINES[id])+4000);  // race a timeout: a never-firing onend must not hang the sequence
  });
  return Promise.resolve();                 // silent tier: estMs paces the sequence
}
function estMs(t){return Math.max(2400,t.split(/\s+/).length*370);}  // silent-mode pacing
// wait() lives with the sequence controller below — it must be pause-aware, never a bare setTimeout

var LINES={ id1:"Spoken text…", /* single source of truth — tts.mjs parses this map */ };

// toggle label at init:
// hasKeyVoice() -> "Voice: on" · speechSynthesis only -> "Voice: browser" · neither -> "Voice: unavailable" + disabled
```

Fallback caveats (details in media-voice.md): promise may resolve twice (onend + timeout) — harmless; keep per-line text short (old-Chrome utterance cutoff); first `speak()` must trace to a user gesture on iOS — click-gating already guarantees this.

Narrated sequence (voice-synced steps; works silently via `estMs`) — **always pausable** (user-mandated, 2026-07): the launch button toggles Pause/Resume while its sequence plays; starting a different sequence cancels the running one. Requirements the pattern below satisfies: audio pauses AND silent-mode timers freeze (a `setTimeout` wait would run ahead of paused audio); the between-steps gate holds the next `fx` while paused; button labels live in a `<span class="wl">` so relabeling never destroys the icon; a `.live` class styles the playing state.

```js
/* pause-aware timer: freezes while paused (never bare setTimeout in a sequence) */
function wait(ms){return new Promise(function(res){
  var remaining=ms;
  var iv=setInterval(function(){
    if(!seqPaused){remaining-=100;if(remaining<=0){clearInterval(iv);res();}}
  },100);
});}

var seqGen=0,seqPaused=false,pauseWaiters=[],seqBtn=null;
function pauseGate(){return seqPaused?new Promise(function(r){pauseWaiters.push(r);}):Promise.resolve();}
function flushPauseWaiters(){pauseWaiters.forEach(function(r){r();});pauseWaiters=[];}
function setBtnLabel(b,t){var s=b.querySelector(".wl");if(s)s.textContent=t;else b.textContent=t;}
function resetSeqBtn(b){setBtnLabel(b,b.getAttribute("data-idle")||"Watch");b.classList.remove("live");}
function setSeqPaused(p){
  if(seqPaused===p)return;
  seqPaused=p;
  if(curAudio){if(p)curAudio.pause();else curAudio.play().then(null,function(){});}
  if(window.speechSynthesis){if(p)window.speechSynthesis.pause();else window.speechSynthesis.resume();}
  if(!p)flushPauseWaiters();
  if(seqBtn)setBtnLabel(seqBtn,p?"Resume":"Pause");
}
function seqToggle(btn,startFn){                       // bind every Watch/Listen button through this
  btn.addEventListener("click",function(){
    if(seqBtn===btn){setSeqPaused(!seqPaused);return;} // running: toggle pause
    startFn();                                         // idle: start
  });
}
function runSeq(steps,cap,done,btn){
  var gen=++seqGen;                                    // starting invalidates any prior sequence
  seqPaused=false;flushPauseWaiters();
  if(seqBtn&&seqBtn!==btn)resetSeqBtn(seqBtn);
  seqBtn=btn||null;
  if(btn){
    if(!btn.getAttribute("data-idle")){var s=btn.querySelector(".wl");btn.setAttribute("data-idle",s?s.textContent:btn.textContent);}
    setBtnLabel(btn,"Pause");btn.classList.add("live");
  }
  var chain=Promise.resolve();
  steps.forEach(function(st){
    chain=chain.then(function(){
      if(gen!==seqGen)return;
      return pauseGate().then(function(){              // paused between lines? hold the next step
        if(gen!==seqGen)return;
        if(st.fx)st.fx();
        cap.textContent=LINES[st.say];                 // transcript visible while spoken
        return Promise.all([say(st.say),wait(estMs(LINES[st.say]))]);
      });
    });
  });
  chain.then(function(){
    if(gen!==seqGen)return;
    if(btn)resetSeqBtn(btn);
    if(seqBtn===btn)seqBtn=null;
    if(done)done();
  });
  return chain;
}
```

Caveat: `speechSynthesis.pause()` is unreliable on some Android builds — the pause-aware `wait` still freezes step advancement, so the worst case is one line finishing aloud while the sequence holds.

## Ruling / MC widget

Data-driven; words-not-color verdicts; why-feedback on every option; retry; reteach pointer; optional spoken feedback (`voice:`) — the verdict text carries the transcript, captions never echo it.

```js
function buildRuling(r,host,onPass){
  var d=document.createElement("div");d.className="ruling";
  d.innerHTML='<span class="tag act">'+(r.kind||"Your Turn")+'</span><h3>'+r.title+"</h3>"
    +(r.tx?txHTML(r.tx):"")+(r.offered?'<p class="offer"><b>Offered</b> — '+r.offered+"</p>":"");
  var opts=document.createElement("div");opts.className="opts";d.appendChild(opts);
  var why=document.createElement("p");why.className="why";d.appendChild(why);
  var retry=document.createElement("button");retry.className="btn ghost retry";retry.textContent="Try again";d.appendChild(retry);
  var passed=false;
  function render(){
    opts.innerHTML="";
    r.opts.forEach(function(o){
      var b=document.createElement("button");b.className="opt";b.textContent=o.t;   // real apostrophes!
      b.addEventListener("click",function(){
        Array.prototype.forEach.call(opts.children,function(c){c.disabled=true;});
        if(o.ok){
          b.classList.add("right");
          why.innerHTML="<b class='okw'>✓ Correct</b> — "+o.why;
          if(r.voice)say(r.voice);
          if(!passed){passed=true;onPass&&onPass();}
        }else{
          b.classList.add("wrong");
          Array.prototype.forEach.call(opts.children,function(c,i){if(r.opts[i].ok)c.classList.add("right");});
          why.innerHTML="<b class='now'>✗ Not quite</b> — "+o.why
            +(r.back?" <span class='reteach'>(Reteach: "+r.back+")</span>":"");
          retry.classList.add("show");
        }
        why.classList.add("show");
      });
      opts.appendChild(b);
    });
  }
  retry.addEventListener("click",function(){retry.classList.remove("show");why.classList.remove("show");render();});
  render();host.appendChild(d);
}
```

Item-writing rule: distractors are the **neighboring concepts**, never junk; each wrong option's `why` names the discriminating fact.

Mutation pair (boundary rules): give the item an optional `mutate: { scen, opts }` — after the correct answer's why-feedback, the widget appends a follow-up ruling with the **same scenario, one fact changed** ("One more — same scene, one change:"). Reuses buildRuling; the mutation counts as its own gate touch. Author the changed fact to sit exactly on the rule's boundary, so the pair teaches where the answer flips.

## Typed self-scored item

Type (≥10 chars gates the button) → reveal model answer → self-score **against the item's named criteria**. Honest: never pretend the page graded free text — the checklist just makes the learner's own grading mechanical instead of a vibe.

```js
// item data: { q, model, criteria: ["One specific thing — an object, not an idea",
//   "It acts — your sentence has a verb that moves or makes noise",
//   "Fused — the locus appears inside your scene",
//   "Application — a sentence links a specific fact to a specific element (find your 'because')"] }
function buildTyped(t,host,onPass){
  // textarea + disabled "Show the model answer" btn + hidden .model block.
  // On reveal: textarea readonly, model shows, and a checklist renders — one
  // labeled checkbox per t.criteria entry ("Check your answer:"). First checkbox
  // interaction fires onPass (attempt-based, not all-boxes). Keep 2–4 criteria;
  // rule-application items always include the because-test criterion.
}
```

## Ordering chips

Shuffled chips clicked into sequence; wrong click says earlier/later; slots fill green; reset rebuilds. `order.sort(function(){return Math.random()-0.5;})` — browser-side randomness is fine.

## Animated decision diagram

- Static HTML rows: `.frow` grid (`1fr auto 1fr`) — escape leaf + edge label left, node center, alternate outcome right. Fixed node width and fixed leaf min-width so columns align across rows.
- **Default = complete diagram visible.** Watch dims all rows (`.pend{opacity:.18}`), then reveals row-by-row voice-synced, then traces a worked example (light the path, ring the outcome leaf).
- Every edge label and branch is domain-checked in QA — a wrong arrow is the worst shippable bug.
- Wrap in `.treescroll{overflow-x:auto}` with a min-width so phones scroll the diagram, not the page.

## Quick Reference drawer

```js
// fixed right panel; button lives in the TOP BAR labeled "Quick Reference".
// closed: transform:translateX(105%) AND visibility:hidden (WebKit counts
// off-screen transforms toward scroll width) + html,body{overflow-x:clip}.
// sticky .drhead (title + Close) inside the panel.

// Closed-book lock — three rules, all proven on the Erie build:
// 1. Lock on final start; UNLOCK when every item is ANSWERED (attempt, not perfection).
// 2. The lock is page-wide but NEVER a dead end: keep the button clickable (styled
//    "Reference locked", not disabled) — clicking it opens a pause banner in the sticky
//    top bar: "Final in progress — closed book. [Resume final] [Pause final — open reference]".
// 3. Pausing unlocks the reference and marks the progress line "paused (reference open)";
//    a Resume button re-locks. Answered items persist across pause — the lock is a
//    commitment device, not punishment. Completion (all answered) unlocks permanently
//    from either state and clears banner + resume button.
function lockDrawer(on){
  drawerLocked=on;
  qrBtn.classList.toggle("locked",on);            // style change, never disabled
  qrBtn.textContent=on?"Reference locked":"Quick Reference";
  if(on)drawer.classList.remove("open");
  else pauseBar.classList.remove("show");
}
qrBtn.addEventListener("click",function(){
  if(drawerLocked){pauseBar.classList.add("show");return;}   // locked click answers with the banner
  drawer.classList.toggle("open");
});
```

## Mastery ledger

```js
var M={gate1:false,gate2:false /* one key per checklist item */};
function mark(key){
  if(M[key])return; M[key]=true;
  // check the ledger row, fill objective chips (each chip = an AND of gate keys),
  // show the all-done note when every key is true.
}
function counter(n,key){var c=0;return function(){if(++c===n)mark(key);};}  // shared by a section's items
```

## State-walk QA script

Start from `scripts/qa-states.template.mjs`. Every wrong path clicked, every widget driven end-to-end, `pageerror`+`console.error` collected, key states screenshotted, then a WebKit iPhone pass asserting zero horizontal overflow. Read the screenshots.
