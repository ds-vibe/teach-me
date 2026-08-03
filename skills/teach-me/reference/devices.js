/* =====================================================================
   devices.js — optional wiring for the shapes in devices.css.

   NOT REQUIRED. If the topic wants something these don't do, write it
   bespoke. Use these when they fit so the recurring devices stop being
   rebuilt from scratch each lesson.

   Paste the functions you actually use into the lesson's own <script>,
   or inline the whole file — it defines four globals and nothing else:

     buildCmp(spec, host)      aligned comparison table
     buildDefs(spec, host)     side-by-side definitions
     buildZones(spec)          value scrubber with named zones
     buildTimeline(spec, host) events on a rail + traceTimeline()
     buildDials(spec)          several thresholds + a live verdict

   Decision diagrams are NOT here: lesson-shell.css already ships the
   spine (.frow/.fnode/.fbar/.stemcell/.exitcell/.leaf) and the runtime
   traces it with fx/fwDim/fwShow/fwLit. devices.css adds only the .fork
   split that shell CSS was missing.

   All of them are pure DOM: no timers, no state outside the host node,
   safe to call from init() in any order.
   ===================================================================== */

/* ---------------------------------------------------------------- .cmp
   spec = {
     cols:[ {label, tone:"accent"|"danger"|"good", body:[str,…], out:str}, … ],
     note: "optional caption under the whole thing"
   }
   Every column must declare the same slots in the same order — that is
   what makes the outcome rows line up instead of floating at whatever
   height the prose above them happens to end. */
function buildCmp(spec, host) {
  var wrap = document.createElement("div");
  wrap.className = "cmp aligned cols-" + spec.cols.length;
  spec.cols.forEach(function (c) {
    var col = document.createElement("div");
    col.className = "cmpcol" + (c.tone ? " " + c.tone : "");
    var h = c.label ? '<p class="cmp-label">' + c.label + "</p>" : '<p class="cmp-label"></p>';
    h += '<div>' + (c.body || []).map(function (p) { return '<p class="cmp-body">' + p + "</p>"; }).join("") + "</div>";
    h += '<p class="cmp-out">' + (c.out || "") + "</p>";
    col.innerHTML = h;
    wrap.appendChild(col);
  });
  host.appendChild(wrap);
  if (spec.note) {
    var n = document.createElement("p");
    n.className = "cmp-note"; n.innerHTML = spec.note;
    host.appendChild(n);
  }
  return wrap;
}

/* --------------------------------------------------------------- .defs
   spec = { items:[ {term, gloss, trap}, … ] }
   `trap` is the confusion this term is usually lost to — the most useful
   line in a definition and the one most often left out. */
function buildDefs(spec, host) {
  var wrap = document.createElement("div");
  wrap.className = "defs";
  spec.items.forEach(function (d) {
    var b = document.createElement("div");
    b.className = "defbox";
    b.innerHTML = '<p class="defterm">' + d.term + "</p>"
      + '<p class="defgloss">' + d.gloss + "</p>"
      + (d.trap ? '<p class="deftrap"><b>Not:</b> ' + d.trap + "</p>" : "<p class=\"deftrap\"></p>");
    wrap.appendChild(b);
  });
  host.appendChild(wrap);
  return wrap;
}

/* -------------------------------------------------------------- .zones
   spec = {
     host:"elementId", title:"…",
     min, max, step, start,
     fmt(v)            -> "$30M"
     split(v)          -> [{label,color,value}, …]   bar segments
     zones:[{label, test(v)}]                        which chip lights
     note(v)           -> "what's happening" sentence
   }
   Returns a render() you can call after changing external state (e.g. a
   mode toggle). Deliberately has no voice hooks: narrate a device with
   the runtime's runSeq(), so pausing works the same everywhere. */
