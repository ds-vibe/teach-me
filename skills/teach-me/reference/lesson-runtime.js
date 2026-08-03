"use strict";
/* =====================================================================
   lesson-runtime.js — the teach-me lesson ENGINE (copy-whole, verbatim).
   Lifted from the QA-green offside-CTRL build; identical behaviour, three
   generalizations noted inline (N objectives, config lock list, 80-char
   typed gate). This file is the SAME every build. Concatenate it BEFORE
   the lesson's own script (assemble.mjs does this).

   ---- THE DATA CONTRACT — the lesson script provides these globals ----
     LINES         id -> narration string (single source of truth for text+audio)
     M             { markKey:false, ... } mastery state, one key per gate
     LEDGER_ROWS   [ [markKey, "row label"], ... ] the "what you can do now" list
     OBJS          [ { chip:"obj1chip", label:"Position calls", tag:1,
                       keys:["r1","f1",...] }, ... ]   objectives (N, not 2)
                     chip  = id of the topbar objective chip element
                     label = readout pill label
                     tag   = the numeric `obj` stamped on FINALS items
                     keys  = mark keys that must all be true to complete it
     COMMITS       ungraded commit cards (buildCommit reads each)
     RULINGS       graded ruling/MC items (lesson mounts with buildRuling)
     FINALS        closed-book final items, each with { id, obj, title, tx, q,
                     back:"#sN|§N label", opts:[{ok?,t,why,back?}] }
     LOCK_IDS      [ "stepdev","linedev",... ] bespoke device ids to lock
                     during the final (was hardcoded; now per-lesson)
     BRIEF_TITLE   first line of the copyable readout brief
     BRIEF_SCOPE   the "scoped out / next lesson" tail of the brief
     TM_SLUG       optional key for the results history (localStorage); defaults
                   to a slug of document.title. Attempts persist in-browser only;
                   the readout offers a JSON download of the full history.

   ---- DOM the lesson markup must provide (chrome ids) ----
     #voicebtn #voicelabel [#voicelabelshort]  #pausebtn #pauseicon
     #qrbtn (.long,.short) #drawer #drclose  #pausebar #pbResume #pbOpen
       #pausemsg #fpaused   #lessonmenu #rail   #ledger  each OBJS[].chip
     Final: #finalstage #startFinal #fitems #fprog #fback #fnext
       #fsubmitrow #fsubmit #fsubmitnote #readout
     Widget hosts + bespoke devices + scrollspy stay in the lesson script.

   ---- Engine entry points the lesson's init() calls ----
     buildCommit(c) · buildRuling(r,host) · buildTyped(t,host) · buildSorter(s)
       buildRuling: the per-item pass callback is r.onFirst(ok) (a property),
       NOT a 3rd positional arg — some earlier builds used both conventions.
     renderLedger() · mark(key)   ·  wireVoiceChrome()
     TM_initFinal() (build final state + p2 feedback LINES) · wireFinalNav()
     wireChrome() · seqToggle(btn,startFn) · runSeq(steps,done,btn) · say(id)
     Diagram toolkit for bespoke traces: fx,fwAll,fwDim,fwShow,fwLit,fwReset

   ---- Provenance ----
     Engine lifted from the QA-green offside-CTRL build; buildSorter absorbed
     from hearsay-b9wy (same dialect). prosecutors uses the same components
     under other names (buildItem/lockRefs/renderFinal). A play-heavy build
     like dutch-defense uses only a subset (say without runSeq, its own final)
     — the runtime is opt-in per component, never mandatory. Bespoke devices
     (boards, sliders, counting grids, diagram traces) stay in the lesson.
   ===================================================================== */

/* ===================== voice engine (embedded MP3 -> browser TTS -> silent) ===================== */
var VOICE=/*__VOICE__*/{};
var voiceOn=true,curAudio=null,curUtter=null;
function hasKeyVoice(){for(var k in VOICE)return true;return false;}
function hasVoice(){return hasKeyVoice()||!!window.speechSynthesis;}
function stopVoice(){
  if(curAudio){curAudio.pause();curAudio=null;}
  if(curUtter){window.speechSynthesis.cancel();curUtter=null;}
}
function estMs(t){return Math.max(2400,t.split(/\s+/).length*370);}
var curLine=null;
function say(id){
  if(!LINES[id])return Promise.resolve();
  if(!voiceOn)return wait(estMs(LINES[id]));
  if(VOICE[id])return new Promise(function(res){
    stopVoice();
    var a=new Audio(VOICE[id]);curAudio=a;
    a.playbackRate=window.VOICE_RATE||1;
    curLine={res:res,t0:Date.now(),text:LINES[id]};
    function fin(){curLine=null;res();}
    a.onended=fin;a.onerror=fin;
    a.play().then(null,fin);
    wait(estMs(LINES[id])+9000).then(fin);
  });
  if(window.speechSynthesis)return new Promise(function(res){
    stopVoice();
    var u=new SpeechSynthesisUtterance(LINES[id]);curUtter=u;
    u.rate=1.1;
    curLine={res:res,t0:Date.now(),text:LINES[id]};
    function fin(){curLine=null;res();}
    u.onend=fin;u.onerror=fin;
    window.speechSynthesis.speak(u);
    wait(estMs(LINES[id])+4000).then(fin);
  });
  return Promise.resolve();
}
function setVoiceOn(on){
  voiceOn=on;
  if(!on&&curLine){
    var L=curLine;curLine=null;stopVoice();
    wait(Math.max(0,estMs(L.text)-(Date.now()-L.t0))).then(L.res);
  } else if(!on) stopVoice();
  voiceLabel();
}
function voiceLabel(){
  var el=document.getElementById("voicelabel"),sh=document.getElementById("voicelabelshort"),b=document.getElementById("voicebtn");
  var t;
  if(!hasVoice()){t="Voice: unavailable";b.disabled=true;}
  else if(!voiceOn)t="Voice: off";
  else t=hasKeyVoice()?"Voice: on":"Voice: browser";
  el.textContent=t;
  if(sh)sh.textContent=t.replace("Voice: ","").replace(/^u/,"U").replace(/^o/,"O").replace(/^b/,"B");
  b.setAttribute("aria-pressed",voiceOn?"true":"false");
}

