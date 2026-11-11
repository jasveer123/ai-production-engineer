(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  var api = (script.getAttribute("data-api") || "").replace(/\/+$/, "");
  if (!key || !api) return;
  var replayOn = script.getAttribute("data-replay") !== "false";
  var maskAll = script.getAttribute("data-mask") === "true";
  var endpoint = api + "/v1/rum/" + key;
  var SESSION_MS = 30 * 60 * 1000;
  var FLUSH_MS = 5000;
  var SNAPSHOT_MS = 10000;
  var MAX_HTML = 1400000;
  var SENSITIVE = /token|key|secret|pass|auth|sig|code|session|jwt|email/i;

  function store(name, value) {
    try {
      if (value === undefined) return window.sessionStorage.getItem(name);
      window.sessionStorage.setItem(name, value);
    } catch (e) {
      return null;
    }
    return value;
  }

  function randomId() {
    var bytes = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < bytes.length; i++) out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
  }

  function sessionId() {
    var now = Date.now();
    var id = store("pramaan_sid");
    var last = Number(store("pramaan_last") || 0);
    if (!id || now - last > SESSION_MS) id = store("pramaan_sid", randomId());
    store("pramaan_last", String(now));
    return id;
  }

  var user = {};
  var events = [];
  var snapshots = [];
  var moves = [];
  var dirty = true;
  var lastMove = 0;
  var vitals = { LCP: null, CLS: 0, INP: null, FCP: null, TTFB: null };

  function push(type, name, extra) {
    var event = { ts: Date.now(), type: type, name: String(name || "").slice(0, 120), url: location.href };
    if (extra) for (var k in extra) event[k] = extra[k];
    events.push(event);
    if (events.length >= 150) flush(false);
  }

  function describe(el) {
    if (!el || !el.tagName) return "";
    var label = el.tagName.toLowerCase();
    if (el.id) label += "#" + el.id;
    var text = (el.getAttribute("aria-label") || (el.tagName === "INPUT" ? "" : el.textContent) || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    return text ? label + " " + text : label;
  }

  function scrub(root) {
    var drop = root.querySelectorAll("script,noscript,iframe,object,embed,link[rel=preload],link[rel=modulepreload]");
    for (var i = 0; i < drop.length; i++) drop[i].remove();
    var inputs = root.querySelectorAll("input,textarea,select");
    for (var j = 0; j < inputs.length; j++) {
      var input = inputs[j];
      input.removeAttribute("value");
      input.removeAttribute("checked");
      if (input.tagName === "TEXTAREA") input.textContent = "";
    }
    var masked = root.querySelectorAll("[data-pramaan-mask]");
    for (var m = 0; m < masked.length; m++) masked[m].textContent = "••••";
    if (maskAll) {
      var walker = document.createTreeWalker(root, 4);
      var node;
      while ((node = walker.nextNode())) {
        var parent = node.parentNode && node.parentNode.nodeName;
        if (parent === "STYLE" || parent === "SCRIPT") continue;
        node.nodeValue = node.nodeValue.replace(/\S/g, "•");
      }
    }
    var all = root.querySelectorAll("*");
    for (var n = 0; n < all.length; n++) {
      var attrs = all[n].attributes;
      for (var a = attrs.length - 1; a >= 0; a--) {
        if (/^on/i.test(attrs[a].name)) all[n].removeAttribute(attrs[a].name);
      }
    }
  }

  function snapshotHtml() {
    var clone = document.documentElement.cloneNode(true);
    scrub(clone);
    var head = clone.querySelector("head");
    if (head) {
      var base = document.createElement("base");
      base.setAttribute("href", location.origin + "/");
      head.insertBefore(base, head.firstChild);
    }
    return "<!doctype html>" + clone.outerHTML;
  }

  function takeSnapshot(force) {
    if (!replayOn || (!dirty && !force)) return;
    var html = snapshotHtml();
    dirty = false;
    if (html.length > MAX_HTML) return;
    snapshots.push({ ts: Date.now(), html: html, url: location.href });
    if (snapshots.length >= 3) flush(false);
  }

  function payload() {
    var body = {
      sessionId: sessionId(),
      url: location.href,
      referrer: document.referrer || undefined,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      events: events.splice(0, 200),
    };
    if (user.id) body.userId = String(user.id);
    if (user.name) body.userName = String(user.name);
    if (user.email) body.userEmail = String(user.email);
    if (replayOn && (snapshots.length || moves.length))
      body.replay = { snapshots: snapshots.splice(0, 5), moves: moves.splice(0, 500) };
    return body;
  }

  function send(body, unloading) {
    var text = JSON.stringify(body);
    if (unloading && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([text], { type: "text/plain" }));
      return;
    }
    var headers = { "content-type": "text/plain" };
    function post(data, extra) {
      var init = { method: "POST", body: data, headers: extra, keepalive: text.length < 60000, mode: "cors" };
      return fetch(endpoint, init).catch(function () {});
    }
    if (typeof CompressionStream === "function" && typeof Response === "function") {
      var stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
      new Response(stream)
        .blob()
        .then(function (blob) {
          return post(blob, { "content-type": "application/octet-stream", "content-encoding": "gzip" });
        })
        .catch(function () {
          return post(text, headers);
        });
    } else {
      post(text, headers);
    }
  }

  function flush(unloading) {
    if (unloading) flushVitals();
    if (!events.length && !snapshots.length && !moves.length) return;
    send(payload(), unloading);
  }

  function flushVitals() {
    var names = ["LCP", "CLS", "INP", "FCP", "TTFB"];
    for (var i = 0; i < names.length; i++) {
      var value = vitals[names[i]];
      if (value !== null && value !== undefined) push("vital", names[i], { value: value });
      vitals[names[i]] = names[i] === "CLS" ? 0 : null;
    }
  }

  function observe(type, handler) {
    try {
      var observer = new PerformanceObserver(function (list) {
        list.getEntries().forEach(handler);
      });
      observer.observe({ type: type, buffered: true });
    } catch (e) {
      return;
    }
  }

  function watchVitals() {
    observe("largest-contentful-paint", function (entry) {
      vitals.LCP = entry.startTime;
    });
    observe("layout-shift", function (entry) {
      if (!entry.hadRecentInput) vitals.CLS += entry.value;
    });
    observe("event", function (entry) {
      if (entry.interactionId && (vitals.INP === null || entry.duration > vitals.INP)) vitals.INP = entry.duration;
    });
    observe("paint", function (entry) {
      if (entry.name === "first-contentful-paint") vitals.FCP = entry.startTime;
    });
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    if (nav) vitals.TTFB = nav.responseStart;
  }

  function pageview() {
    push("pageview", document.title || "");
    dirty = true;
    window.setTimeout(function () {
      takeSnapshot(true);
    }, 600);
  }

  function watchNavigation() {
    ["pushState", "replaceState"].forEach(function (method) {
      var original = history[method];
      history[method] = function () {
        var result = original.apply(this, arguments);
        pageview();
        return result;
      };
    });
    window.addEventListener("popstate", pageview);
  }

  function watchErrors() {
    window.addEventListener("error", function (event) {
      push("error", event.message || "Script error", {
        props: {
          source: String(event.filename || "").slice(0, 300),
          line: event.lineno || 0,
          stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 600) : "",
        },
      });
    });
    window.addEventListener("unhandledrejection", function (event) {
      var reason = event.reason;
      push("error", reason && reason.message ? reason.message : String(reason), {
        props: { stack: reason && reason.stack ? String(reason.stack).slice(0, 600) : "" },
      });
    });
  }

  function watchInteraction() {
    document.addEventListener(
      "click",
      function (event) {
        var target = event.target;
        push("click", describe(target && target.closest ? target.closest("a,button,[role=button],input,select") || target : target), {
          props: { x: Math.round(event.pageX), y: Math.round(event.pageY) },
        });
        if (replayOn) moves.push({ ts: Date.now(), t: "c", x: Math.round(event.pageX), y: Math.round(event.pageY) });
      },
      true
    );
    if (!replayOn) return;
    document.addEventListener(
      "mousemove",
      function (event) {
        var now = Date.now();
        if (now - lastMove < 120) return;
        lastMove = now;
        moves.push({ ts: now, t: "m", x: Math.round(event.pageX), y: Math.round(event.pageY) });
      },
      true
    );
    document.addEventListener(
      "scroll",
      function () {
        var now = Date.now();
        if (now - lastMove < 120) return;
        lastMove = now;
        moves.push({ ts: now, t: "s", x: Math.round(window.scrollX), y: Math.round(window.scrollY) });
      },
      true
    );
    new MutationObserver(function () {
      dirty = true;
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  function start() {
    watchVitals();
    watchNavigation();
    watchErrors();
    watchInteraction();
    pageview();
    window.setInterval(function () {
      flush(false);
    }, FLUSH_MS);
    window.setInterval(function () {
      takeSnapshot(false);
    }, SNAPSHOT_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        takeSnapshot(false);
        flush(true);
      }
    });
    window.addEventListener("pagehide", function () {
      flush(true);
    });
  }

  window.pramaan = {
    identify: function (info) {
      user = info || {};
    },
    track: function (name, props) {
      var clean = {};
      for (var k in props || {}) {
        var v = props[k];
        if (SENSITIVE.test(k)) continue;
        if (v === null || ["string", "number", "boolean"].indexOf(typeof v) >= 0) clean[k] = v;
      }
      push("custom", name, { props: clean });
    },
    flush: function () {
      flush(false);
    },
    _snapshot: snapshotHtml,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
