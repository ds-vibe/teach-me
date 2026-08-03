"use strict";

/* ---- config the generalized runtime reads (were hardcoded in the engine) ---- */
var OBJS=[
 {chip:"obj1chip",label:"Position calls",tag:1,keys:["r1","r1m","t1","f1"]},
 {chip:"obj2chip",label:"Offence calls",tag:2,keys:["r2","r3","r3m","f2","f3","f4"]}
];
var LOCK_IDS=["stepdev","linedev","fullcheckdev","rebuilddev"];
var BRIEF_TITLE="Lesson brief — The Offside Rule (IFAB Law 11, 2026/27 edition)";
var BRIEF_SCOPE="Scoped out of this lesson (candidates for a next one): VAR offside protocol and semi-automated tracking; the deliberate-play vs deflection boundary; Law 11 history; players leaving the field of play.";

/* ===================== voice engine (embedded MP3 -> browser TTS -> silent) ===================== */

/* ---------- pause-aware sequence controller ---------- */

/* ===================== narration lines (single source of truth) ===================== */
var LINES={
gloss_hero:"Most offside arguments run on a rule the law does not contain. In the next fifteen minutes you will learn the test referees actually apply: where the line really is, the frozen moment it is judged, and why a player can stand offside all day without being penalised.",
marker_orient:"Three sections, then a short closed-book final. Try each call before you read on. First: where the offside line actually is.",
marker_final:"From here you are the assistant referee. The reference shelf and the widgets lock now, and they come back when your last answer is in. Take your time — you can change any answer until you submit.",
seq_full_1:"Question one: freeze the frame at the team-mate's touch. Was he in an offside position — beyond the ball and the second-last opponent, in the opponents' half? If not, play on. Nothing else matters.",
seq_full_2:"Question two: rule out the exempt restarts. If the ball came straight from a goal kick, a throw-in or a corner, there is no offside. Play on.",
seq_full_3:"Question three: did he get involved? Touch the ball, affect an opponent, or profit from a rebound or a save. Three yeses make the offence: indirect free kick where it happened. One caveat sits under the diagram: an opponent's deliberate play restarts the count.",
seq_full_4:"Now a real call. A cross from open play, and at the delivery the striker's boot is half a step nearer the goal line than the second-last opponent, with the ball behind him. Question one: yes.",
seq_full_5:"The delivery was a cross in open play — not a goal kick, throw-in or corner. Question two: yes.",
seq_full_6:"He meets it with his head. Involved. Question three: yes. Offside — indirect free kick from where he headed it.",
seq_full_7:"Any no, anywhere along the way, and the flag stays down. Play on."
};

/* ===================== mastery ledger ===================== */
var M={r1:false,r1m:false,t1:false,r2:false,r3:false,r3m:false,f1:false,f2:false,f3:false,f4:false};
var LEDGER_ROWS=[
 ["r1","The freeze-frame call, with the keeper out of his goal"],
 ["r1m","The level call"],
 ["t1","The position test, in your own words"],
 ["f1","Final: the position call"],
 ["r2","The no-touch interference call"],
 ["r3","The throw-in call"],
 ["r3m","The free-kick call"],
 ["f2","Final: the standing-offside call"],
 ["f3","Final: the rebound call"],
 ["f4","Final: the goal-kick call"]
];

/* ===================== shared: shuffle with escape pinned last ===================== */