/* ---------- pause-aware sequence controller ---------- */
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
  syncPauseBtn();
}
function seqToggle(btn,startFn){
  btn.addEventListener("click",function(){
    if(seqBtn===btn){setSeqPaused(!seqPaused);return;}
    startFn();
  });
}
function syncPauseBtn(){
  var b=document.getElementById("pausebtn");if(!b)return;
  b.disabled=!seqBtn;
  b.setAttribute("aria-pressed",seqPaused?"true":"false");
  setBtnLabel(b,seqPaused?"Play":"Pause");
  var ic=document.getElementById("pauseicon");
  if(ic)ic.innerHTML=seqPaused
    ? '<path d="M6 4l14 8-14 8V4z"/>'
    : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
}
function readAlong(sel,on){
  var el=sel?document.querySelector(sel):null;
  if(el)el.classList.toggle("reading",on);
}
function runSeq(steps,done,btn){
  var gen=++seqGen;
  seqPaused=false;flushPauseWaiters();
  if(seqBtn&&seqBtn!==btn)resetSeqBtn(seqBtn);
  seqBtn=btn||null;
  if(btn){
    if(!btn.getAttribute("data-idle")){var s=btn.querySelector(".wl");btn.setAttribute("data-idle",s?s.textContent:btn.textContent);}
    setBtnLabel(btn,"Pause");btn.classList.add("live");
  }
  syncPauseBtn();
  var chain=Promise.resolve();
  steps.forEach(function(st){
    chain=chain.then(function(){
      if(gen!==seqGen)return;
      return pauseGate().then(function(){
        if(gen!==seqGen)return;
        if(st.fx)st.fx();
        readAlong(st.hl,true);
        var spoken=say(st.say);
        var paced=(voiceOn&&hasVoice())?spoken:Promise.all([spoken,wait(estMs(LINES[st.say]||"x x x"))]);
        return paced.then(function(){readAlong(st.hl,false);});
      });
    });
  });
  chain.then(function(){
    if(gen!==seqGen)return;
    if(btn)resetSeqBtn(btn);
    if(seqBtn===btn){seqBtn=null;syncPauseBtn();}
    if(done)done();
  });
  return chain;
}

/* ===================== mastery ledger (generalized to N objectives) ===================== */
function renderLedger(){
  var host=document.getElementById("ledger");host.innerHTML="";
  LEDGER_ROWS.forEach(function(row){
    var d=document.createElement("div");d.className="lrow"+(M[row[0]]?" done":"");
    d.innerHTML='<span class="lmark">✓</span><span>'+row[1]+"</span>";
    host.appendChild(d);
  });
  OBJS.forEach(function(o){                                   // was hardcoded obj1chip/obj2chip
    var done=o.keys.every(function(k){return M[k];});
    var chip=document.getElementById(o.chip);
    if(chip)chip.classList.toggle("done",done);
  });
}
function mark(key){if(M[key])return;M[key]=true;renderLedger();}

/* ===================== shared: shuffle with escape pinned last ===================== */
function orderOpts(opts){
  var order=opts.map(function(_,i){return i;});
  order.sort(function(){return Math.random()-0.5;});
  order.sort(function(a,b){return (opts[a].esc?1:0)-(opts[b].esc?1:0);});
  return order;
}
function plain(t){return t.replace(/<[^>]+>/g,"");}

/* ===================== screen reader and keyboard ===================== */
/* The revealed feedback node is where the teaching lives, so it has to announce
   itself — a silent reveal hands a screen reader nothing at the one moment that
   matters. role=status + aria-live=polite waits for a pause instead of cutting in.
   Options lock with aria-disabled, never the disabled property: a disabled button
   leaves the tab order, so keyboard focus fell back to <body> after every answer
   and the reader had to tab from the top of the page again. */
function liveify(el){
  if(el&&!el.getAttribute("aria-live")){el.setAttribute("role","status");el.setAttribute("aria-live","polite");}
  return el;
}
function lockOpts(box){
  Array.prototype.forEach.call(box.children,function(x){x.setAttribute("aria-disabled","true");});
}
function unlockOpts(box){
  Array.prototype.forEach.call(box.children,function(x){x.removeAttribute("aria-disabled");});
}
function locked(b){return b.getAttribute("aria-disabled")==="true";}

/* ===================== commit cards (ungraded) ===================== */
function buildCommit(c){
  var host=document.getElementById(c.host);
  var stemId="stem-"+c.id;
  host.innerHTML='<div class="chead"><span class="ctag">'+c.tag+'</span>'
    +'<button class="abtn listen" id="listen-'+c.id+'"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4h4l5 4V6l-5 4H3z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="wl">Listen</span></button></div>'
    +'<p class="stem" id="'+stemId+'"></p><div class="opts"></div><p class="why"></p>';
  document.getElementById(stemId).textContent=c.stem;
  LINES["stem_"+c.id]=c.stem;
  var opts=host.querySelector(".opts"),why=liveify(host.querySelector(".why"));
  var order=orderOpts(c.opts);
  order.map(function(i){return c.opts[i];}).forEach(function(o,idx){
    var vid="fb_"+c.id+"_"+order[idx];
    var pre=o.v==="ok"?"Correct. ":(o.v==="no"?"Not quite. ":"");
    LINES[vid]=pre+plain(o.resp);
    var b=document.createElement("button");b.className="opt";b.textContent=o.t;
    b.addEventListener("click",function(){
      if(locked(b))return;
      lockOpts(opts);
      b.classList.add(o.v==="ok"?"right":(o.v==="no"?"wrong":"sel"));
      // Same closure as rulings and the final: a miss lights the designed answer too.
      if(o.v!=="ok")Array.prototype.forEach.call(opts.children,function(x,i2){
        if(c.opts[order[i2]].v==="ok")x.classList.add("right");
      });
      why.className="why show "+(o.v==="ok"?"good":(o.v==="no"?"bad":""));
      why.innerHTML=(o.v==="ok"?'<b class="okw">✓ Correct</b> — ':(o.v==="no"?'<b class="now">✗ Not quite</b> — ':""))+o.resp;
      say(vid);
    });
    opts.appendChild(b);
  });
  var lb=document.getElementById("listen-"+c.id);
  seqToggle(lb,function(){runSeq([{say:"stem_"+c.id,hl:"#"+stemId}],null,lb);});
}