function buildZones(spec) {
  var host = document.getElementById(spec.host);
  if (!host) return null;
  var id = spec.host;
  host.classList.add("zonedev");
  host.innerHTML =
    '<div class="zonehead"><p class="zonetitle">' + (spec.title || "") + "</p>"
    + '<span class="zoneval" id="' + id + '-val"></span></div>'
    + '<input type="range" id="' + id + '-range" min="' + spec.min + '" max="' + spec.max
    + '" step="' + (spec.step || 1) + '" value="' + (spec.start != null ? spec.start : spec.min) + '">'
    + '<div class="zonekey" id="' + id + '-key"></div>'
    + '<div class="zonebar" id="' + id + '-bar"></div>'
    + '<div class="zonerow" id="' + id + '-chips"></div>'
    + '<div class="zonenote" id="' + id + '-note"></div>';

  var range = document.getElementById(id + "-range");
  var bar = document.getElementById(id + "-bar");
  var chips = document.getElementById(id + "-chips");
  var key = document.getElementById(id + "-key");

  (spec.zones || []).forEach(function (z, i) {
    var c = document.createElement("div");
    c.className = "zonechip"; c.id = id + "-chip" + i; c.textContent = z.label;
    chips.appendChild(c);
  });

  function render() {
    var v = +range.value;
    var parts = spec.split(v);
    var total = parts.reduce(function (s, p) { return s + Math.max(0, p.value); }, 0);
    document.getElementById(id + "-val").textContent = spec.fmt ? spec.fmt(v) : v;
    bar.innerHTML = ""; key.innerHTML = "";
    parts.forEach(function (p) {
      var seg = document.createElement("div");
      seg.className = "zoneseg";
      seg.style.background = p.color;
      seg.style.width = (total > 0 ? (Math.max(0, p.value) / total) * 100 : 0) + "%";
      bar.appendChild(seg);
      var k = document.createElement("span");
      k.innerHTML = '<i style="background:' + p.color + '"></i>' + p.label
        + " " + (spec.fmt ? spec.fmt(p.value) : p.value);
      key.appendChild(k);
    });
    (spec.zones || []).forEach(function (z, i) {
      document.getElementById(id + "-chip" + i).classList.toggle("on", !!z.test(v));
    });
    document.getElementById(id + "-note").textContent = spec.note ? spec.note(v) : "";
  }
  range.addEventListener("input", render);
  render();
  return render;
}

/* ----------------------------------------------------------- .timeline
   spec = { items:[ {stamp, title, body, state:"done"|"now"}, … ] }
   traceTimeline(host, i) walks it: everything before i is done, i is now.
   Call from a runSeq step so the walk stays in time with narration. */
function buildTimeline(spec, host) {
  var wrap = document.createElement("div");
  wrap.className = "timeline";
  spec.items.forEach(function (it, i) {
    var d = document.createElement("div");
    d.className = "tlitem" + (it.state ? " " + it.state : "");
    d.setAttribute("data-tl", i);
    d.innerHTML = (it.stamp ? '<p class="tlstamp">' + it.stamp + "</p>" : "")
      + '<p class="tltitle">' + it.title + "</p>"
      + (it.body ? '<p class="tlbody">' + it.body + "</p>" : "");
    wrap.appendChild(d);
  });
  host.appendChild(wrap);
  return wrap;
}
function traceTimeline(host, i) {
  var items = host.querySelectorAll("[data-tl]");
  Array.prototype.forEach.call(items, function (el, n) {
    el.classList.toggle("done", i != null && n < i);
    el.classList.toggle("now", i != null && n === i);
  });
}

/* -------------------------------------------------------------- .dials
   Several thresholds at once with a live verdict — the "coverage checker"
   shape: is this business caught by the statute?

   spec = {
     host:"elementId", title:"Coverage checker", rule:"meet any one = covered",
     gate:  { label, sub, on:true },              optional precondition checkbox
     dials: [ { label, note, min, max, step, start,
                fmt(v)      -> "$15.0M"
                trips(v)    -> boolean            does this dial trip?
                tripAt      -> "> $26.625M (2026, inflation-adjusted)" } ],
     verdict: function(state) -> { title, body, inScope:boolean }
        state = { gate:boolean, tripped:[bool,…], values:[num,…], count:n }
   }
   Returns render(). Every dial reports its own trip point, so a learner
   sees which input moved the answer, not just that it moved. */