/* ===================== commit cards (ungraded) ===================== */
var COMMITS=[
{id:"hero",host:"commit-hero",tag:"Your first call",
 stem:"Freeze that goal. The striker stood in an offside position when the shot was hit, and he never touched the ball. Should the goal stand?",
 opts:[
  {t:"The goal stands",v:"info",resp:"Maybe — but you cannot know it yet. Standing offside is not, by itself, an offence. What decides this goal is whether he got involved: did he affect the keeper, or the play, without touching the ball? That missing fact is the middle of this lesson."},
  {t:"Offside — no goal",v:"info",resp:"The pub agrees with you, and the pub is guessing. Standing in an offside position is not an offence on its own. Whether the goal stands turns on a fact you have not been given: did he get involved — affect the keeper, or the play? That is the middle of this lesson."},
  {t:"I'd need to know more",v:"ok",esc:true,resp:"Right. Position alone decides nothing. You would need to know whether he got involved: touched the ball, affected an opponent, or profited from a rebound. That is the offence test, and it is where this page is headed."}
 ]},
{id:"c1",host:"commit-c1",tag:"Make the call",
 stem:"A through-ball is hit. At the instant it leaves the passer's boot, the striker is a full stride behind the last outfield defender. He outsprints everyone and collects the ball three strides beyond the whole back line. Your call: offside, or onside?",
 opts:[
  {t:"Onside",v:"ok",resp:"Correct — and the reason is worth making exact. The judgment is frozen at the instant his team-mate plays the ball, and at that instant he was behind the defender. The sprint while the ball travels changes nothing."},
  {t:"Offside",v:"no",resp:"He certainly looks offside when he collects it, three strides clear. But the law does not judge him there. It judges him at the instant his team-mate plays the ball — and at that instant he was a stride behind the defender. The run afterwards changes nothing."},
  {t:"Can't say yet",v:"info",esc:true,resp:"You have every fact you need, though the key one is easy to miss: the call is judged at the instant the ball is played, not when it is received. At that instant he was behind the defender — onside."}
 ]},
{id:"c2",host:"commit-c2",tag:"Back to the opening goal",
 stem:"Now you know the striker was in an offside position at the shot. Add the missing facts: he stood at the far post, never moved for the ball, no defender changed what they were doing because of him, and the keeper's view was clear. Does the goal stand?",
 opts:[
  {t:"Goal stands",v:"ok",resp:"Yes. Standing in an offside position is not an offence — the law says so in its first sentence on the subject. He touched nothing and affected nobody, so he was never involved. The goal stands."},
  {t:"Offside — no goal",v:"no",resp:"Position alone cannot disallow it. He touched nothing and affected nobody — and being in an offside position is, in the law's own words, not an offence. What would change the call is involvement, which is what this section defines."},
  {t:"Still can't say",v:"info",esc:true,resp:"This time the facts settle it: no touch, no effect on any opponent, no rebound. Position alone is never an offence, so the goal stands. What counts as affecting an opponent is the real content of this section."}
 ]},
{id:"c3",host:"commit-c3",tag:"One more call",
 stem:"A quick free kick catches the defence asleep. The striker was standing beyond the whole back line — clearly in an offside position — when it was taken. He receives it directly and scores. Does the flag go up?",
 opts:[
  {t:"Flag — offside",v:"ok",resp:"Yes. The exemption list is exactly three long — goal kick, throw-in, corner — and a free kick is not on it. Received directly from a team-mate's free kick, the normal test applies, and he fails it."},
  {t:"No flag — you can't be offside straight from a set piece",v:"no",resp:"Some set pieces work that way; free kicks do not. Only three restarts are exempt — goal kick, throw-in, corner — and the list does not stretch. From a free kick the normal test applies: offside."},
  {t:"Can't say yet",v:"info",esc:true,resp:"The fact you might want — which restart it was — is given: a free kick. Only goal kicks, throw-ins and corners are exempt. So the normal test applies, and the flag goes up."}
 ]}
];

/* ===================== ruling / MC widget (graded) ===================== */

