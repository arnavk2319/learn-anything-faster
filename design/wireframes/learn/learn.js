/* global document */
/* Wireframe-only interactions: tabs, toggles, filters, favorites, question check. No persistence (the app uses localStorage laf:learn:v1). */
(function () {
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  // Favorite stars
  $$(".star").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
      applyFilter();
    });
  });

  // Tabs (the app uses real links: /learn/x, /problems, /questions)
  $$("[role=tablist]").forEach(function (list) {
    var tabs = $$("[role=tab]", list);
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        select(t);
      });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!n) return;
        var next = tabs[(i + n + tabs.length) % tabs.length];
        select(next);
        next.focus();
      });
    });
  });

  // Landing: view toggle, chips, search
  var root = document.querySelector("[data-view]");
  var filter = "all";
  function applyFilter() {
    if (!root) return;
    var q = ((document.getElementById("q") || {}).value || "").toLowerCase();
    var shown = 0;
    $$("[data-status]").forEach(function (el) {
      var fav = el.querySelector(".star[aria-pressed=true]") !== null;
      var ok =
        filter === "all" ||
        (filter === "live" && el.dataset.status === "live") ||
        (filter === "soon" && el.dataset.status === "soon") ||
        (filter === "favorites" && fav) ||
        (filter === "progress" && Number(el.dataset.progress || 0) > 0);
      if (q && el.textContent.toLowerCase().indexOf(q) < 0) ok = false;
      el.style.display = ok ? "" : "none";
      if (ok && el.tagName === "LI") shown++;
    });
    var empty = document.getElementById("empty");
    if (empty) empty.style.display = shown ? "none" : "block";
  }
  $$("[data-view-btn]").forEach(function (b) {
    b.addEventListener("click", function () {
      root.dataset.view = b.dataset.viewBtn;
      $$("[data-view-btn]").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
    });
  });
  $$("[data-filter]").forEach(function (c) {
    c.addEventListener("click", function () {
      filter = c.dataset.filter;
      $$("[data-filter]").forEach(function (x) {
        x.setAttribute("aria-pressed", x === c ? "true" : "false");
      });
      applyFilter();
    });
  });
  var q = document.getElementById("q");
  if (q) q.addEventListener("input", applyFilter);

  // Question cards: mcq Check, short-explain reveal and self-grade
  $$("[data-check]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest("[data-q]");
      var picked = card.querySelector("input:checked");
      var ex = card.querySelector(".explain");
      if (!picked) {
        ex.textContent = "Pick an answer first.";
        ex.className = "explain open bad";
        return;
      }
      $$(".opt", card).forEach(function (o) {
        o.classList.remove("right", "wrong");
      });
      var ok = picked.value === card.dataset.answer;
      picked.closest(".opt").classList.add(ok ? "right" : "wrong");
      if (!ok)
        card
          .querySelector("input[value=" + card.dataset.answer + "]")
          .closest(".opt")
          .classList.add("right");
      ex.innerHTML = (ok ? "<b>Correct.</b> " : "<b>Not quite.</b> ") + ex.dataset.text;
      ex.className = "explain open" + (ok ? "" : " bad");
    });
  });
  $$("[data-reveal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest("[data-q]");
      card.querySelector(".explain").classList.add("open");
      card.querySelector(".grade").hidden = false;
      btn.hidden = true;
    });
  });
  $$("[data-grade]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wrap = btn.closest(".grade");
      wrap.innerHTML =
        '<span class="small" role="status">' +
        (btn.dataset.grade === "yes"
          ? "Marked: I got it."
          : "Marked: not yet. It will show under Wrong.") +
        "</span>";
    });
  });
})();