function buildDials(spec) {
  var host = document.getElementById(spec.host);
  if (!host) return null;
  var id = spec.host;
  host.classList.add("dialdev");
  var gateHTML = spec.gate
    ? '<div class="dialgate' + (spec.gate.on ? " on" : "") + '" id="' + id + '-gate">'
      + '<input type="checkbox" id="' + id + '-gatecb"' + (spec.gate.on ? " checked" : "") + '>'
      + '<label for="' + id + '-gatecb">' + spec.gate.label + "</label></div>"
      + (spec.gate.sub ? '<p class="dialsub">' + spec.gate.sub + "</p>" : "")
    : "";
  host.innerHTML =
    '<div class="dialhead"><p class="dialtitle">' + (spec.title || "") + "</p>"
    + '<span class="dialrule">' + (spec.rule || "") + "</span></div>"
    + '<div class="dialgrid"><div class="dialcol">' + gateHTML
    + spec.dials.map(function (d, i) {
        return '<div class="dial" id="' + id + '-d' + i + '">'
          + '<p class="diallabel">' + (i + 1) + " · " + d.label + "</p>"
          + (d.note ? '<p class="dialnote">' + d.note + "</p>" : "")
          + '<p class="dialval" id="' + id + '-v' + i + '"></p>'
          + '<input type="range" id="' + id + '-r' + i + '" min="' + d.min + '" max="' + d.max
          + '" step="' + (d.step || 1) + '" value="' + (d.start != null ? d.start : d.min) + '">'
          + (d.tripAt ? '<p class="dialtrip">trips at <b>' + d.tripAt + "</b></p>" : "")
          + "</div>";
      }).join("")
    + '</div><div class="dialcol"><div class="dialverdict">'
    + '<p class="dialvlabel">Verdict</p>'
    + '<p class="dialvtitle" id="' + id + '-vt"></p>'
    + '<p class="dialvbody" id="' + id + '-vb"></p>'
    + "</div></div></div>";

  var gateCb = spec.gate ? document.getElementById(id + "-gatecb") : null;
  function render() {
    var values = [], tripped = [];
    spec.dials.forEach(function (d, i) {
      var v = +document.getElementById(id + "-r" + i).value;
      values.push(v);
      var t = !!d.trips(v);
      tripped.push(t);
      document.getElementById(id + "-v" + i).textContent = d.fmt ? d.fmt(v) : v;
      document.getElementById(id + "-d" + i).classList.toggle("trips", t);
    });
    var gate = gateCb ? gateCb.checked : true;
    if (spec.gate) document.getElementById(id + "-gate").classList.toggle("on", gate);
    var state = { gate: gate, tripped: tripped, values: values,
                  count: tripped.filter(Boolean).length };
    var v = spec.verdict(state);
    var vt = document.getElementById(id + "-vt");
    vt.textContent = v.title;
    vt.className = "dialvtitle " + (v.inScope ? "in" : "out");
    document.getElementById(id + "-vb").textContent = v.body;
  }
  spec.dials.forEach(function (_, i) {
    document.getElementById(id + "-r" + i).addEventListener("input", render);
  });
  if (gateCb) gateCb.addEventListener("change", render);
  render();
  return render;
}