var RULINGS=[
{id:"r1",mark:"r1",kind:"Your call",title:"The stranded keeper",
 tx:[["At the touch","the goalkeeper is stranded forty yards from his own goal, caught upfield after a corner. The striker waits twenty yards from goal with exactly one opponent — a centre-back — between him and the goal line."],
     ["The delivery","a team-mate plays the pass from deeper; the ball is behind the striker when it is played."]],
 q:"Is the striker in an offside position?",
 opts:[
  {ok:true,t:"Yes — only one opponent is nearer the goal line than him",why:"The law counts opponents, not defenders. With the keeper stranded upfield, the last two opponents are the centre-back and the keeper — and the striker is beyond the keeper, so only one opponent shields him. Nearer than the second-last opponent, nearer than the ball: offside position."},
  {t:"No — a defender is still between him and the goal",why:"That is the pub rule, and this is where it breaks. The law never says last defender; it says second-last opponent, and the keeper is just an opponent. With the keeper caught upfield, one centre-back is not enough — he is in an offside position.",back:"#s1|§1 The two markers"},
  {t:"It depends on whether he goes on to touch the ball",why:"Touching decides the offence, not the position. Position is read from the freeze-frame alone — the instant the pass is played — before anyone asks what he did next. Involvement is a separate, later question.",back:"#s2|§2 When a position becomes an offence"}
 ],
 mutate:{id:"r1m",mark:"r1m",kind:"Same scene, one change",title:"The striker drops off",
  scen:"The striker has dropped back and is exactly level with the stranded goalkeeper when the pass is played. Everything else is unchanged.",
  q:"Now is he in an offside position?",
  opts:[
   {ok:true,t:"No — level with the second-last opponent is onside",why:"Level is not nearer. The law spells it out: a player is not in an offside position if level with the second-last opponent. Exactly level goes to the attacker, every time."},
   {t:"Yes — he is still ahead of the ball with only one defender goal-side",why:"Being ahead of the ball only matters if he is also nearer the goal line than the second-last opponent. He is exactly level with him — and level is onside.",back:"#s1|§1 Level is onside"}
  ]}},
{id:"r2",mark:"r2",kind:"Your call",title:"The missed header",
 tx:[["At the strike","a winger whips in the cross; the striker at the near post is a stride offside."],
     ["What he does","he hurls himself at the ball — and misses it completely. The keeper, braced for the header, stays rooted as the ball drifts across."],
     ["How it ends","an onside team-mate heads it in at the far post."]],
 q:"What is the call?",
 opts:[
  {t:"Goal — he never touched the ball, so he was never involved",why:"Touching is only the first form of involvement. He clearly attempted to play a ball close to him, and the attempt affected the keeper, who stayed rooted for a header that never came. That is involvement without a touch, and it is offside.",back:"#s2|§2 Affecting an opponent"},
  {ok:true,t:"Offside — he interfered with an opponent",why:"He clearly attempted to play a ball close to him, and the attempt affected an opponent: the keeper stayed rooted for the header instead of covering the far post. That is the second form of involvement — no touch required. Indirect free kick."},
  {t:"Offside — he interfered with play",why:"Right call, wrong ground. Interfering with play means playing or touching the ball, and he missed it entirely. What he did was interfere with an opponent: his lunge froze the keeper. The label matters, because he-never-touched-it is exactly the argument for waving play on.",back:"#s2|§2 The three forms of involvement"}
 ]},
{id:"r3",mark:"r3",kind:"Your call",title:"The long throw",
 tx:[["At the throw","the striker waits beyond the entire back line, nearer the goal line than every opponent but the keeper."],
     ["The delivery","a long throw-in, straight to him — nobody else touches it."],
     ["What he does","chests it down, turns, and scores."]],
 q:"Your call?",
 opts:[
  {t:"Flag — he was beyond the whole defence when it was thrown",why:"He was, and it does not matter. There is no offside offence when the ball is received directly from a throw-in. The exemption is the whole ruling: goal stands.",back:"#s3|§3 The exempt restarts"},
  {ok:true,t:"No flag — received directly from a throw-in",why:"Throw-ins are one of the three exempt restarts, with goal kicks and corners. His position when it was thrown cannot be held against him. Goal stands."},
  {t:"No flag — standing in an offside position is not an offence",why:"A true sentence, but the wrong reason. He did not just stand there — he chested it down and scored, which is involvement by any measure. What saves him is the throw-in exemption, nothing else.",back:"#s3|§3 The exempt restarts"}
 ],
 mutate:{id:"r3m",mark:"r3m",kind:"Same scene, one change",title:"Now it is a free kick",
  scen:"Same delivery, same striker beyond the back line — but the ball comes from a quick free kick by the touchline instead of a throw-in.",
  q:"Now?",
  opts:[
   {ok:true,t:"Flag — free kicks are not exempt",why:"The list is closed: goal kick, throw-in, corner. A free kick is ordinary play for offside purposes — so his position at the kick counts, and playing the ball made him involved. Indirect free kick the other way."},
   {t:"No flag — same delivery, same answer",why:"The delivery looks identical; the law cares which restart it was. Only goal kicks, throw-ins and corners are exempt. From a free kick the normal test applies, and he fails it.",back:"#s3|§3 The exempt restarts"}
  ]}}
];