/* ===================== ruling / MC widget (graded) ===================== */
function txHTML(tx){return tx.map(function(f){return '<p class="ff"><b>'+f[0]+'</b> — '+f[1]+"</p>";}).join("");}
/* Feedback lines must exist at INIT, not at first render. A mutation's widget is only
   built after its parent is answered correctly, so registering fb_ ids inside render()
   meant tts.mjs — which reads window.LINES from a freshly loaded page — never saw them
   and every mutation's wrong-answer feedback silently fell through to OS speech.
   Keys are fb_<id>_<ORIGINAL index>, independent of shuffle order, so seeding is safe. */
function seedFeedbackLines(r){
  if(!r||!r.opts||r.id.slice(-3)==="_p2")return;
  r.opts.forEach(function(o,i){
    if(!o.ok)LINES["fb_"+r.id+"_"+i]="Not quite. "+plain(o.why);
  });
  if(r.mutate)seedFeedbackLines(r.mutate);
}
function buildRuling(r,host){
  seedFeedbackLines(r);
  /* Second-pass re-serves carry the same obj as the item they came from; registering
     them would feed the retry back into itself. */
  var rec=(r.obj&&r.id.slice(-3)!=="_p2")?{obj:r.obj,f:r,ok:null}:null;
  if(rec)PRACTICE.push(rec);
  var d=document.createElement("div");d.className="ruling";
  d.innerHTML='<span class="tag">'+(r.kind||"Your call")+'</span><h4>'+r.title+"</h4>"
    +(r.tx?txHTML(r.tx):"")+(r.scen?'<p class="ff">'+r.scen+"</p>":"")
    +'<p class="q">'+r.q+"</p>";
  var opts=document.createElement("div");opts.className="opts";d.appendChild(opts);
  var why=liveify(document.createElement("p"));why.className="why";d.appendChild(why);
  var retry=document.createElement("button");retry.className="btn ghost retry";retry.textContent="Try again";d.appendChild(retry);
  var mut=document.createElement("div");d.appendChild(mut);
  var order=orderOpts(r.opts);
  var mutDone=false,firstDone=false;
  function render(){
    opts.innerHTML="";
    order.map(function(i){return r.opts[i];}).forEach(function(o,idx){
      var vid="fb_"+r.id+"_"+order[idx];
      /* V.5: voice the WRONG-answer whys only, and never the retry pass (ids ending
         "_p2" re-serve final items whose text the readout already shows). A key left
         unset makes say() a no-op — silent, not a drop to browser TTS. */
      if(!o.ok&&r.id.slice(-3)!=="_p2")LINES[vid]="Not quite. "+plain(o.why);
      var b=document.createElement("button");b.className="opt";b.textContent=o.t;
      b.addEventListener("click",function(){
        if(locked(b))return;
        lockOpts(opts);
        /* A wrong answer reveals the correct option immediately, so every retry is a
           retry with the answer showing. Only a first-attempt hit earns the ledger. */
        var wasFirst=!firstDone;
        if(!firstDone){firstDone=true;if(rec)rec.ok=!!o.ok;if(r.onFirst)r.onFirst(!!o.ok);}
        if(o.ok){
          b.classList.add("right");
          why.className="why show good";
          why.innerHTML='<b class="okw">✓ Correct</b> — '+o.why
            +(wasFirst?"":' <span class="reteach">(Revealed on the first attempt — not credited to the ledger.)</span>');
          if(wasFirst)mark(r.mark);
          if(r.mutate&&!mutDone){mutDone=true;showMutation();}
        }else{
          b.classList.add("wrong");
          Array.prototype.forEach.call(opts.children,function(x,i2){if(r.opts[order[i2]].ok)x.classList.add("right");});
          why.className="why show bad";
          why.innerHTML='<b class="now">✗ Not quite</b> — '+o.why
            +(o.back?'<a class="reteach" href="'+o.back.split("|")[0]+'">Reread: '+o.back.split("|")[1]+"</a>":"");
          retry.classList.add("show");
        }
        say(vid);
      });
      opts.appendChild(b);
    });
  }
  function showMutation(){
    var w=document.createElement("div");w.className="mutwrap";
    w.innerHTML='<p class="mutlead">One more — same scene, one change:</p>';
    mut.appendChild(w);
    buildRuling(r.mutate,w);
  }
  retry.addEventListener("click",function(){retry.classList.remove("show");why.classList.remove("show");render();});
  render();host.appendChild(d);
}

/* ===================== typed self-scored item ===================== */
/* 80-char gate (was 10 — a token word must not unlock the model); onPass only
   when EVERY criterion box is checked, matching reference/js-patterns.md. */
function buildTyped(t,host){
  var d=document.createElement("div");d.className="ruling typed";
  d.innerHTML='<span class="tag">'+t.kind+'</span><h4>'+t.title+'</h4><p class="ff">'+t.prompt+"</p>"
    +'<textarea aria-label="Your answer" placeholder="Type your correction here"></textarea>'
    +'<div style="margin-top:12px"><button class="btn" disabled>Show the model answer</button></div>'
    +'<div class="model"><span class="mtag">A model answer</span>'+t.model+"</div>"
    +'<div class="crits"><p>Check your answer — tick what yours already has:</p></div>';
  var ta=d.querySelector("textarea"),btn=d.querySelector(".btn"),model=d.querySelector(".model"),crits=d.querySelector(".crits");
  ta.addEventListener("input",function(){btn.disabled=ta.value.trim().length<80;});
  var boxes=[];
  t.criteria.forEach(function(c){
    var row=document.createElement("label");row.className="crit";
    var cb=document.createElement("input");cb.type="checkbox";boxes.push(cb);
    var sp=document.createElement("span");sp.innerHTML=c;
    row.appendChild(cb);row.appendChild(sp);crits.appendChild(row);
    cb.addEventListener("change",function(){
      if(boxes.every(function(x){return x.checked;}))mark(t.mark);
    });
  });
  btn.addEventListener("click",function(){
    ta.readOnly=true;liveify(model);model.classList.add("show");crits.classList.add("show");btn.disabled=true;
  });
  host.appendChild(d);
}

