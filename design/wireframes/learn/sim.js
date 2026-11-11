/* global document, window, requestAnimationFrame */
/*
  Wireframe sim engine: LRU cache read path. Mirrors the ADR-0015 model: frame = f(scenario, t), no randomness.
  Tokens, edge highlight, node pulses, LRU slots and the caption are all derived from t, so scrubbing and stepping are exact.
*/
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var root = document.getElementById("sim");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) root.classList.add("reduced");

  var INIT = ["b", "c", "a"]; // most recent first
  var SCENARIOS = {
    hit: {
      title: "Cache hit",
      duration: 5600,
      events: [
        { at: 0, rest: 1100, caption: "The app asks the cache for key c." },
        { at: 300, send: "e1", dur: 800, color: "request", label: "GET c" },
        { at: 1300, rest: 2000, caption: "The cache looks c up." },
        { at: 1300, send: "e2", dur: 700, color: "request", label: "lookup" },
        { at: 2100, rest: 2300, caption: "Hit: c is in the cache.", decide: "yes" },
        {
          at: 2300,
          rest: 2600,
          caption: "c moves to the most recent slot. The database is never touched.",
          touch: "c",
        },
        {
          at: 2700,
          rest: 4200,
          caption: "The value returns to the app.",
          send: "e4",
          dur: 1300,
          color: "response",
          label: "value c",
        },
      ],
    },
    miss: {
      title: "Miss and eviction",
      duration: 7600,
      events: [
        { at: 0, rest: 1100, caption: "The app asks the cache for key d." },
        { at: 300, send: "e1", dur: 800, color: "request", label: "GET d" },
        { at: 1300, rest: 2000, caption: "The cache looks d up." },
        { at: 1300, send: "e2", dur: 700, color: "request", label: "lookup" },
        { at: 2100, rest: 2300, caption: "Miss: d is not in the cache.", decide: "no" },
        {
          at: 2400,
          rest: 3500,
          caption: "The app falls back to the database.",
          send: "e3",
          dur: 1200,
          color: "request",
          label: "GET d",
        },
        {
          at: 3700,
          rest: 4800,
          caption: "The database value is written back into the cache.",
          send: "e5",
          dur: 1200,
          color: "replicate",
          label: "fill d",
        },
        {
          at: 4700,
          rest: 5000,
          caption:
            "The cache is full: a, the least recently used key, is evicted and d takes the front slot.",
          mark: "a",
        },
        { at: 4900, put: "d" },
        {
          at: 5400,
          rest: 6700,
          caption: "The value returns to the app.",
          send: "e4",
          dur: 1300,
          color: "response",
          label: "value d",
        },
      ],
    },
    error: {
      title: "Database timeout",
      duration: 6600,
      events: [
        { at: 0, rest: 1100, caption: "The app asks the cache for key d." },
        { at: 300, send: "e1", dur: 800, color: "request", label: "GET d" },
        { at: 1300, rest: 2000, caption: "The cache looks d up." },
        { at: 1300, send: "e2", dur: 700, color: "request", label: "lookup" },
        { at: 2100, rest: 2300, caption: "Miss: d is not in the cache.", decide: "no" },
        {
          at: 2400,
          rest: 3500,
          caption: "The app falls back to the database.",
          send: "e3",
          dur: 1200,
          color: "request",
          label: "GET d",
        },
        {
          at: 3800,
          rest: 4100,
          caption: "The database does not answer in time. Nothing is cached.",
        },
        {
          at: 4200,
          rest: 5600,
          caption: "The app receives an error. The cache keeps b, c and a.",
          send: "e4",
          dur: 1300,
          color: "error",
          label: "! 503",
        },
      ],
    },
  };
  var NODE_INFO = {
    app: {
      title: "App",
      kind: "app",
      text: "Asks the cache first and only goes to the database on a miss (cache-aside).",
      state: false,
    },
    cache: {
      title: "LRU cache (3)",
      kind: "cache",
      text: "Holds hot keys in recency order and evicts the least recently used one when full.",
      state: true,
    },
    hit: {
      title: "Hit?",
      kind: "decision",
      text: "Is the key in the cache? Scripted per scenario, not random.",
      state: false,
    },
    db: {
      title: "Database",
      kind: "db",
      text: "Source of truth. Slow path, so every hit saves a round trip here.",
      state: false,
    },
  };
  var NODE_ID = { app: "app", cache: "cache", hit: "hit", db: "db" };

  var $ = function (s) {
    return root.querySelector(s);
  };
  var tokensG = $("#tokens");
  var cap = $("#caption");
  var stepLbl = $("#stepLbl");
  var playBtn = $("#play");
  var decideTxt = $("#decideResult");
  var slotEls = {};
  ["a", "b", "c", "d"].forEach(function (k) {
    slotEls[k] = $('[data-slot="' + k + '"]');
  });

  var st = { id: "hit", t: 0, playing: !reduced, speed: 1, last: 0 };
  var inspNode = null;

  function sc() {
    return SCENARIOS[st.id];
  }
  function steps() {
    return sc().events.filter(function (e) {
      return e.caption;
    });
  }
  function lru(t) {
    var order = INIT.slice();
    var f = { touched: null, fresh: null, marked: null };
    sc().events.forEach(function (e) {
      if (e.at > t) return;
      if (e.mark) f.marked = e.mark;
      if (e.touch) {
        order = [e.touch].concat(
          order.filter(function (k) {
            return k !== e.touch;
          }),
        );
        f.touched = e.touch;
      }
      if (e.put) {
        var gone = order.pop();
        order.unshift(e.put);
        f.fresh = e.put;
        if (f.marked === gone) f.marked = null;
        f.gone = gone;
      }
    });
    return { order: order, f: f };
  }
  function tokenEl(label, color) {
    var w = label.length * 7 + 20;
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "tok " + color);
    var r = document.createElementNS(NS, "rect");
    r.setAttribute("x", -w / 2);
    r.setAttribute("y", -12);
    r.setAttribute("width", w);
    r.setAttribute("height", 24);
    r.setAttribute("rx", 12);
    var tx = document.createElementNS(NS, "text");
    tx.setAttribute("y", 4);
    tx.textContent = label;
    g.appendChild(r);
    g.appendChild(tx);
    return g;
  }

  function render() {
    var t = st.t;
    var ev = sc().events;
    // edges and tokens
    root.querySelectorAll(".edge").forEach(function (e) {
      e.setAttribute("class", "edge");
    });
    tokensG.textContent = "";
    ev.forEach(function (e) {
      if (!e.send) return;
      var path = root.querySelector("#" + e.send);
      var p = (t - e.at) / e.dur;
      if (p < 0 || p > 1) return;
      path.setAttribute("class", "edge hot " + e.color);
      var pt = path.getPointAtLength(path.getTotalLength() * p);
      var g = tokenEl(e.label, e.color);
      g.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
      tokensG.appendChild(g);
    });
    // decision result
    var d = null;
    ev.forEach(function (e) {
      if (e.decide && e.at <= t) d = e.decide;
    });
    decideTxt.textContent = d ? (d === "yes" ? "yes: hit" : "no: miss") : "";
    // node pulses
    root.querySelectorAll(".node").forEach(function (n) {
      n.classList.remove("pulse");
    });
    ev.forEach(function (e) {
      var target = e.decide ? "hit" : e.touch || e.put ? "cache" : null;
      if (target && t >= e.at && t < e.at + 600)
        root.querySelector('[data-node="' + target + '"]').classList.add("pulse");
    });
    // LRU slots
    var s = lru(t);
    Object.keys(slotEls).forEach(function (k) {
      var i = s.order.indexOf(k);
      var el = slotEls[k];
      el.style.opacity = i < 0 ? 0 : 1;
      el.style.transform = "translate(" + (i < 0 ? 0 : i * 60) + "px, 0)";
      el.setAttribute(
        "class",
        "slot" +
          (s.f.touched === k ? " touched" : "") +
          (s.f.fresh === k ? " new" : "") +
          (s.f.marked === k && s.order.indexOf(k) >= 0 ? " evicting" : ""),
      );
    });
    // caption and step
    var list = steps();
    var idx = -1;
    list.forEach(function (e, i) {
      if (e.at <= t) idx = i;
    });
    cap.textContent = idx < 0 ? list[0].caption : list[idx].caption;
    stepLbl.textContent = "Step " + (Math.max(idx, 0) + 1) + " of " + list.length;
    playBtn.querySelector(".lbl").textContent = st.playing ? "Pause" : "Play";
    playBtn.querySelector(".ic").textContent = st.playing ? "⏸" : "▶";
    playBtn.setAttribute("aria-pressed", st.playing ? "true" : "false");
    if (inspNode === "cache") fillInspector();
  }

  // One rAF loop; advances only while playing and on screen
  var visible = true;
  if ("IntersectionObserver" in window) {
    new window.IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
    }).observe(root);
  }
  function frame(now) {
    if (st.playing && visible && st.last) {
      st.t += (now - st.last) * st.speed;
      if (st.t >= sc().duration) st.t = 0; // loop: true
      render();
    }
    st.last = now;
    requestAnimationFrame(frame);
  }

  function step(dir) {
    st.playing = false;
    var list = steps();
    var rests = list.map(function (e) {
      return e.rest;
    });
    var i = -1;
    rests.forEach(function (r, k) {
      if (st.t >= r) i = k;
    });
    var n = Math.min(Math.max(i + dir, 0), list.length - 1);
    st.t = rests[n];
    render();
  }
  function setScenario(id) {
    st.id = id;
    st.t = 0;
    st.playing = !reduced;
    render();
  }
  function toggle() {
    st.playing = !st.playing;
    render();
  }
  function restart() {
    st.t = 0;
    st.playing = !reduced;
    render();
  }

  // Controls
  $("#play").addEventListener("click", toggle);
  $("#restart").addEventListener("click", restart);
  $("#back").addEventListener("click", function () {
    step(-1);
  });
  $("#fwd").addEventListener("click", function () {
    step(1);
  });
  $("#scenario").addEventListener("change", function (e) {
    setScenario(e.target.value);
  });
  root.querySelectorAll("[data-speed]").forEach(function (b) {
    b.addEventListener("click", function () {
      st.speed = Number(b.dataset.speed);
      root.querySelectorAll("[data-speed]").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
    });
  });

  // Inspector
  var insp = $("#inspector");
  var scrim = $("#scrim");
  var opener = null;
  function fillInspector() {
    var info = NODE_INFO[inspNode];
    $("#inspTitle").textContent = info.title;
    $("#inspKind").textContent = info.kind;
    $("#inspText").textContent = info.text;
    var dl = $("#inspState");
    dl.textContent = "";
    if (info.state) {
      var o = lru(st.t).order;
      [
        ["Capacity", "3"],
        ["Most recent first", o.join(", ")],
        ["Next to evict", o[o.length - 1]],
      ].forEach(function (r) {
        var dt = document.createElement("dt");
        dt.textContent = r[0];
        var dd = document.createElement("dd");
        dd.textContent = r[1];
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
    }
  }
  function openInspector(node, el) {
    inspNode = node;
    opener = el;
    root.querySelectorAll(".node").forEach(function (n) {
      n.classList.toggle("selected", n === el);
    });
    fillInspector();
    insp.dataset.open = "true";
    scrim.dataset.open = "true";
    root.classList.add("has-inspector");
    $("#inspClose").focus();
  }
  function closeInspector() {
    if (insp.dataset.open !== "true") return;
    insp.dataset.open = "false";
    scrim.dataset.open = "false";
    root.classList.remove("has-inspector");
    root.querySelectorAll(".node").forEach(function (n) {
      n.classList.remove("selected");
    });
    inspNode = null;
    if (opener) opener.focus();
  }
  root.querySelectorAll(".node").forEach(function (n) {
    n.addEventListener("click", function () {
      openInspector(NODE_ID[n.dataset.node], n);
    });
  });
  $("#inspClose").addEventListener("click", closeInspector);
  scrim.addEventListener("click", closeInspector);

  // Keyboard: Space play/pause, arrows step, R restart, Esc closes inspector, Enter opens a focused node
  root.addEventListener("keydown", function (e) {
    var tag = e.target.tagName;
    var onNode = e.target.classList && e.target.classList.contains("node");
    if (e.key === "Escape") return closeInspector();
    if (onNode && e.key === "Enter") {
      e.preventDefault();
      return openInspector(NODE_ID[e.target.dataset.node], e.target);
    }
    if (tag === "BUTTON" || tag === "SELECT" || tag === "INPUT") return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "r" || e.key === "R") {
      restart();
    }
  });

  render();
  requestAnimationFrame(frame);
})();