/* ===================== typed self-scored item ===================== */
var T1={mark:"t1",kind:"In your own words",title:"Correct the pub",
 prompt:"Your friend says: “Offside is simple — past the last defender when the ball is kicked.” Type the correction you would give. Say what is compared, and at what moment.",
 model:"It is judged at the instant a team-mate plays the ball, not when the runner receives it. At that instant a player is in an offside position only if part of his head, body or feet is nearer the goal line than both the ball and the second-last opponent — and the keeper counts as an opponent like any other. Exactly level is onside, and arms don't count.",
 criteria:[
  "<b>The moment</b> — your answer says the call is judged when a team-mate plays the ball, not when it is received",
  "<b>The opponents</b> — your answer says second-last opponent (keeper included), not “last defender”",
  "<b>The ball</b> — your answer makes him beat the ball as well as the opponent",
  "<b>Level</b> — your answer gives exactly level to the attacker"
 ]};

/* ===================== step-through device ===================== */
var STEP_FRAMES=[
 {att:222,ball:[131,143],cap:"<b>Frame 1 — the pass is played.</b> Freeze it here. The striker is a stride behind the last outfield defender: onside. This frame is the whole judgment."},
 {att:262,ball:[200,125],cap:"<b>Frame 2 — the ball is in flight.</b> The striker sprints past the defender. It looks alarming and means nothing: the picture was already taken."},
 {att:300,ball:[292,108],cap:"<b>Frame 3 — he collects it,</b> three strides beyond the whole back line. Anyone judging by this frame calls offside. The law does not use this frame."},
 {att:300,ball:[292,108],cap:"<b>Frame 4 — the verdict: onside.</b> He was behind the defender at his team-mate's touch, and nothing after that instant counts."}
];
var stepIx=0;
function stepRender(){
  var f=STEP_FRAMES[stepIx];
  var att=document.getElementById("st-att"),lab=document.getElementById("st-attlab"),ball=document.getElementById("st-ball");
  att.style.transition="transform .5s";lab.style.transition="transform .5s";ball.style.transition="transform .5s";
  att.style.transform="translate("+(f.att-222)+"px,0)";
  lab.style.transform="translate("+(f.att-222)+"px,0)";
  ball.style.transform="translate("+(f.ball[0]-131)+"px,"+(f.ball[1]-143)+"px)";
  document.getElementById("stepcap").innerHTML=f.cap;
  document.getElementById("stepback").disabled=stepIx===0;
  document.getElementById("stepnext").disabled=stepIx===STEP_FRAMES.length-1;
  var dots=document.getElementById("stepdots");dots.innerHTML="";
  STEP_FRAMES.forEach(function(_,i){var s=document.createElement("i");if(i===stepIx)s.className="on";dots.appendChild(s);});
}

