import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, test } from "node:test"
import { JSDOM } from "jsdom"

const windows = []
after(() => windows.forEach((w) => w.close()))

const source = readFileSync(new URL("../public/rum.js", import.meta.url), "utf8")
const OPEN = { replayEnabled: true, replaySampleRate: 1, maskAllText: false, blockSelectors: [] }
const SECRETS = ["hunter2", "4242 4242 4242 4242", "secret note", "123-45-6789"]

function boot(html, options = {}) {
  const attrs = options.attrs ?? 'data-key="rum_test" data-api="https://api.test"'
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Pricing</title></head><body>${html}<script ${attrs}></script></body></html>`,
    {
      url: "https://shop.test/pricing?token=abc",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    }
  )
  windows.push(dom.window)
  const sent = []
  const beacons = []
  const statuses = [...(options.statuses ?? [])]
  dom.window.fetch = (url, init = {}) => {
    if (String(url).endsWith("/config")) {
      if (!options.config) return Promise.reject(new Error("offline"))
      return Promise.resolve({ ok: true, json: () => Promise.resolve(options.config) })
    }
    sent.push({ url, body: init.body })
    const status = statuses.length ? statuses.shift() : 202
    return Promise.resolve({ ok: status < 300, status, headers: { get: () => null } })
  }
  dom.window.navigator.sendBeacon = (url, blob) => {
    beacons.push({ url, blob })
    return options.beacon ?? true
  }
  const el = dom.window.document.querySelector("script[data-api]")
  Object.defineProperty(dom.window.document, "currentScript", { value: el, configurable: true })
  dom.window.eval(source)
  return { dom, sent, beacons }
}

const settle = () => new Promise((r) => setTimeout(r, 30))
const bodies = (sent) =>
  sent.filter((s) => String(s.url).includes("/v1/rum/")).map((s) => JSON.parse(s.body))

test("snapshots hide input values, scripts, inline handlers and secret query params", async () => {
  const { dom } = boot(
    '<h1 onclick="steal()">Hello</h1><input type="password" value="hunter2"><textarea>secret note</textarea><p data-pramaan-mask>4242 4242</p><a href="/reset?token=xyz">Reset</a><script>var x=1</script>',
    { config: OPEN }
  )
  await dom.window.pramaan.ready
  const html = dom.window.pramaan._snapshot()
  assert.ok(html.includes("Hello"))
  for (const bad of ["hunter2", "secret note", "4242", "steal()", "var x=1", "xyz"])
    assert.ok(!html.includes(bad), bad)
  assert.ok(html.includes('<base href="https://shop.test/">'))
})

test("masks all text by default when settings cannot be loaded", async () => {
  const { dom } = boot("<p>Visible text</p>")
  await dom.window.pramaan.ready
  assert.ok(!dom.window.pramaan._snapshot().includes("Visible text"))
  assert.equal(dom.window.pramaan._state().replayOn, false)
})

test("data-mask forces masking even when the application allows text", async () => {
  const { dom } = boot("<p>Visible text</p>", {
    config: OPEN,
    attrs: 'data-key="rum_test" data-api="https://api.test" data-mask="true"',
  })
  await dom.window.pramaan.ready
  assert.ok(!dom.window.pramaan._snapshot().includes("Visible text"))
})

test("block selectors remove whole elements from the replay", async () => {
  const { dom } = boot('<div class="card-form">Card holder Ann</div><p>Keep</p>', {
    config: { ...OPEN, blockSelectors: [".card-form"] },
  })
  await dom.window.pramaan.ready
  const html = dom.window.pramaan._snapshot()
  assert.ok(!html.includes("Card holder"))
  assert.ok(html.includes("data-pramaan-blocked"))
})

test("typed password and payment values never leave the page", async () => {
  const { dom, sent } = boot(
    '<input id=pw type="password"><input id=cc autocomplete="cc-number"><input id=ssn name="ssn"><textarea id=note></textarea>',
    { config: { ...OPEN, maskAllText: true } }
  )
  await dom.window.pramaan.ready
  const doc = dom.window.document
  doc.getElementById("pw").value = "hunter2"
  doc.getElementById("cc").value = "4242 4242 4242 4242"
  doc.getElementById("ssn").value = "123-45-6789"
  doc.getElementById("note").value = "secret note"
  doc.getElementById("cc").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  dom.window.pramaan._snapshot()
  dom.window.pramaan.flush()
  await settle()
  const wire = sent.map((s) => String(s.body)).join("\n")
  assert.ok(wire.length > 0)
  for (const bad of SECRETS) assert.ok(!wire.includes(bad), bad)
})

test("batches carry ids, sequence numbers, event ids and custom events", async () => {
  const { dom, sent } = boot("<button id=buy>Buy now</button>", { config: OPEN })
  await dom.window.pramaan.ready
  dom.window.pramaan.identify({ id: "u1", email: "a@b.test" })
  dom.window.pramaan.track("add_to_cart", { sku: "A1", token: "nope", qty: 2 })
  dom.window.document
    .getElementById("buy")
    .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  dom.window.pramaan.flush()
  await settle()
  assert.equal(sent[0].url, "https://api.test/v1/rum/rum_test")
  const [body] = bodies(sent)
  assert.match(body.batchId, /^[0-9a-f]{24}$/)
  assert.equal(body.sequence, 1)
  assert.equal(body.userId, "u1")
  assert.ok(body.events.every((e) => /^[0-9a-f]{16}$/.test(e.id)))
  assert.ok(!body.url.includes("abc"))
  assert.deepEqual(body.events.find((e) => e.name === "add_to_cart").props, { sku: "A1", qty: 2 })
  assert.equal(body.events.find((e) => e.type === "click").name, "button#buy Buy now")
  assert.ok(body.replay)
})

test("replay stays off until the application enables it", async () => {
  const { dom, sent } = boot("<p>Hi</p>", { config: { ...OPEN, replayEnabled: false } })
  await dom.window.pramaan.ready
  dom.window.pramaan.flush()
  await settle()
  assert.equal(bodies(sent)[0].replay, undefined)
})

test("keeps a failed batch queued and spooled, then retries the same batch id", async () => {
  const { dom, sent } = boot("", { statuses: [503] })
  await dom.window.pramaan.ready
  dom.window.pramaan.flush()
  await settle()
  assert.equal(dom.window.pramaan._state().queue, 1)
  const spool = JSON.parse(dom.window.localStorage.getItem("pramaan_spool_rum_test"))
  assert.equal(spool.length, 1)
  assert.equal(spool[0].body.batchId, bodies(sent)[0].batchId)
})

test("drops a rejected batch and reports the loss in the next batch", async () => {
  const { dom, sent } = boot("", { statuses: [400] })
  await dom.window.pramaan.ready
  dom.window.pramaan.flush()
  await settle()
  dom.window.pramaan.track("again")
  dom.window.pramaan.flush()
  await settle()
  const [first, second] = bodies(sent)
  assert.equal(second.dropped, first.events.length)
  assert.equal(second.sequence, first.sequence + 1)
})

test("uses sendBeacon on page hide and spools what the beacon refuses", async () => {
  const ok = boot("")
  await ok.dom.window.pramaan.ready
  ok.dom.window.dispatchEvent(new ok.dom.window.Event("pagehide"))
  assert.equal(ok.beacons.length, 1)
  assert.equal(ok.dom.window.localStorage.getItem("pramaan_spool_rum_test"), null)
  const refused = boot("", { beacon: false })
  await refused.dom.window.pramaan.ready
  refused.dom.window.dispatchEvent(new refused.dom.window.Event("pagehide"))
  assert.equal(
    JSON.parse(refused.dom.window.localStorage.getItem("pramaan_spool_rum_test")).length,
    1
  )
})

test("captures uncaught errors, failed requests and console errors", async () => {
  const { dom, sent } = boot("", { statuses: [500] })
  await dom.window.pramaan.ready
  dom.window.dispatchEvent(
    new dom.window.ErrorEvent("error", { message: "boom", filename: "app.js", lineno: 3 })
  )
  dom.window.console.error("payment failed")
  await dom.window.fetch("https://shop.test/api/cart?token=1", { method: "POST" })
  dom.window.pramaan.flush()
  await settle()
  const events = bodies(sent).flatMap((b) => b.events ?? [])
  assert.equal(events.find((e) => e.type === "error").name, "boom")
  assert.equal(events.find((e) => e.type === "console").name, "payment failed")
  const net = events.find((e) => e.type === "network")
  assert.equal(net.name, "POST https://shop.test/api/cart")
  assert.equal(net.props.status, 500)
})

test("does nothing without a key", () => {
  const { dom } = boot("", { attrs: 'data-api="https://api.test"' })
  assert.equal(dom.window.pramaan, undefined)
})