/* ===================== binary discrimination sorter ===================== */
/* Absorbed from hearsay-b9wy, where the stimulus/reteach/styles were baked into
   the function; here all content is config so the component is reusable.
   s = { host, stim (html), lead? (html), labels:[truthyLabel, falsyLabel],
         mark, doneMsg, reteach?:"#s3|§3 label",
         rows:[ { p:"offered-to-prove html", truth:bool, why:"html", say?:"so-0" } ] } */
function buildSorter(s){
  var host=document.getElementById(s.host);
  var d=document.createElement("div");d.className="sorter";
  d.innerHTML='<span class="tag">Sort them</span><p class="stim">'+s.stim+"</p>"+(s.lead?"<p>"+s.lead+"</p>":"");
  var wrap=document.createElement("div");d.appendChild(wrap);
  var prog=document.createElement("p");prog.className="progress";prog.textContent="0 of "+s.rows.length+" sorted";
  var done=0,correct=0,rowRight=[];
  var back=s.reteach?s.reteach.split("|"):null;
  s.rows.forEach(function(rw,i){
    var row=document.createElement("div");row.className="sortrow";
    row.innerHTML='<p class="offer"><b>Offered</b> — '+rw.p+"</p>";
    var btns=document.createElement("div");btns.className="sortbtns";
    var note=liveify(document.createElement("p"));note.className="sortnote";
    var choices=[{t:s.labels[0],truth:true},{t:s.labels[1],truth:false}];
    var retry=document.createElement("button");retry.className="btn ghost retry";retry.textContent="Try again";
    var scored=false;
    function render(){
      btns.innerHTML="";
      orderOpts(choices).forEach(function(ci){
        var c=choices[ci];
        var b=document.createElement("button");b.className="opt";b.textContent=c.t;
        b.addEventListener("click",function(){
          if(locked(b))return;
          lockOpts(btns);
          var right=(c.truth===rw.truth);
          b.classList.add(right?"right":"wrong");
          if(!right)Array.prototype.forEach.call(btns.children,function(x){if(x!==b)x.classList.add("right");});
          note.className="sortnote show";
          note.innerHTML=(right?"<b class='okw'>✓ Correct</b> — ":"<b class='now'>✗ Not quite</b> — ")+rw.why
            +((!right&&back)?" <span class='reteach'>(Back to <a href='"+back[0]+"'>"+back[1]+"</a>)</span>":"");
          row.classList.add("done");
          if(rw.say)say(rw.say);
          if(!scored){scored=true;done++;}
          rowRight[i]=right;
          correct=0;rowRight.forEach(function(v){if(v)correct++;});
          prog.textContent=correct===s.rows.length?s.doneMsg:(done+" of "+s.rows.length+" sorted, "+correct+" right so far");
          if(correct===s.rows.length)mark(s.mark);
          if(!right)retry.classList.add("show");
        });
        btns.appendChild(b);
      });
    }
    retry.addEventListener("click",function(){retry.classList.remove("show");note.className="sortnote";row.classList.remove("done");render();});
    render();
    row.appendChild(btns);row.appendChild(note);row.appendChild(retry);wrap.appendChild(row);
  });
  d.appendChild(prog);host.appendChild(d);
}

/* ===================== diagram toolkit (for bespoke traces in the lesson) ===================== */
function fx(k){return document.querySelector('[data-fx="'+k+'"]');}
function fwAll(){return Array.prototype.slice.call(document.querySelectorAll("#fw [data-fx]"));}
function fwDim(){fwAll().forEach(function(e){e.classList.add("pend");e.classList.remove("lit","ring");});}
function fwShow(){Array.prototype.forEach.call(arguments,function(k){fx(k).classList.remove("pend");});}
function fwLit(){Array.prototype.forEach.call(arguments,function(k){fx(k).classList.add("lit");});}
function fwReset(){fwAll().forEach(function(e){e.classList.remove("pend","lit","ring");});}

/* ===================== final ===================== */
var finalActive=false,finalPaused=false,finalSubmitted=false,fCur=0;
var fOrder=[],fAns=[],fText=[];
var TYPED_GATE=80;                                             // same real-attempt gate as practice
/* Mastery is per objective, not overall: a 75% total can hide an objective the
   learner went 0-for-2 on, which is the one thing the readout most needs to say.
   Practice items register here only when the lesson tags them with an obj, so a
   lesson built before that tag existed still works — it just retries finals only.
   One miss is forgiven from three items up. A straight 80% on the small denominators
   a short lesson can afford means no miss at all — you need five items before one
   slip survives the percentage — so it would fail a learner for a single fumble and
   read as broken. Below three, there is no room to tell a slip from a gap, so the
   percentage stands alone. */
var CRITERION=0.8,SLIP_FROM=3;
var PRACTICE=[];
/* A final item is either MCQ (f.opts) or written (f.typed:true + f.model + f.criteria).
   A written item shows NO model answer during the exam — that would hand over the
   answer mid-final. It banks the text; the model and the self-score criteria arrive
   in the readout with everything else. Written items are self-scored, so they sit
   outside the numeric score and are reported on their own line. */