/* ===================== offside-line slider device ===================== */
function lineRender(){
  var att=+document.getElementById("attsl").value;
  var def=+document.getElementById("defsl").value;
  var BALL=205,HALF=170,EPS=3;
  var a=document.getElementById("li-att");a.setAttribute("cx",att);
  var alab=document.getElementById("li-attlab");alab.setAttribute("x",att-14);
  var dEl=document.getElementById("li-def");dEl.setAttribute("cx",def);
  var dlab=document.getElementById("li-deflab");dlab.setAttribute("x",def-18);
  var line=Math.max(def,BALL);
  var ln=document.getElementById("li-line");ln.setAttribute("x1",line);ln.setAttribute("x2",line);
  var ro=document.getElementById("linereadout");
  var marker=(def>=BALL)?"second-last opponent":"ball";
  if(att<=HALF){ro.className="readout ok";ro.textContent="In his own half (the halfway line included) — he cannot be in an offside position, wherever the defenders are.";}
  else if(att<line-EPS){ro.className="readout ok";ro.textContent=(line===def&&def>=BALL)?"Onside — the second-last opponent is nearer the goal line than he is.":"Onside — he is level with or behind the ball, and you cannot be offside behind the ball.";}
  else if(Math.abs(att-line)<=EPS){ro.className="readout ok";ro.textContent="Level with the "+marker+" — level is not nearer. Onside.";}
  else{ro.className="readout offside";ro.textContent="Offside position — nearer the goal line than both the ball and the second-last opponent. Position only: whether he is penalised is the next section's question.";}
}

/* ===================== full-check diagram sequence ===================== */
function startFullSeq(btn){
  document.getElementById("fw").classList.remove("hiddenv");
  var rb=document.getElementById("rebuildbody");if(rb)rb.hidden=true;
  fwDim();
  runSeq([
    {say:"seq_full_1",fx:function(){fwShow("start","e1","q1","x1","l1");}},
    {say:"seq_full_2",fx:function(){fwShow("e2","q2","x2","l2");}},
    {say:"seq_full_3",fx:function(){fwShow("e3","q3","x3","l3","e4","term");}},
    {say:"seq_full_4",fx:function(){fwLit("q1","e2");}},
    {say:"seq_full_5",fx:function(){fwLit("q2","e3");}},
    {say:"seq_full_6",fx:function(){fwLit("q3","e4");fx("term").classList.add("ring");}},
    {say:"seq_full_7"}
  ],function(){
    fwAll().forEach(function(e){e.classList.remove("pend");});
    btn.setAttribute("data-idle","Replay");resetSeqBtn(btn);
  },btn);
}

/* ===================== rebuild-from-memory (ungraded) ===================== */
function buildRebuild(){
  var Q=["Offside position at the team-mate's touch?","Anything other than a goal kick, throw-in or corner?","Did he get involved?"];
  var start=document.getElementById("rebuildstart"),body=document.getElementById("rebuildbody"),
      chips=document.getElementById("rbchips"),slots=document.getElementById("rbslots"),msg=document.getElementById("rbmsg");
  if(!start)return;
  var next=0;
  function render(){
    next=0;slots.innerHTML="";msg.textContent="Click the checks in order.";msg.className="readout";
    chips.innerHTML="";
    var order=Q.map(function(_,i){return i;});
    order.sort(function(){return Math.random()-0.5;});
    order.forEach(function(qi){
      var b=document.createElement("button");b.className="btn ghost";b.textContent=Q[qi];
      b.addEventListener("click",function(){
        if(b.disabled)return;
        if(qi===next){
          b.disabled=true;b.style.opacity=".45";
          var d=document.createElement("p");d.className="ff";d.innerHTML="<b>Check "+(next+1)+"</b> — "+Q[qi];
          slots.appendChild(d);
          next++;
          if(next===Q.length){
            msg.className="readout ok";
            msg.textContent="That is the order: position, then the restart, then involvement. The diagram is back above.";
            document.getElementById("fw").classList.remove("hiddenv");
            start.querySelector(".wl").textContent="Reset";
          } else {msg.className="readout ok";msg.textContent="Yes — that is check "+next+". Keep going.";}
        } else {
          msg.className="readout offside";
          msg.textContent="Not yet — the referee asks another check before that one.";
        }
      });
      chips.appendChild(b);
    });
  }
  start.addEventListener("click",function(){
    body.hidden=false;
    document.getElementById("fw").classList.add("hiddenv");
    start.querySelector(".wl").textContent="Reset";
    render();
  });
}

