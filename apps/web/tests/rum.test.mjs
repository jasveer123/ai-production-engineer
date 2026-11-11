import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, test } from "node:test"
import { JSDOM } from "jsdom"

const windows = []
after(() => windows.forEach((w) => w.close()))

const source = readFileSync(new URL("../public/rum.js", import.meta.url), "utf8")

function boot(html, scriptAttrs = 'data-key="rum_test" data-api="https://api.test"') {
  const dom = new JSDOM(`<!doctype html><html><head><title>Pricing</title></head><body>${html}<script ${scriptAttrs}></script></body></html>`, {
    url: "https://shop.test/pricing?token=abc",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  })
  windows.push(dom.window)
  const sent = []
  dom.window.fetch = (url, init) => {
    sent.push({ url, body: init.body })
    return Promise.resolve({ ok: true })
  }
  dom.window.navigator.sendBeacon = (url, blob) => {
    sent.push({ url, beacon: true, blob })
    return true
  }
  const el = dom.window.document.querySelector("script[data-key]")
  Object.defineProperty(dom.window.document, "currentScript", { value: el, configurable: true })
  dom.window.eval(source)
  return { dom, sent }
}

const ready = (dom) =>
  dom.window.document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((resolve) => dom.window.addEventListener("load", resolve))

test("snapshots hide input values, scripts and inline handlers", () => {
  const { dom } = boot(
    '<h1 onclick="steal()">Hello</h1><input type="password" value="hunter2"><textarea>secret note</textarea><p data-pramaan-mask>4242 4242</p><script>var x=1</script>'
  )
  const html = dom.window.pramaan._snapshot()
  assert.ok(html.includes("Hello"))
  assert.ok(!html.includes("hunter2"))
  assert.ok(!html.includes("secret note"))
  assert.ok(!html.includes("4242"))
  assert.ok(!html.includes("steal()"))
  assert.ok(!html.includes("var x=1"))
  assert.ok(html.includes('<base href="https://shop.test/">'))
})

test("data-mask replaces every visible character", () => {
  const { dom } = boot("<p>Visible text</p>", 'data-key="rum_test" data-api="https://api.test" data-mask="true"')
  const html = dom.window.pramaan._snapshot()
  assert.ok(!html.includes("Visible text"))
})

test("tracks custom events, ignores sensitive props and flushes to the right endpoint", async () => {
  const { dom, sent } = boot("<button id=buy>Buy now</button>")
  await ready(dom)
  dom.window.pramaan.identify({ id: "u1", email: "a@b.test" })
  dom.window.pramaan.track("add_to_cart", { sku: "A1", token: "nope", qty: 2 })
  dom.window.document.getElementById("buy").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
  dom.window.pramaan.flush()
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(sent.length, 1)
  assert.equal(sent[0].url, "https://api.test/v1/rum/rum_test")
  const body = JSON.parse(typeof sent[0].body === "string" ? sent[0].body : "{}")
  assert.equal(body.userId, "u1")
  const custom = body.events.find((e) => e.name === "add_to_cart")
  assert.deepEqual(custom.props, { sku: "A1", qty: 2 })
  assert.ok(body.events.some((e) => e.type === "pageview"))
  const click = body.events.find((e) => e.type === "click")
  assert.equal(click.name, "button#buy Buy now")
})

test("captures uncaught errors", async () => {
  const { dom, sent } = boot("")
  await ready(dom)
  dom.window.dispatchEvent(new dom.window.ErrorEvent("error", { message: "boom", filename: "app.js", lineno: 3 }))
  dom.window.pramaan.flush()
  await new Promise((r) => setTimeout(r, 20))
  const body = JSON.parse(sent[0].body)
  assert.equal(body.events.find((e) => e.type === "error").name, "boom")
})

test("does nothing without a key", () => {
  const { dom } = boot("", 'data-api="https://api.test"')
  assert.equal(dom.window.pramaan, undefined)
})