function isTyped(f){return !!f.typed;}
function TM_initFinal(){                                       // call from lesson init() after FINALS is defined
  fOrder=FINALS.map(function(f){return isTyped(f)?[]:orderOpts(f.opts);});
  fAns=FINALS.map(function(){return -1;});
  fText=FINALS.map(function(){return "";});
  /* No feedback LINES pre-registered here: the final is a text instrument — verdicts
     land in the readout — and the retry pass re-serves that same text (V.5). */
}
function answeredAt(i){
  return isTyped(FINALS[i]) ? (fText[i]||"").trim().length>=TYPED_GATE : fAns[i]>=0;
}
function allAnswered(){return FINALS.every(function(_,i){return answeredAt(i);});}
function buildFinalItems(){
  var host=document.getElementById("fitems");host.innerHTML="";
  FINALS.forEach(function(f,i){
    var d=document.createElement("div");d.className="fitem";d.id="fitem-"+f.id;
    var flabel=window.FINAL_ITEM_LABEL||"Question";           // was hardcoded "Flag call" (offside build)
    d.innerHTML='<span class="tag">'+flabel+" "+(i+1)+'</span><h4>'+f.title+"</h4>"+txHTML(f.tx)+'<p class="q">'+f.q+"</p>";
    if(isTyped(f)){
      var ta=document.createElement("textarea");
      ta.setAttribute("aria-label","Your written answer");
      ta.placeholder=f.placeholder||"Write your answer here";
      ta.value=fText[i]||"";
      var note=document.createElement("p");note.className="ff typednote";
      function gate(){
        var n=(ta.value||"").trim().length;
        note.textContent=n>=TYPED_GATE?"Banked. A model answer and a self-check arrive when you submit.":
          "Write at least a couple of sentences ("+n+"/"+TYPED_GATE+" characters).";
      }
      ta.addEventListener("input",function(){
        if(finalSubmitted){ta.value=fText[i]||"";return;}
        fText[i]=ta.value;gate();fRender();
      });
      gate();
      d.appendChild(ta);d.appendChild(note);
      host.appendChild(d);
      return;                                                  // written item: no options
    }
    var opts=document.createElement("div");opts.className="opts";d.appendChild(opts);
    fOrder[i].map(function(oi){return f.opts[oi];}).forEach(function(o,pos){
      var b=document.createElement("button");b.className="opt";b.textContent=o.t;
      b.addEventListener("click",function(){
        if(finalSubmitted)return;
        fAns[i]=pos;
        Array.prototype.forEach.call(opts.children,function(x){x.classList.remove("sel");});
        b.classList.add("sel");
        /* Locks stay on until SUBMIT. Releasing them at allAnswered() let a learner
           park an answer on every item, silently regain the reference, and revise
           everything before scoring — which is the pass that most needs to be closed. */
        fRender();
      });
      opts.appendChild(b);
    });
    host.appendChild(d);
  });
}
function fRender(){
  FINALS.forEach(function(f,i){document.getElementById("fitem-"+f.id).classList.toggle("on",i===fCur);});
  document.getElementById("fprog").textContent="Question "+(fCur+1)+" of "+FINALS.length+(answeredAt(fCur)?" · answered":"");
  document.getElementById("fback").disabled=fCur===0;
  document.getElementById("fnext").disabled=fCur===FINALS.length-1;
  var row=document.getElementById("fsubmitrow");
  row.classList.toggle("show",fCur===FINALS.length-1||allAnswered());
  document.getElementById("fsubmit").disabled=!allAnswered();
  var un=[];FINALS.forEach(function(_,i){if(!answeredAt(i))un.push(i+1);});
  document.getElementById("fsubmitnote").textContent=un.length?("Still unanswered: question "+un.join(", ")+". You can go back and change any answer before submitting."):("All "+FINALS.length+" answered. You can still go back and change answers — nothing is scored until you submit.");
}
function fGo(i){if(i<0||i>=FINALS.length)return;fCur=i;fRender();}
function startFinal(){
  if(finalActive)return;
  finalActive=true;finalSubmitted=false;finalPaused=false;
  document.getElementById("finalstage").hidden=false;
  document.getElementById("startFinal").disabled=true;
  buildFinalItems();fGo(0);
  applyFinalLocks();
  document.getElementById("finalstage").scrollIntoView({behavior:"smooth",block:"start"});
}
function finalHost(){
  var fs=document.getElementById("finalstage");
  return fs&&fs.closest?fs.closest("section"):null;
}
function setFinalDim(on){
  var h=finalHost();
  /* Fail safe: with no <section> around #finalstage there is nothing to exempt from
     the dim, so skip it entirely rather than fade the exam along with the lesson. */
  if(!h){document.body.classList.remove("finalon");return;}
  h.classList.toggle("finalhost",!!on);
  document.body.classList.toggle("finalon",!!on);
}
function applyFinalLocks(){
  if(!finalActive||finalPaused)return;
  setFinalDim(true);
  document.getElementById("qrbtn").classList.add("locked");
  document.querySelector("#qrbtn .long").textContent="Reference locked";
  document.querySelector("#qrbtn .short").textContent="Locked";
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("lessonmenu").classList.add("locked");
  document.getElementById("rail").classList.add("locked");
  LOCK_IDS.forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add("locked");});
}
function clearFinalLocks(){
  setFinalDim(false);
  document.getElementById("qrbtn").classList.remove("locked");
  document.querySelector("#qrbtn .long").textContent="Quick Reference";
  document.querySelector("#qrbtn .short").textContent="Reference";
  document.getElementById("lessonmenu").classList.remove("locked");
  document.getElementById("rail").classList.remove("locked");
  LOCK_IDS.forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove("locked");});
  document.getElementById("pausebar").classList.remove("show");
  document.getElementById("fpaused").style.display="none";
}
function locksOn(){return finalActive&&!finalPaused&&!finalSubmitted;}
function showPauseBar(){if(locksOn())document.getElementById("pausebar").classList.add("show");}
function pauseFinal(){
  finalPaused=true;
  clearFinalLocksVisualOnly();
  document.getElementById("pausemsg").textContent="Final paused — reference open.";
  document.getElementById("pbOpen").style.display="none";
  document.getElementById("pausebar").classList.add("show");
  document.getElementById("fpaused").style.display="inline";
  document.getElementById("drawer").classList.add("open");
}
function clearFinalLocksVisualOnly(){
  setFinalDim(false);
  document.getElementById("qrbtn").classList.remove("locked");
  document.querySelector("#qrbtn .long").textContent="Quick Reference";
  document.querySelector("#qrbtn .short").textContent="Reference";
  document.getElementById("lessonmenu").classList.remove("locked");
  document.getElementById("rail").classList.remove("locked");
  LOCK_IDS.forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove("locked");});
}
function resumeFinal(){
  finalPaused=false;
  document.getElementById("pausemsg").textContent="Final in progress — closed book.";
  document.getElementById("pbOpen").style.display="";
  document.getElementById("pausebar").classList.remove("show");
  document.getElementById("fpaused").style.display="none";
  document.getElementById("drawer").classList.remove("open");
  applyFinalLocks();
}
/* ---- results history: attempts persist per lesson in localStorage, and the
   readout offers the whole history as a JSON download. In-browser only. ---- */