/* ===================== final ===================== */
var FINALS=[
{id:"f1",obj:1,title:"The reaching arm",
 tx:[["At the touch","the striker straddles halfway: both feet and his whole body are in his own half, but one outstretched arm reaches beyond the line into the opponents' half."],
     ["The delivery","an open-play through-ball from a team-mate."],
     ["What he does","runs on, one-on-one, and scores."]],
 q:"Your call?",back:"#s1|§1 Own half, and which body parts count",
 opts:[
  {t:"Flag — part of him was in the opponents' half when the ball was played",why:"The only part across the line was his arm — and hands and arms are never considered, for any player. Head, body or feet must be in the opponents' half, and none of his were. Onside: goal stands."},
  {ok:true,t:"No flag — arms don't count, so no part that matters was in the opponents' half",why:"Offside position needs head, body or feet in the opponents' half. His arm is not measured, and the halfway line itself does not count as the opponents' half either. Onside: goal stands."},
  {t:"Flag — he ended up nearer the goal line than the second-last opponent",why:"Where he ended up is not the question. The frame is frozen at the team-mate's touch, and at that instant no part of him that counts was in the opponents' half. Onside: goal stands."}
 ]},
{id:"f2",obj:2,title:"The onlooker on the wing",
 tx:[["At the strike","a full-back thumps a dipping shot from thirty yards; a forward is loitering a yard offside, wide on the left touchline, a long way from the ball's path."],
     ["What he does","nothing. He stays wide, and neither the keeper nor any defender so much as glances at him."],
     ["How it ends","the shot dips in under the bar, untouched."]],
 q:"Your call?",back:"#s2|§2 When a position becomes an offence",
 opts:[
  {t:"No goal — he was offside when the shot was hit",why:"He was in an offside position — which is not an offence. He touched nothing, affected no opponent, and played no rebound, so he was never involved. Goal stands."},
  {ok:true,t:"Goal — offside position alone, with no involvement, is not an offence",why:"It is not an offence to be in an offside position. No touch, no effect on an opponent, no rebound: the flag stays down and the goal stands."},
  {t:"No goal — his position gained him an advantage when the ball went in",why:"Gaining an advantage has a precise meaning: playing the ball, or affecting an opponent, after a rebound, deflection or deliberate save. The shot went straight in; he played nothing and affected no one, so the goal stands."}
 ]},
{id:"f3",obj:2,title:"The parried shot",
 tx:[["At the strike","a winger shoots from a tight angle; the striker is a stride offside in the centre."],
     ["What happens","the keeper gets a glove to it — a deliberate save — and pushes the ball into the six-yard box."],
     ["What he does","the striker reacts first and taps in."]],
 q:"Your call?",back:"#s2|§2 Profiting from a rebound or a save",
 opts:[
  {t:"Goal — the keeper's touch played him onside",why:"A save never resets offside — the keeper's glove does not start a new phase. He was offside at the strike and gained an advantage by playing the ball after a deliberate save. Offside: indirect free kick, no goal."},
  {ok:true,t:"No goal — offside at the shot, and a save does not reset it",why:"He was in an offside position at the strike; the ball came to him off a deliberate save; playing it is gaining an advantage. Offside: indirect free kick, no goal."},
  {t:"Goal — the ball came to him from an opponent, so a new phase started",why:"How it came from the opponent matters. A deliberate play — a controlled pass or clearance — does reset offside; a save never does. This was a save. Offside: no goal."}
 ]},
{id:"f4",obj:2,title:"The seventy-yard goal kick",
 tx:[["At the kick","the keeper drills a goal kick long; his forward is loitering ten yards beyond the last outfield opponent, deep in the opponents' half."],
     ["The delivery","the kick reaches him directly — nobody else touches it."],
     ["What he does","brings it down and scores."]],
 q:"Your call?",back:"#s3|§3 The exempt restarts",
 opts:[
  {t:"Flag — he was ten yards offside when it was taken",why:"His position is real and irrelevant: there is no offside offence when the ball is received directly from a goal kick. Goal stands."},
  {ok:true,t:"No flag — received directly from a goal kick",why:"Goal kicks are one of the three exempt restarts, with throw-ins and corners. Direct receipt: no offence, goal stands."},
  {t:"Flag — the exemption only covers throw-ins and corners",why:"Goal kicks are on the list. The three exemptions are goal kick, throw-in and corner kick — it is free kicks that are not exempt. Goal stands."}
 ]}
];

