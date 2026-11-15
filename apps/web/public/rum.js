;(function () {
  var script = document.currentScript
  if (!script) return
  var key = script.getAttribute("data-key")
  var api = (script.getAttribute("data-api") || "").replace(/\/+$/, "")
  if (!key || !api) return
  var VERSION = "2.0.0"
  var endpoint = api + "/v1/rum/" + key
  var forceMask = script.getAttribute("data-mask") === "true"
  var replayOptOut = script.getAttribute("data-replay") === "false"
  var spoolOn = script.getAttribute("data-spool") !== "false"
  var SESSION_MS = 30 * 60 * 1000
  var FLUSH_MS = 5000
  var SNAPSHOT_MS = 10000
  var MAX_HTML = 1400000
  var MAX_BUFFER = 1000
  var MAX_QUEUE = 40
  var MAX_ATTEMPTS = 8
  var SPOOL_KEY = "pramaan_spool_" + key
  var SPOOL_MAX = 20
  var SPOOL_TTL = 24 * 3600 * 1000
  var SPOOL_CHARS = 400000
  var BEACON_CHARS = 60000
  var SENSITIVE = /token|key|secret|pass|auth|sig|code|session|jwt|email/i
  var URL_ATTRS = ["href", "src", "action", "poster", "srcset", "data-src"]
  var TEXT_ATTRS = ["title", "alt", "placeholder", "aria-label"]

  var config = { replayEnabled: false, replaySampleRate: 0, maskAllText: true, blockSelectors: [] }
  var replayOn = false
  var stopped = false
  var user = {}
  var events = []
  var snapshots = []
  var moves = []
  var queue = []
  var dropped = 0
  var inflight = false
  var timer = null
  var dirty = true
  var lastMove = 0
  var vitals = { LCP: null, CLS: 0, INP: null, FCP: null, TTFB: null }
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null
  var markReady
  var ready = new Promise(function (resolve) {
    markReady = resolve
  })

  function store(area, name, value) {
    try {
      var s = window[area]
      if (value === undefined) return s.getItem(name)
      if (value === null) s.removeItem(name)
      else s.setItem(name, value)
    } catch (e) {
      return null
    }
    return value
  }

  function randomId(n) {
    var bytes = new Uint8Array(n || 12)
    ;(window.crypto || window.msCrypto).getRandomValues(bytes)
    var out = ""
    for (var i = 0; i < bytes.length; i++) out += ("0" + bytes[i].toString(16)).slice(-2)
    return out
  }

  function sessionId() {
    var now = Date.now()
    var id = store("sessionStorage", "pramaan_sid")
    var last = Number(store("sessionStorage", "pramaan_last") || 0)
    if (!id || now - last > SESSION_MS) {
      id = store("sessionStorage", "pramaan_sid", randomId())
      store("sessionStorage", "pramaan_seq", "0")
      linkSentry(id)
    }
    store("sessionStorage", "pramaan_last", String(now))
    return id
  }

  function nextSequence() {
    var n = Number(store("sessionStorage", "pramaan_seq") || 0) + 1
    store("sessionStorage", "pramaan_seq", String(n))
    return n
  }

  function sampled(id, rate) {
    if (rate >= 1) return true
    if (rate <= 0) return false
    var hash = 0x811c9dc5
    for (var i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return (hash % 10000) / 10000 < rate
  }

  function linkSentry(id) {
    try {
      if (window.Sentry && typeof window.Sentry.setTag === "function")
        window.Sentry.setTag("pramaan_session", id)
    } catch (e) {
      return
    }
  }

  function scrubUrl(raw) {
    try {
      var u = new URL(raw, location.href)
      u.searchParams.forEach(function (_v, name) {
        if (SENSITIVE.test(name)) u.searchParams.set(name, "REDACTED")
      })
      u.hash = ""
      return u.toString()
    } catch (e) {
      return ""
    }
  }

  function push(type, name, extra) {
    if (stopped) return
    if (events.length >= MAX_BUFFER) {
      dropped++
      return
    }
    var event = {
      id: randomId(8),
      ts: Date.now(),
      type: type,
      name: String(name || "").slice(0, 120),
      url: scrubUrl(location.href),
    }
    if (extra) for (var k in extra) event[k] = extra[k]
    events.push(event)
    if (events.length >= 150) flush(false)
  }

  function describe(el) {
    if (!el || !el.tagName) return ""
    var label = el.tagName.toLowerCase()
    if (el.id) label += "#" + el.id
    if (config.maskAllText || forceMask) return label
    var text = (
      el.getAttribute("aria-label") ||
      (el.tagName === "INPUT" ? "" : el.textContent) ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40)
    return text ? label + " " + text : label
  }

  function scrub(root) {
    var maskAll = config.maskAllText || forceMask
    var drop = root.querySelectorAll(
      "script,noscript,iframe,object,embed,link[rel=preload],link[rel=modulepreload]"
    )
    for (var i = 0; i < drop.length; i++) drop[i].remove()
    ;(config.blockSelectors || []).forEach(function (selector) {
      try {
        var blocked = root.querySelectorAll(selector)
        for (var b = 0; b < blocked.length; b++) {
          var box = document.createElement("div")
          box.setAttribute("data-pramaan-blocked", "")
          blocked[b].replaceWith(box)
        }
      } catch (e) {
        return
      }
    })
    var inputs = root.querySelectorAll("input,textarea,select,option")
    for (var j = 0; j < inputs.length; j++) {
      ;["value", "checked", "selected"].forEach(function (a) {
        inputs[j].removeAttribute(a)
      })
      if (inputs[j].tagName === "TEXTAREA") inputs[j].textContent = ""
      if (inputs[j].tagName === "OPTION" && maskAll) inputs[j].textContent = "•••"
    }
    var masked = root.querySelectorAll("[data-pramaan-mask]")
    for (var m = 0; m < masked.length; m++) masked[m].textContent = "••••"
    if (maskAll) {
      var walker = document.createTreeWalker(root, 4)
      var node
      while ((node = walker.nextNode())) {
        var parent = node.parentNode && node.parentNode.nodeName
        if (parent === "STYLE") continue
        node.nodeValue = node.nodeValue.replace(/\S/g, "•")
      }
    }
    var all = root.querySelectorAll("*")
    for (var n = 0; n < all.length; n++) {
      var attrs = all[n].attributes
      for (var a = attrs.length - 1; a >= 0; a--) {
        var name = attrs[a].name.toLowerCase()
        if (/^on/.test(name)) all[n].removeAttribute(attrs[a].name)
        else if (URL_ATTRS.indexOf(name) >= 0 && name !== "srcset")
          all[n].setAttribute(attrs[a].name, scrubUrl(attrs[a].value))
        else if (name === "srcset") all[n].removeAttribute(attrs[a].name)
        else if (maskAll && TEXT_ATTRS.indexOf(name) >= 0)
          all[n].setAttribute(attrs[a].name, attrs[a].value.replace(/\S/g, "•"))
      }
    }
  }

  function snapshotHtml() {
    var clone = document.documentElement.cloneNode(true)
    scrub(clone)
    var head = clone.querySelector("head")
    if (head) {
      var base = document.createElement("base")
      base.setAttribute("href", location.origin + "/")
      head.insertBefore(base, head.firstChild)
    }
    return "<!doctype html>" + clone.outerHTML
  }

  function takeSnapshot(force) {
    if (!replayOn || stopped || (!dirty && !force)) return
    var html = snapshotHtml()
    dirty = false
    if (html.length > MAX_HTML) return
    snapshots.push({ ts: Date.now(), html: html, url: scrubUrl(location.href) })
    if (snapshots.length >= 3) flush(false)
  }

  function batch() {
    var body = {
      sessionId: sessionId(),
      batchId: randomId(),
      sequence: nextSequence(),
      sdkVersion: VERSION,
      url: scrubUrl(location.href),
      referrer: document.referrer ? scrubUrl(document.referrer) : undefined,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      events: events.splice(0, 200),
    }
    if (dropped) {
      body.dropped = dropped
      dropped = 0
    }
    if (user.id) body.userId = String(user.id)
    if (user.name) body.userName = String(user.name)
    if (user.email) body.userEmail = String(user.email)
    if (replayOn && (snapshots.length || moves.length))
      body.replay = { snapshots: snapshots.splice(0, 5), moves: moves.splice(0, 500) }
    return body
  }

  function enqueue() {
    while (events.length || snapshots.length || moves.length) {
      if (queue.length >= MAX_QUEUE) dropped += queue.shift().body.events.length
      queue.push({ body: batch(), attempts: 0, nextAt: 0 })
    }
  }

  function saveSpool() {
    if (!spoolOn || stopped) return
    var items = queue.slice(-SPOOL_MAX).map(function (q) {
      return { body: q.body, savedAt: q.savedAt || (q.savedAt = Date.now()) }
    })
    var text = JSON.stringify(items)
    if (text.length > SPOOL_CHARS) {
      text = JSON.stringify(
        items.map(function (i) {
          var copy = {}
          for (var k in i.body) if (k !== "replay") copy[k] = i.body[k]
          return { body: copy, savedAt: i.savedAt }
        })
      )
    }
    store("localStorage", SPOOL_KEY, text.length > SPOOL_CHARS ? null : items.length ? text : null)
  }

  function loadSpool() {
    if (!spoolOn) return
    var raw = store("localStorage", SPOOL_KEY)
    store("localStorage", SPOOL_KEY, null)
    if (!raw) return
    try {
      JSON.parse(raw).forEach(function (i) {
        if (i && i.body && Date.now() - i.savedAt < SPOOL_TTL)
          queue.push({ body: i.body, attempts: 0, nextAt: 0, savedAt: i.savedAt })
      })
    } catch (e) {
      return
    }
  }

  function post(body) {
    var text = JSON.stringify(body)
    function attempt(data, headers) {
      return nativeFetch(endpoint, {
        method: "POST",
        body: data,
        headers: headers,
        keepalive: text.length < BEACON_CHARS,
        mode: "cors",
      }).then(
        function (res) {
          return {
            ok: res.ok,
            status: res.status || 0,
            retryAfter: Number(
              (res.headers && res.headers.get && res.headers.get("retry-after")) || 0
            ),
          }
        },
        function () {
          return { ok: false, status: 0, retryAfter: 0 }
        }
      )
    }
    if (typeof CompressionStream === "function" && typeof Response === "function") {
      var stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))
      return new Response(stream)
        .blob()
        .then(function (blob) {
          return attempt(blob, {
            "content-type": "application/octet-stream",
            "content-encoding": "gzip",
          })
        })
        .catch(function () {
          return attempt(text, { "content-type": "text/plain" })
        })
    }
    return attempt(text, { "content-type": "text/plain" })
  }

  function schedule(ms) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(function () {
      timer = null
      pump()
    }, ms)
  }

  function pump() {
    if (inflight || !queue.length || !nativeFetch || stopped) return
    var item = queue[0]
    var wait = item.nextAt - Date.now()
    if (wait > 0) return schedule(wait)
    inflight = true
    post(item.body).then(function (result) {
      inflight = false
      var permanent =
        result.status >= 400 &&
        result.status < 500 &&
        result.status !== 408 &&
        result.status !== 429
      if (result.ok || permanent) {
        if (permanent) dropped += item.body.events.length
        queue.shift()
      } else if (++item.attempts >= MAX_ATTEMPTS) {
        dropped += item.body.events.length
        queue.shift()
      } else {
        var backoff = Math.min(60000, 1000 * Math.pow(2, item.attempts)) * (0.5 + Math.random() / 2)
        item.nextAt = Date.now() + Math.max(backoff, result.retryAfter * 1000)
      }
      saveSpool()
      if (queue.length) pump()
    })
  }

  function flush(unloading) {
    if (stopped) return
    if (unloading) flushVitals()
    enqueue()
    if (!unloading) {
      saveSpool()
      return pump()
    }
    var rest = []
    queue.forEach(function (item) {
      var text = JSON.stringify(item.body)
      var sent = false
      try {
        sent =
          text.length < BEACON_CHARS &&
          navigator.sendBeacon &&
          navigator.sendBeacon(endpoint, new Blob([text], { type: "text/plain" }))
      } catch (e) {
        sent = false
      }
      if (!sent) rest.push(item)
    })
    queue = rest
    saveSpool()
  }

  function flushVitals() {
    ;["LCP", "CLS", "INP", "FCP", "TTFB"].forEach(function (name) {
      var value = vitals[name]
      if (value !== null && value !== undefined) push("vital", name, { value: value })
      vitals[name] = name === "CLS" ? 0 : null
    })
  }

  function observe(type, handler) {
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(handler)
      }).observe({ type: type, buffered: true })
    } catch (e) {
      return
    }
  }

  function watchVitals() {
    observe("largest-contentful-paint", function (e) {
      vitals.LCP = e.startTime
    })
    observe("layout-shift", function (e) {
      if (!e.hadRecentInput) vitals.CLS += e.value
    })
    observe("event", function (e) {
      if (e.interactionId && (vitals.INP === null || e.duration > vitals.INP))
        vitals.INP = e.duration
    })
    observe("paint", function (e) {
      if (e.name === "first-contentful-paint") vitals.FCP = e.startTime
    })
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0]
    if (nav) vitals.TTFB = nav.responseStart
  }

  function pageview() {
    push("pageview", config.maskAllText || forceMask ? "" : document.title || "")
    dirty = true
    setTimeout(function () {
      takeSnapshot(true)
    }, 600)
  }

  function watchNavigation() {
    ;["pushState", "replaceState"].forEach(function (method) {
      var original = history[method]
      history[method] = function () {
        var before = location.pathname + location.search
        var result = original.apply(this, arguments)
        if (location.pathname + location.search !== before) pageview()
        return result
      }
    })
    window.addEventListener("popstate", pageview)
  }

  function watchErrors() {
    window.addEventListener("error", function (event) {
      if (!event.message && event.target && event.target !== window) return
      push("error", event.message || "Script error", {
        props: {
          source: scrubUrl(String(event.filename || "")).slice(0, 300),
          line: event.lineno || 0,
          stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 600) : "",
        },
      })
    })
    window.addEventListener("unhandledrejection", function (event) {
      var r = event.reason
      push("error", r && r.message ? r.message : String(r), {
        props: { stack: r && r.stack ? String(r.stack).slice(0, 600) : "" },
      })
    })
  }

  function network(method, url, status, started) {
    var target = scrubUrl(url)
    if (!target || target.indexOf(api + "/v1/rum") === 0) return
    if (status > 0 && status < 400) return
    push("network", (method || "GET").toUpperCase() + " " + target.split("?")[0].slice(0, 100), {
      props: { status: status, duration: Math.round(Date.now() - started) },
    })
  }

  function watchNetwork() {
    if (nativeFetch) {
      window.fetch = function (input, init) {
        var started = Date.now()
        var url = typeof input === "string" ? input : input && input.url
        var method = (init && init.method) || (input && input.method) || "GET"
        return nativeFetch(input, init).then(
          function (res) {
            network(method, url, res.status, started)
            return res
          },
          function (err) {
            network(method, url, 0, started)
            throw err
          }
        )
      }
    }
    var Xhr = window.XMLHttpRequest
    if (!Xhr) return
    var open = Xhr.prototype.open
    var send = Xhr.prototype.send
    Xhr.prototype.open = function (method, url) {
      this._pramaan = { method: method, url: String(url) }
      return open.apply(this, arguments)
    }
    Xhr.prototype.send = function () {
      var meta = this._pramaan
      if (meta) {
        var started = Date.now()
        this.addEventListener("loadend", function () {
          network(meta.method, meta.url, this.status, started)
        })
      }
      return send.apply(this, arguments)
    }
  }

  function watchConsole() {
    ;["error", "warn"].forEach(function (level) {
      var original = console[level]
      if (typeof original !== "function") return
      console[level] = function () {
        try {
          var text = Array.prototype.map
            .call(arguments, function (a) {
              return a && a.message ? a.message : typeof a === "string" ? a : "[object]"
            })
            .join(" ")
          push("console", text, { props: { level: level } })
        } catch (e) {
          return original.apply(console, arguments)
        }
        return original.apply(console, arguments)
      }
    })
  }

  function watchInteraction() {
    document.addEventListener(
      "click",
      function (event) {
        var target = event.target
        push(
          "click",
          describe(
            target && target.closest
              ? target.closest("a,button,[role=button],input,select") || target
              : target
          ),
          {
            props: { x: Math.round(event.pageX), y: Math.round(event.pageY) },
          }
        )
        if (replayOn)
          moves.push({
            ts: Date.now(),
            t: "c",
            x: Math.round(event.pageX),
            y: Math.round(event.pageY),
          })
      },
      true
    )
    function track(type, x, y) {
      var now = Date.now()
      if (!replayOn || now - lastMove < 120) return
      lastMove = now
      moves.push({ ts: now, t: type, x: Math.round(x), y: Math.round(y) })
    }
    document.addEventListener(
      "mousemove",
      function (e) {
        track("m", e.pageX, e.pageY)
      },
      true
    )
    document.addEventListener(
      "scroll",
      function () {
        track("s", window.scrollX, window.scrollY)
      },
      true
    )
    new MutationObserver(function () {
      dirty = true
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })
  }

  function loadConfig() {
    if (!nativeFetch) return markReady()
    nativeFetch(endpoint + "/config", { method: "GET", mode: "cors" })
      .then(function (res) {
        return res.ok && res.json ? res.json() : null
      })
      .then(function (remote) {
        if (remote) config = remote
        replayOn =
          !replayOptOut && config.replayEnabled && sampled(sessionId(), config.replaySampleRate)
        if (replayOn) takeSnapshot(true)
      })
      .catch(function () {
        return
      })
      .then(markReady)
  }

  function start() {
    linkSentry(sessionId())
    loadSpool()
    watchVitals()
    watchNavigation()
    watchErrors()
    watchNetwork()
    watchConsole()
    watchInteraction()
    pageview()
    loadConfig()
    pump()
    setInterval(function () {
      flush(false)
    }, FLUSH_MS)
    setInterval(function () {
      takeSnapshot(false)
    }, SNAPSHOT_MS)
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        takeSnapshot(false)
        flush(true)
      }
    })
    window.addEventListener("pagehide", function () {
      flush(true)
    })
    window.addEventListener("online", pump)
  }

  window.pramaan = {
    identify: function (info) {
      user = info || {}
    },
    track: function (name, props) {
      var clean = {}
      for (var k in props || {}) {
        var v = props[k]
        if (SENSITIVE.test(k)) continue
        if (v === null || ["string", "number", "boolean"].indexOf(typeof v) >= 0)
          clean[k] = typeof v === "string" ? v.slice(0, 300) : v
      }
      push("custom", name, { props: clean })
    },
    flush: function () {
      flush(false)
    },
    optOut: function () {
      stopped = true
      queue = []
      events = []
      snapshots = []
      moves = []
      store("localStorage", SPOOL_KEY, null)
    },
    ready: ready,
    _snapshot: snapshotHtml,
    _state: function () {
      return { queue: queue.length, dropped: dropped, replayOn: replayOn, config: config }
    },
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start)
  else start()
})()