function tmSlug(){
  return String(window.TM_SLUG||document.title||"lesson").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"lesson";
}
function tmAttempts(){
  try{var a=JSON.parse(localStorage.getItem("tm."+tmSlug()+".attempts"));
    return Array.isArray(a)?a:[];}catch(e){return [];}
}
function tmSaveAttempt(at){
  try{var a=tmAttempts();a.push(at);
    localStorage.setItem("tm."+tmSlug()+".attempts",JSON.stringify(a));}catch(e){}
}
function submitFinal(){
  finalSubmitted=true;finalActive=false;
  clearFinalLocks();
  var all=FINALS.map(function(f,i){
    if(isTyped(f))return {f:f,typed:true,text:fText[i]||""};
    var chosen=f.opts[fOrder[i][fAns[i]]];
    return {f:f,chosen:chosen,ok:!!chosen.ok};
  });
  var written=all.filter(function(r){return r.typed;});
  var results=all.filter(function(r){return !r.typed;});       // scored items only
  results.forEach(function(r){if(r.ok)mark(r.f.id);});
  var attempt={
    t:new Date().toISOString(),
    score:results.filter(function(r){return r.ok;}).length,
    total:results.length,
    objs:OBJS.map(function(o){
      return {label:o.label,
        got:results.filter(function(r){return r.f.obj===o.tag&&r.ok;}).length,
        tot:results.filter(function(r){return r.f.obj===o.tag;}).length};
    }),
    missed:results.filter(function(r){return !r.ok;}).map(function(r){return r.f.title;}),
    written:written.map(function(w){return w.f.title;})
  };
  var prev=tmAttempts();
  tmSaveAttempt(attempt);
  renderReadout(results,null,written,prev,attempt);
  document.getElementById("finalstage").hidden=true;
  var ro=document.getElementById("readout");
  ro.classList.add("show");
  ro.scrollIntoView({behavior:"smooth",block:"start"});
  /* The score replaces the whole final, so this one moves focus rather than
     announcing politely — a reader arriving here should land on the result, not
     hear it read behind wherever focus happened to be. */
  ro.setAttribute("tabindex","-1");ro.focus({preventScroll:true});
}
function renderReadout(results,second,written,prev,attempt){
  written=written||[];prev=prev||[];
  var host=document.getElementById("readout");
  var score=results.filter(function(r){return r.ok;}).length;
  var missed=results.filter(function(r){return !r.ok;});
  var objCells=OBJS.map(function(o){                           // was hardcoded o1/o2
    var got=results.filter(function(r){return r.f.obj===o.tag&&r.ok;}).length;
    var tot=results.filter(function(r){return r.f.obj===o.tag;}).length;
    return {label:o.label,tag:o.tag,got:got,tot:tot,
            pass:!tot||got/tot>=CRITERION||(tot>=SLIP_FROM&&tot-got<=1)};
  });
  /* The gate. An objective under criterion is the headline, not a pill the learner
     has to decode — "not yet" and the names, before the number. Nothing can force a
     retake in a static file, so this changes what finished looks like, not what is
     possible: the score still stands and the page stays readable either way. */
  var shortfall=objCells.filter(function(c){return c.tot&&!c.pass;});
  var h='<div class="scorehead"><p class="eyebrow">Your readout</p>'
    +'<p class="verdict '+(shortfall.length?"notyet":"met")+'">'
      +(shortfall.length
        ?"Not yet — "+shortfall.map(function(c){return c.label;}).join(" and ")+" "+(shortfall.length>1?"need":"needs")+" another pass"
        :"You hit the mark on every objective")+"</p>"
    +'<p class="scorebig">'+score+"/"+results.length+"</p>"
    +'<div class="objrow">'+objCells.map(function(c){return '<span class="objpill'+(c.tot&&!c.pass?" under":"")+'">'+c.label+" · "+c.got+"/"+c.tot+"</span>";}).join("")+"</div>"
    +(second?'<p class="secondline">Second pass over missed items: '+second.score+"/"+second.total+" (scored separately — your first score stands)</p>":"")
    +"</div>";
  /* Running tally across attempts: strongest and weakest objectives by cumulative
     percentage. Attempts live in this browser only; the download has all of it. */
  if(attempt&&prev.length){
    var hist=prev.concat([attempt]);
    var agg={};
    hist.forEach(function(a){(a.objs||[]).forEach(function(o){
      if(!agg[o.label])agg[o.label]={got:0,tot:0};
      agg[o.label].got+=o.got;agg[o.label].tot+=o.tot;});});
    var rows=Object.keys(agg).filter(function(k){return agg[k].tot>0;})
      .map(function(k){return {label:k,pct:Math.round(100*agg[k].got/agg[k].tot)};})
      .sort(function(a,b){return b.pct-a.pct;});
    var histLine="Attempt "+hist.length+" · earlier scores: "
      +prev.map(function(a){return a.score+"/"+a.total;}).join(" · ");
    var tallyLine=rows.length>1
      ?("Across all attempts — strongest: "+rows[0].label+" ("+rows[0].pct+"%) · weakest: "
        +rows[rows.length-1].label+" ("+rows[rows.length-1].pct+"%)"):"";
    h+='<div class="histbox"><p class="secondline">'+histLine+"</p>"
      +(tallyLine?'<p class="secondline">'+tallyLine+"</p>":"")+"</div>";
  }
  results.forEach(function(r){
    // The terminal learning moment of the whole lesson is seeing, on a missed item,
    // what the right answer WAS — printing only the wrong answer's rationale leaves
    // the learner to infer it. Correct items already show it as "your answer".
    var right=null;
    for(var ri=0;ri<r.f.opts.length;ri++)if(r.f.opts[ri].ok)right=r.f.opts[ri];
    h+='<div class="ritem"><p class="rv '+(r.ok?"ok":"no")+'">'+(r.ok?"✓ Correct":"✗ Missed")+" · "+r.f.title+"</p>"
      +'<p class="ryour">Your answer: '+r.chosen.t+"</p>"
      +'<p class="rwhy">'+r.chosen.why+"</p>"
      +(r.ok||!right?"":'<p class="rright"><b>The correct answer:</b> '+right.t+"</p><p class=\"rwhy\">"+right.why+"</p>")
      // reteach pointers only on MISSED items — on correct ones they dilute the signal
      +(r.ok?"":'<a class="reteach" href="'+r.f.back.split("|")[0]+'">Reread: '+r.f.back.split("|")[1]+"</a>")+"</div>";
  });
  /* Written answers: the learner's own text, then the model, then the criteria they
     tick themselves. Never auto-scored and never folded into the number above —
     a self-graded item inside a numeric score makes the score a lie. */
  written.forEach(function(w,wi){
    h+='<div class="ritem written"><p class="rv">✎ Written · '+w.f.title+"</p>"
      +'<p class="q">'+w.f.q+"</p>"
      +'<div class="youranswer"><span class="mtag">What you wrote</span><p></p></div>'
      +'<div class="model show"><span class="mtag">A model answer</span>'+w.f.model+"</div>"
      +'<div class="crits show" data-w="'+wi+'"><p>Check your answer — tick what yours already has:</p></div>'
      +(w.f.back?'<a class="reteach" href="'+w.f.back.split("|")[0]+'">Reread: '+w.f.back.split("|")[1]+"</a>":"")
      +"</div>";
  });
  if(missed.length&&!second){
    /* Below criterion the retry is the thing to do next, so it reads as an instruction
       and carries the reteach in front of it; at or above, it stays an offer. */
    var extra=retryExtras(objCells);
    var n=missed.length+extra.length;
    h+='<div class="retryrow'+(shortfall.length?" lead":"")+'">'
      +(shortfall.length?'<p class="retrylead">Reread '+shortfall.map(function(c){
          var m=results.filter(function(r){return r.f.obj===c.tag&&!r.ok;})[0];
          return m?'<a class="reteach" href="'+m.f.back.split("|")[0]+'">'+m.f.back.split("|")[1]+"</a>":c.label;
        }).join(", ")+", then take these again.</p>":"")
      +'<button class="btn'+(shortfall.length?"":" ghost")+'" id="retryMissed">'
      +(shortfall.length?"Work the "+n+" item"+(n>1?"s":"")+" you missed":"Retry the "+n+" missed item"+(n>1?"s":""))
      +" (scored separately)</button></div>";
  }
  var objSummary=objCells.map(function(c){return c.label+" "+c.got+"/"+c.tot;}).join(" · ");
  var brief=BRIEF_TITLE+"\n"
    +"Final score: "+score+"/"+results.length+" ("+objSummary+")\n"
    +"Missed: "+(missed.length?missed.map(function(r){return r.f.title;}).join("; "):"none")+"\n"
    +(written.length?("Written answer"+(written.length>1?"s":"")+" (self-scored, outside the score): "+written.map(function(w){return w.f.title;}).join("; ")+"\n"):"")
    +(second?("Second pass on missed items: "+second.score+"/"+second.total+"\n"):"")
    +"Reread first: "+(missed.length?missed.map(function(r){return r.f.back.split("|")[1];}).join("; "):"nothing — all calls correct")+"\n"
    +BRIEF_SCOPE;
  h+='<div class="briefbox"><p class="brieftitle">Your brief for next time</p><pre id="briefpre"></pre><button class="btn ghost" id="copybrief">Copy the brief</button> <button class="btn ghost" id="dlresults">Download your results</button></div>';
  host.innerHTML=h;
  /* Written items: inject the learner's text as TEXT (never innerHTML — it is
     untrusted input), then build the self-score checkboxes. Objective credit lands
     only when every criterion is ticked, same contract as a practice typed item. */
  written.forEach(function(w,wi){
    var wrap=host.querySelector('.ritem.written .youranswer p, [data-w="'+wi+'"]')&&host.querySelectorAll('.ritem.written')[wi];
    if(!wrap)return;
    var ansP=wrap.querySelector('.youranswer p');
    if(ansP)ansP.textContent=w.text||"(nothing written)";
    var crits=wrap.querySelector('.crits');
    if(!crits)return;
    var boxes=[];
    (w.f.criteria||[]).forEach(function(c){
      var row=document.createElement("label");row.className="crit";
      var box=document.createElement("input");box.type="checkbox";boxes.push(box);
      var sp=document.createElement("span");sp.innerHTML=c;
      row.appendChild(box);row.appendChild(sp);crits.appendChild(row);
      box.addEventListener("change",function(){
        if(boxes.length&&boxes.every(function(x){return x.checked;}))mark(w.f.id);
      });
    });
  });
  document.getElementById("briefpre").textContent=brief;
  var cb=document.getElementById("copybrief");
  cb.addEventListener("click",function(){
    var txt=document.getElementById("briefpre").textContent;
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){cb.textContent="Copied";},function(){cb.textContent="Select and copy above";});
    else cb.textContent="Select and copy above";
  });
  var dl=document.getElementById("dlresults");
  if(dl)dl.addEventListener("click",function(){
    var hist=tmAttempts();
    var agg={};
    hist.forEach(function(a){(a.objs||[]).forEach(function(o){
      if(!agg[o.label])agg[o.label]={got:0,tot:0};
      agg[o.label].got+=o.got;agg[o.label].tot+=o.tot;});});
    var payload={lesson:document.title,slug:tmSlug(),exported:new Date().toISOString(),
      attempts:hist,
      perObjective:Object.keys(agg).map(function(k){
        return {label:k,got:agg[k].got,tot:agg[k].tot,
          pct:agg[k].tot?Math.round(100*agg[k].got/agg[k].tot):null};})};
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=tmSlug()+"-results.json";
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
  });
  var rm=document.getElementById("retryMissed");
  if(rm)rm.addEventListener("click",function(){runSecondPass(results,objCells);});
}
/* Practice items on an objective that fell short, missed on the first attempt.
   Empty for any lesson whose practice items carry no obj tag — finals only, which
   is exactly what the retry did before. */