/* ===================== drawer, locks, banner ===================== */

/* ===================== scrollspy ===================== */
var SECIDS=["intro","orient","s1","s2","s3","final","wrapup"];
function spy(){
  var y=window.scrollY+92,cur="intro";
  SECIDS.forEach(function(id){var el=document.getElementById(id);if(el&&el.offsetTop<=y)cur=id;});
  var railMap={intro:"intro",orient:"intro",s1:"s1",s2:"s2",s3:"s3",final:"final",wrapup:"final"};
  document.querySelectorAll("#rail a").forEach(function(a){a.classList.toggle("here",a.getAttribute("data-sec")===railMap[cur]);});
  var chipI=document.getElementById("chip-intro"),chipF=document.getElementById("chip-final"),menu=document.getElementById("lessonmenu");
  chipI.classList.toggle("on",cur==="intro"||cur==="orient");
  chipF.classList.toggle("on",cur==="final"||cur==="wrapup");
  menu.classList.toggle("here",cur==="s1"||cur==="s2"||cur==="s3");
  var n=cur==="s1"?1:cur==="s2"?2:cur==="s3"?3:0;
  document.getElementById("lessonnum").textContent=n?(n+"/3"):"1/3";
}

/* ===================== final keyboard + swipe ===================== */

/* ===================== init ===================== */
function init(){
  TM_initFinal();
  COMMITS.forEach(buildCommit);
  buildRuling(RULINGS[0],document.getElementById("host-r1"));
  buildTyped(T1,document.getElementById("host-t1"));
  buildRuling(RULINGS[1],document.getElementById("host-r2"));
  buildRuling(RULINGS[2],document.getElementById("host-r3"));
  renderLedger();
  stepRender();
  document.getElementById("stepback").addEventListener("click",function(){if(stepIx>0){stepIx--;stepRender();}});
  document.getElementById("stepnext").addEventListener("click",function(){if(stepIx<STEP_FRAMES.length-1){stepIx++;stepRender();}});
  document.getElementById("attsl").addEventListener("input",lineRender);
  document.getElementById("defsl").addEventListener("input",lineRender);
  lineRender();
  var wf=document.getElementById("watchfull");
  seqToggle(wf,function(){startFullSeq(wf);});
  var hl=document.getElementById("heroListen");
  seqToggle(hl,function(){runSeq([{say:"gloss_hero"}],null,hl);});
  var ol=document.getElementById("orientListen");
  seqToggle(ol,function(){runSeq([{say:"marker_orient"}],null,ol);});
  var fl=document.getElementById("finalListen");
  seqToggle(fl,function(){runSeq([{say:"marker_final"}],null,fl);});
  buildRebuild();
  wireChrome();
  wireFinalNav();
  wireVoiceChrome();
  window.addEventListener("scroll",spy,{passive:true});
  spy();
}
document.addEventListener("DOMContentLoaded",init);
