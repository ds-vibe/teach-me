/* assistant-dock.js — one BYOK panel for narration and page chat.
 *
 * Replaces the separate voice-dock.js + chat-dock.js (A6). One FAB, one panel,
 * one key. Injected by assemble.mjs (--voice-dock / --chat); configure via
 * window.ASSISTANT_DOCK = { voice:true, chat:true, provider:"openai"|"anthropic",
 * chatModel, ttsModel, ttsVoice, accent }.
 *
 * Defaults BOTH capabilities to OpenAI so a single key unlocks everything; set
 * provider:"anthropic" to run chat against Anthropic instead (its own key).
 *
 * Consent is per capability: entering a key never spends anything. Chat spends
 * per question; narration only on the explicit Generate button, estimate shown.
 * The key lives in the input for this page load — never stored, never in the file.
 *
 * Corners are assigned: this FAB owns BOTTOM-RIGHT; the review launcher is moved
 * to bottom-left by assemble.mjs; the pause bar spans the bottom above both.
 */
(function () {
  var cfg = window.ASSISTANT_DOCK || {};
  var wantVoice = cfg.voice !== false && window.LINES && !(window.VOICE && Object.keys(window.VOICE).length);
  var wantChat = !!cfg.chat;
  if (!wantVoice && !wantChat) return;

  var PROVIDER = (cfg.provider || "openai").toLowerCase();
  var CHAT_MODEL = cfg.chatModel || (PROVIDER === "anthropic" ? "claude-sonnet-5" : "gpt-5.4");
  var TTS_MODEL = cfg.ttsModel || "gpt-4o-mini-tts";
  var TTS_VOICE = cfg.ttsVoice || "ash";
  var EL_VOICE_ID = cfg.elevenVoiceId || "21m00Tcm4TlvDq8ikWAM";
  var EL_MODEL = cfg.elevenModel || "eleven_multilingual_v2";
  var INSTR = cfg.instructions || "Calm, warm teacher. Documentary-calm delivery: measured, clear, quietly engaged. Domain tokens crisp.";
  var ACCENT = cfg.accent || "var(--accent,#2f4858)";
  // Name only the providers that can actually serve what this dock does.
  //   voice  -> OpenAI or ElevenLabs (both are text-to-speech)
  //   chat   -> OpenAI or Anthropic  (ElevenLabs cannot answer a question)
  // Routing is by KEY PREFIX at request time (see isEleven / isAnthropic), not by the
  // build-time provider, so every key named here works whichever way the page was built.
  var KEY_HINT, KEY_DEST;
  if (wantVoice && wantChat) { KEY_HINT = "sk-… OpenAI, sk-ant-… Anthropic, or an ElevenLabs key"; KEY_DEST = "OpenAI, Anthropic or ElevenLabs"; }
  else if (wantVoice)        { KEY_HINT = "sk-… OpenAI, or an ElevenLabs key"; KEY_DEST = "OpenAI or ElevenLabs"; }
  else                       { KEY_HINT = "sk-… OpenAI, or sk-ant-… Anthropic"; KEY_DEST = "OpenAI or Anthropic"; }

  // tts.mjs applies 1.25x with ffmpeg at build time. Dock audio arrives at 1.0, so the
  // page plays it faster instead — same delivery either way.
  window.VOICE_RATE = cfg.rate || 1.25;
  var ids = wantVoice ? Object.keys(window.LINES) : [];
  var chars = 0; ids.forEach(function (k) { chars += String(LINES[k]).length; });
  var cost = (chars / 1000) * 0.0006 * 30; // rough ¢: ~$0.015/min at ~150wpm ≈ $0.018/1k chars
  var costStr = cost < 0.01 ? "under a cent" : (cost < 0.995 ? Math.round(cost * 100) + "¢" : "$" + cost.toFixed(2));

  /* ---- grounding for chat ---- */
  var GROUND = "";
  if (wantChat) {
    var main = document.querySelector("main") || document.body;
    GROUND = (main.innerText || "").replace(/\s+\n/g, "\n").trim().slice(0, cfg.groundChars || 9000);
  }

  /* ---- styles ---- */
  var css = [
    "#ad-fab{position:fixed;bottom:20px;right:20px;z-index:71;background:" + ACCENT + ";color:#fff;border:none;border-radius:100px;padding:13px 18px;font-family:var(--sans,system-ui,sans-serif);font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.3)}",
    "#ad-fab[hidden],#ad-panel[hidden]{display:none}",
    /* The dock is a reference surface: it is grounded in main.innerText, i.e. the whole
       lesson. A closed-book final that locks the drawer, the menu and the rail but
       leaves "Ask the page" live is not closed book. The runtime sets body.finalon for
       exactly the window the locks are on — it clears on a deliberate pause-out and on
       submit — so the dock follows the same rule without knowing anything about finals.
       Hide the panel too: hiding only the button leaves an already-open panel up. */
    "body.finalon #ad-fab,body.finalon #ad-panel{display:none!important}",
    "#ad-panel{position:fixed;bottom:20px;right:20px;z-index:72;width:384px;max-width:calc(100vw - 32px);max-height:calc(100vh - 40px);background:var(--card,#fff);color:var(--ink,#181818);border:1px solid var(--line-strong,#cfcfcf);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;font-family:var(--sans,system-ui,sans-serif)}",
    ".ad-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line,#e3e3e3)}",
    ".ad-head h3{font-size:14.5px;margin:0}.ad-head .x{margin-left:auto;background:none;border:none;font-size:22px;line-height:1;color:var(--ink-soft,#666);cursor:pointer}",
    ".ad-key{padding:11px 15px;border-bottom:1px solid var(--line,#e3e3e3)}",
    ".ad-key input{width:100%;font-family:var(--mono,monospace);font-size:12.5px;border:1px solid var(--line-strong,#cfcfcf);border-radius:9px;padding:8px 11px;box-sizing:border-box;background:var(--bg,#fff);color:var(--ink,#181818)}",
    ".ad-key .note{font-size:11px;color:var(--ink-faint,#8a8a8a);margin-top:6px;line-height:1.45}",
    ".ad-tabs{display:flex;border-bottom:1px solid var(--line,#e3e3e3)}",
    ".ad-tab{flex:1;background:none;border:none;padding:10px;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink-soft,#666);cursor:pointer;border-bottom:2px solid transparent}",
    ".ad-tab.on{color:var(--ink,#181818);border-bottom-color:" + ACCENT + "}",
    ".ad-body{padding:15px;overflow:auto;flex:1}",
    ".ad-body p{margin:0 0 10px;font-size:13.5px;line-height:1.5;color:var(--ink-soft,#555)}",
    ".ad-go{width:100%;background:" + ACCENT + ";color:#fff;border:none;border-radius:9px;padding:10px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}",
    ".ad-go[disabled]{opacity:.5;cursor:default}",
    ".ad-bar{height:5px;border-radius:3px;background:var(--line,#e3e3e3);overflow:hidden;margin-top:11px}.ad-bar i{display:block;height:100%;width:0;background:" + ACCENT + ";transition:width .25s}",
    ".ad-log{display:flex;flex-direction:column;gap:9px;min-height:120px}",
    ".ad-msg{max-width:90%;padding:9px 12px;border-radius:11px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}",
    ".ad-msg.u{align-self:flex-end;background:var(--accent-soft,rgba(127,127,127,.14))}",
    ".ad-msg.a{align-self:flex-start;background:var(--panel,rgba(127,127,127,.08));border:1px solid var(--line,#e3e3e3)}",
    ".ad-msg.sys{align-self:center;font-size:11.5px;color:var(--ink-faint,#8a8a8a);font-family:var(--mono,monospace);text-align:center}",
    ".ad-ask{display:flex;gap:8px;margin-top:10px}",
    ".ad-ask input{flex:1;font-size:13.5px;padding:9px 11px;border:1px solid var(--line-strong,#cfcfcf);border-radius:9px;background:var(--bg,#fff);color:var(--ink,#181818)}",
    "body{padding-bottom:88px}"
  ].join("");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---- UI ---- */
  var label = wantVoice && wantChat ? "Assistant" : (wantVoice ? "Add narration" : "Ask the page");
  var fab = document.createElement("button"); fab.id = "ad-fab"; fab.type = "button"; fab.textContent = label;
  var panel = document.createElement("div"); panel.id = "ad-panel"; panel.hidden = true;
  panel.innerHTML =
    '<div class="ad-head"><h3>' + label + '</h3><button class="x" type="button" aria-label="Close">&times;</button></div>' +
    '<div class="ad-key"><input type="password" placeholder="' + KEY_HINT + '" autocomplete="off" spellcheck="false">' +
    '<div class="note">Your key stays in this page for this visit only — never saved, never sent anywhere but ' + KEY_DEST + ". Nothing is spent until you use a feature below.</div></div>" +
    (wantVoice && wantChat ? '<div class="ad-tabs"><button class="ad-tab on" data-t="voice" type="button">Narration</button><button class="ad-tab" data-t="chat" type="button">Ask the page</button></div>' : "") +
    '<div class="ad-body"></div>';
  document.body.appendChild(fab); document.body.appendChild(panel);
  var keyEl = panel.querySelector(".ad-key input"), body = panel.querySelector(".ad-body");
  fab.onclick = function () { fab.hidden = true; panel.hidden = false; keyEl.focus(); };
  panel.querySelector(".x").onclick = function () { panel.hidden = true; fab.hidden = false; };
  var tab = wantVoice ? "voice" : "chat";
  panel.querySelectorAll(".ad-tab").forEach(function (t) {
    t.onclick = function () { panel.querySelectorAll(".ad-tab").forEach(function (x) { x.classList.remove("on"); }); t.classList.add("on"); tab = t.getAttribute("data-t"); render(); };
  });

  /* ---- voice: cache + generation (from voice-dock.js, verified 2026-07-22) ---- */
  var mem = {}, db = null, pending = {};
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36); }
  function ck(text, el) { return hash(el ? "eleven|" + EL_VOICE_ID + "|" + EL_MODEL + "|" + text : "openai|" + TTS_MODEL + "|" + TTS_VOICE + "|" + INSTR + "|" + text); }
  var dbReady = new Promise(function (res) {
    var t = setTimeout(function () { res(); }, 3000);
    try {
      var r = indexedDB.open("teachme-voice", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("mp3"); };
      r.onerror = function () { clearTimeout(t); res(); };
      r.onsuccess = function () { db = r.result; clearTimeout(t); res(); };
    } catch (e) { clearTimeout(t); res(); }
  });
  function cacheGet(k) {
    if (mem[k]) return Promise.resolve(mem[k]);
    if (!db) return Promise.resolve(null);
    return new Promise(function (res) {
      try { var rq = db.transaction("mp3", "readonly").objectStore("mp3").get(k);
        rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function cachePut(k, blob) {
    mem[k] = blob; if (!db) return;
    try { var tx = db.transaction("mp3", "readwrite"); tx.objectStore("mp3").put(blob, k); tx.onerror = function () { db = null; }; } catch (e) { db = null; }
  }
  /* Provider is read off the key prefix, so a reader pastes one key and never picks a
     provider. sk-ant- must be tested BEFORE sk- — an Anthropic key also starts "sk-",
     and treating it as OpenAI sent narration requests to the wrong API. */
  function isAnthropic(key) { return key.indexOf("sk-ant-") === 0; }
  function isOpenAI(key) { return key.indexOf("sk-") === 0 && !isAnthropic(key); }
  function isEleven(key) { return !isOpenAI(key) && !isAnthropic(key); }
  function fetchLine(id, key) {
    // Anthropic has no text-to-speech. Say so instead of failing against an API that
    // was never going to answer — the browser voice keeps the lesson usable meanwhile.
    if (isAnthropic(key)) return Promise.reject(new Error("Anthropic keys can't generate narration — use an OpenAI or ElevenLabs key for voice."));
    var text = String(LINES[id]), k = ck(text, isEleven(key));
    return cacheGet(k).then(function (hit) {
      if (hit) return hit;
      var req = isEleven(key)
        ? { url: "https://api.elevenlabs.io/v1/text-to-speech/" + EL_VOICE_ID,
            headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
            body: { text: text, model_id: EL_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } } }
        : { url: "https://api.openai.com/v1/audio/speech",
            headers: { "content-type": "application/json", authorization: "Bearer " + key },
            body: { model: TTS_MODEL, voice: TTS_VOICE, input: text, instructions: INSTR, response_format: "mp3" } };
      // ElevenLabs caps concurrent requests by plan and answers 429 rather than queueing.
      // Retry with backoff so a burst doesn't silently drop lines to the browser voice.
      function attempt(n) {
        return fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body) })
          .then(function (r) {
            if ((r.status === 429 || r.status >= 500) && n < 4)
              return new Promise(function (res) { setTimeout(res, 800 * Math.pow(2, n)); }).then(function () { return attempt(n + 1); });
            return r;
          });
      }
      return attempt(0).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t.slice(0, 120)); }); return r.blob(); })
        .then(function (blob) { cachePut(k, blob); return blob; });
    }).then(function (blob) { window.VOICE[id] = URL.createObjectURL(blob); return blob; });
  }
  var origSay = window.say;
  if (wantVoice && origSay) window.say = function (id) {
    if (window.VOICE[id] || !pending[id]) return origSay(id);
    return Promise.race([pending[id], new Promise(function (r) { setTimeout(r, 4000); })]).then(function () { return origSay(id); });
  };

  /* ---- chat ---- */
  var history = [];
  function askChat(q, key, log) {
    var think = document.createElement("div"); think.className = "ad-msg a"; think.textContent = "…"; log.appendChild(think);
    history.push({ role: "user", content: q });
    var sys = "You are a friendly assistant embedded in this lesson page. Answer grounded in the page content below. Be concise. If a question goes beyond the page, answer briefly from general knowledge and say so.\n\n=== PAGE ===\n" + GROUND;
    /* Route on the key the reader actually pasted, not on how the page was built. The
       dock invites "OpenAI or Anthropic"; honouring only the build-time provider meant an
       sk-ant- key failed on an openai-built page against a prompt that had just asked for
       it. Fall back to PROVIDER when the prefix says nothing. */
    var useAnthropic = isAnthropic(key) || (PROVIDER === "anthropic" && !isOpenAI(key));
    var model = cfg.chatModel || (useAnthropic ? "claude-sonnet-5" : "gpt-5.4");
    var req = useAnthropic ? {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: { model: model, max_tokens: 700, system: sys, messages: history },
      pick: function (d) { return d && d.content && d.content[0] && d.content[0].text; }
    } : {
      url: "https://api.openai.com/v1/chat/completions",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      /* Current OpenAI chat models reject max_tokens outright and want
         max_completion_tokens. Anthropic above still takes max_tokens — the two
         APIs disagree, so don't unify these. */
      body: { model: model, max_completion_tokens: 700, messages: [{ role: "system", content: sys }].concat(history) },
      pick: function (d) { return d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content; }
    };
    return fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var text = req.pick(d);
        if (!text) { think.className = "ad-msg sys"; think.textContent = "Error: " + ((d.error && d.error.message) || "no response — check the key"); history.pop(); return; }
        think.textContent = text; history.push({ role: "assistant", content: text });
      })
      .catch(function (e) { think.className = "ad-msg sys"; think.textContent = "Request failed: " + e.message; history.pop(); });
  }

  /* ---- panel bodies ---- */
  function render() {
    if (tab === "voice") {
      body.innerHTML = '<p>This lesson can speak with a real voice using <b>your own</b> key. ' + ids.length + " lines, ~" + chars.toLocaleString() + " characters — about " + costStr + " of your credit. Nothing generates until you press the button.</p>" +
        '<button class="ad-go" type="button">Generate narration</button><div class="ad-bar" hidden><i></i></div><p class="ad-note" style="font-size:11px;margin-top:9px"></p>';
      var go = body.querySelector(".ad-go"), barW = body.querySelector(".ad-bar"), bar = barW.querySelector("i"), note = body.querySelector(".ad-note");
      go.onclick = function () {
        var key = keyEl.value.trim(); if (!key) { keyEl.focus(); return; }
        go.disabled = true; go.textContent = "Generating…"; barW.hidden = false;
        var done = 0, failed = 0, queue = ids.slice();
        function step() {
          if (!queue.length) return Promise.resolve();
          var id = queue.shift();
          var p = fetchLine(id, key).catch(function (e) { failed++; if (failed === 1) note.textContent = "Some lines failed (" + e.message.slice(0, 90) + "). Press Generate again — finished lines are cached and are not recharged."; })
            .then(function () { done++; bar.style.width = Math.round(done / ids.length * 100) + "%"; delete pending[id]; });
          pending[id] = p; return p.then(step);
        }
        dbReady.then(function () {
          var lanes = [], width = isEleven(key) ? 2 : 5;   // ElevenLabs is strict; OpenAI is not
          for (var i = 0; i < width; i++) lanes.push(step());
          return Promise.all(lanes);
        })
          .then(function () {
            go.textContent = failed ? "Retry " + failed + " failed line" + (failed === 1 ? "" : "s") : "Narration ready";
            go.disabled = !failed;
            if (window.voiceLabel) window.voiceLabel();
            if (!failed) {
              fab.textContent = "\u2713 Narration ready";       // never "Add narration" again
              note.innerHTML = db
                ? "Saved in this browser — reopening this page costs nothing."
                : "<b>Don't reload or close this page</b> — this browser won't store audio for a local file, so a reload means generating (and paying) again. Serve the page over http to keep it.";
            }
          });
      };
    } else {
      body.innerHTML = '<div class="ad-log"></div><div class="ad-ask"><input type="text" placeholder="Ask a question about this page…"><button class="ad-go" style="width:auto;padding:9px 14px" type="button">Send</button></div>';
      var log = body.querySelector(".ad-log"), inEl = body.querySelector(".ad-ask input"), send = body.querySelector(".ad-ask .ad-go");
      function go() {
        var q = inEl.value.trim(), key = keyEl.value.trim();
        if (!q) return;
        if (!key) { var m = document.createElement("div"); m.className = "ad-msg sys"; m.textContent = "Paste your key above first."; log.appendChild(m); keyEl.focus(); return; }
        var u = document.createElement("div"); u.className = "ad-msg u"; u.textContent = q; log.appendChild(u); inEl.value = "";
        askChat(q, key, log).then(function () { log.scrollTop = log.scrollHeight; });
      }
      send.onclick = go;
      inEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
    }
  }
  render();
})();