function retryExtras(objCells){
  var under={};
  objCells.forEach(function(c){if(c.tot&&!c.pass)under[c.tag]=true;});
  return PRACTICE.filter(function(p){return under[p.obj]&&p.ok===false;});
}
function runSecondPass(results,objCells){
  var missed=results.filter(function(r){return !r.ok;})
    .concat(objCells?retryExtras(objCells):[]);
  var host=document.getElementById("readout");
  var wrap=document.createElement("div");
  wrap.innerHTML='<h3 class="p2head">Second pass — what you missed</h3><p id="p2score" class="p2score">Scored separately — your first score stands. First answer on each item counts.</p>';
  host.appendChild(wrap);
  var got=0,doneN=0,total=missed.length;
  function tally(ok){
    doneN++;if(ok)got++;
    var el=document.getElementById("p2score");
    el.textContent="Second pass: "+got+"/"+doneN+(doneN<total?" so far ("+(total-doneN)+" to go)":" — done. Your first score stands; this pass is separate.");
  }
  missed.forEach(function(r){
    var f=r.f;
    /* A final item carries one back: for the whole item; a practice item carries one
       per wrong option. Take whichever this item has. */
    buildRuling({id:f.id+"_p2",mark:f.id,kind:"Second pass",title:f.title,tx:f.tx,q:f.q,onFirst:tally,
      opts:f.opts.map(function(o){return {ok:o.ok,t:o.t,why:o.why,back:o.ok?undefined:(f.back||o.back)};})},wrap);
  });
  var rm=document.getElementById("retryMissed");
  if(rm)rm.disabled=true;
  wrap.scrollIntoView({behavior:"smooth",block:"start"});
}