/* -------------------------------------------------------------- .chart
   A plotted curve with the annotations that make it teach.

   spec = {
     host:"elementId", title:"…", watchBtn:"btnId"   (optional)
     x:{ min, max, label, ticks:[…], fmt(v) },
     y:{ min, max, label, ticks:[…], fmt(v) },
     series:[ { key, label, color, fn(x), fill:true,
                labelAt: x-position for the on-curve label,
                labelDx / labelDy: px nudges, labelAnchor: start|middle|end } ],
     zones:[ { from, to, caption, color } ],        shaded x-bands
     marker:{ x, caption, showValues:true },        the "today" rule
     cross:{ x, caption }                           crossover annotation
   }

   Returns { reveal(keys…), dimAll(), showAll(), lit(keys…), el }.
   Series paths carry data-fx="ser-<key>", so a narrated walkthrough is
   just runSeq steps calling those — the same pause/voice machinery as
   every other device rather than a second animation system.

   Curves are sampled, not bezier-fitted, so a kink (an option strike, a
   tax bracket) lands exactly where the maths puts it. */
function buildChart(spec) {
  var host = document.getElementById(spec.host);
  if (!host) return null;
  var W = 880, H = 520, P = { t: 30, r: 30, b: 56, l: 74 };
  var iw = W - P.l - P.r, ih = H - P.t - P.b;
  var xs = function (v) { return P.l + (v - spec.x.min) / (spec.x.max - spec.x.min) * iw; };
  var ys = function (v) { return P.t + ih - (v - spec.y.min) / (spec.y.max - spec.y.min) * ih; };
  var xf = spec.x.fmt || String, yf = spec.y.fmt || String;
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };

  var g = "";
  // zones first — they sit under everything
  (spec.zones || []).forEach(function (z) {
    g += '<rect class="zoneband" x="' + xs(z.from) + '" y="' + P.t
      + '" width="' + (xs(z.to) - xs(z.from)) + '" height="' + ih
      + '" fill="' + (z.color || "var(--surface2)") + '"/>';
    if (z.caption) {
      var cx = xs(z.from) + 14;
      String(z.caption).split("\n").forEach(function (line, i) {
        g += '<text class="zonecap" x="' + cx + '" y="' + (P.t + 30 + i * 19)
          + '" fill="' + (z.capColor || "var(--muted)") + '">' + esc(line) + "</text>";
      });
    }
  });
  // gridlines + ticks
  (spec.y.ticks || []).forEach(function (t) {
    g += '<line class="grid" x1="' + P.l + '" y1="' + ys(t) + '" x2="' + (P.l + iw) + '" y2="' + ys(t) + '"/>'
      + '<text class="tick" x="' + (P.l - 10) + '" y="' + (ys(t) + 4) + '" text-anchor="end">' + esc(yf(t)) + "</text>";
  });
  (spec.x.ticks || []).forEach(function (t) {
    g += '<text class="tick" x="' + xs(t) + '" y="' + (P.t + ih + 24) + '" text-anchor="middle">' + esc(xf(t)) + "</text>";
  });
  g += '<line class="axis" x1="' + P.l + '" y1="' + (P.t + ih) + '" x2="' + (P.l + iw) + '" y2="' + (P.t + ih) + '"/>'
    + '<line class="axis" x1="' + P.l + '" y1="' + P.t + '" x2="' + P.l + '" y2="' + (P.t + ih) + '"/>'
    + (spec.y.label ? '<text class="axlabel" x="' + P.l + '" y="' + (P.t - 12) + '">' + esc(spec.y.label) + "</text>" : "")
    + (spec.x.label ? '<text class="axlabel" x="' + (P.l + iw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(spec.x.label) + "</text>" : "");

  // series — sampled across the full width so kinks land where the maths puts them
  var N = 260;
  spec.series.forEach(function (s) {
    var pts = [], i, x, y;
    for (i = 0; i <= N; i++) {
      x = spec.x.min + (spec.x.max - spec.x.min) * i / N;
      y = Math.max(spec.y.min, Math.min(spec.y.max, s.fn(x)));
      pts.push(xs(x).toFixed(1) + "," + ys(y).toFixed(1));
    }
    if (s.fill) {
      g += '<polygon class="serfill" data-fx="ser-' + s.key + '" fill="' + s.color
        + '" points="' + xs(spec.x.min) + "," + ys(spec.y.min) + " " + pts.join(" ")
        + " " + xs(spec.x.max) + "," + ys(spec.y.min) + '"/>';
    }
    g += '<polyline class="serline" data-fx="ser-' + s.key + '" stroke="' + s.color
      + '" points="' + pts.join(" ") + '"/>';
    if (s.label && s.labelAt != null) {
      g += '<text class="serlabel" data-fx="ser-' + s.key + '" x="' + (xs(s.labelAt) + (s.labelDx || 0))
        + '" y="' + (ys(s.fn(s.labelAt)) + (s.labelDy || -14)) + '" fill="' + s.color
        + '" text-anchor="' + (s.labelAnchor || "middle") + '">' + esc(s.label) + "</text>";
    }
  });

  // the "today" rule, with each series' value called out on it
  if (spec.marker) {
    var mx = xs(spec.marker.x);
    g += '<line class="marker" data-fx="marker" x1="' + mx + '" y1="' + P.t + '" x2="' + mx + '" y2="' + (P.t + ih) + '"/>';
    if (spec.marker.caption)
      g += '<text class="markercap" data-fx="marker" x="' + mx + '" y="' + (P.t - 10) + '" text-anchor="middle">' + esc(spec.marker.caption) + "</text>";
    if (spec.marker.showValues) {
      spec.series.forEach(function (s) {
        var v = s.fn(spec.marker.x);
        if (v < spec.y.min || v > spec.y.max) return;
        g += '<circle class="dot" data-fx="marker" cx="' + mx + '" cy="' + ys(v) + '" r="6" fill="' + s.color + '"/>'
          + '<text class="dotlabel" data-fx="marker" x="' + (mx - 14) + '" y="' + (ys(v) + 5)
          + '" text-anchor="end" fill="' + s.color + '">' + esc((s.short || s.key) + "  " + yf(v)) + "</text>";
      });
    }
  }
  // crossover
  if (spec.cross) {
    var cy = spec.series[0].fn(spec.cross.x);
    g += '<circle class="cross" data-fx="cross" cx="' + xs(spec.cross.x) + '" cy="' + ys(cy) + '" r="7"/>';
    if (spec.cross.caption)
      g += '<text class="crosslabel" data-fx="cross" x="' + (xs(spec.cross.x) - 16) + '" y="' + (ys(cy) - 10)
        + '" text-anchor="end">' + esc(spec.cross.caption) + "</text>";
  }

  host.classList.add("chartdev");
  host.innerHTML =
    '<div class="charthead"><p class="charttitle">' + esc(spec.title || "") + "</p>"
    + (spec.watchBtn ? '<button class="btn" id="' + spec.watchBtn + '">▶ Watch the walkthrough</button>' : "")
    + "</div><div class=\"chartbody\"><svg class=\"chartsvg\" viewBox=\"0 0 " + W + " " + H
    + '" role="img" aria-label="' + esc(spec.title || "chart") + '">' + g + "</svg></div>";

  var svg = host.querySelector("svg");
  var all = function () { return Array.prototype.slice.call(svg.querySelectorAll("[data-fx]")); };
  var pick = function (keys) {
    return all().filter(function (e) {
      return Array.prototype.indexOf.call(keys, e.getAttribute("data-fx")) !== -1;
    });
  };
  return {
    el: svg,
    dimAll: function () { all().forEach(function (e) { e.classList.add("pend"); e.classList.remove("lit"); }); },
    showAll: function () { all().forEach(function (e) { e.classList.remove("pend", "lit"); }); },
    reveal: function () { pick(arguments).forEach(function (e) { e.classList.remove("pend"); }); },
    lit: function () { pick(arguments).forEach(function (e) { e.classList.remove("pend"); e.classList.add("lit"); }); }
  };
}