/* ===================== drawer, locks, banner ===================== */
function wireChrome(){
  var qrbtn=document.getElementById("qrbtn"),drawer=document.getElementById("drawer");
  qrbtn.addEventListener("click",function(){
    if(locksOn()){showPauseBar();return;}
    drawer.classList.toggle("open");
  });
  document.getElementById("drclose").addEventListener("click",function(){drawer.classList.remove("open");});
  document.getElementById("pbResume").addEventListener("click",resumeFinal);
  document.getElementById("pbOpen").addEventListener("click",pauseFinal);
  document.querySelectorAll(".devlock .lockveil").forEach(function(v){
    v.addEventListener("click",showPauseBar);
  });
  var menu=document.getElementById("lessonmenu");
  menu.querySelector("summary").addEventListener("click",function(ev){
    if(menu.classList.contains("locked")){ev.preventDefault();showPauseBar();}
  });
  menu.querySelectorAll(".menu a").forEach(function(a){
    a.addEventListener("click",function(){menu.removeAttribute("open");});
  });
  document.getElementById("rail").addEventListener("click",function(ev){
    if(document.getElementById("rail").classList.contains("locked")){ev.preventDefault();showPauseBar();}
  });
  document.addEventListener("click",function(ev){
    if(menu.hasAttribute("open")&&!menu.contains(ev.target))menu.removeAttribute("open");
  });
}

/* ===================== final keyboard + swipe ===================== */
function wireFinalNav(){
  document.getElementById("fback").addEventListener("click",function(){fGo(fCur-1);});
  document.getElementById("fnext").addEventListener("click",function(){fGo(fCur+1);});
  document.getElementById("fsubmit").addEventListener("click",submitFinal);
  document.getElementById("startFinal").addEventListener("click",startFinal);
  document.addEventListener("keydown",function(ev){
    if(!finalActive||finalSubmitted)return;
    var t=ev.target;
    if(t&&(t.tagName==="TEXTAREA"||t.tagName==="INPUT"))return;
    if(ev.key==="ArrowRight"){fGo(fCur+1);ev.preventDefault();}
    if(ev.key==="ArrowLeft"){fGo(fCur-1);ev.preventDefault();}
  });
  var x0=null,stage=document.getElementById("finalstage");
  stage.addEventListener("touchstart",function(ev){x0=ev.touches[0].clientX;},{passive:true});
  stage.addEventListener("touchend",function(ev){
    if(x0===null)return;
    var dx=ev.changedTouches[0].clientX-x0;x0=null;
    if(!finalActive||finalSubmitted)return;
    if(dx<-60)fGo(fCur+1);
    if(dx>60)fGo(fCur-1);
  },{passive:true});
}

/* ===================== voice/pause chrome wiring (call from lesson init) ===================== */
function wireVoiceChrome(){
  var bh=document.getElementById("voicebtn"),pb=document.getElementById("pausebtn");
  bh.addEventListener("click",function(){setVoiceOn(!voiceOn);});
  pb.addEventListener("click",function(){setSeqPaused(!seqPaused);});
  syncPauseBtn();
  if(hasVoice())setVoiceOn(true);else voiceLabel();
}
