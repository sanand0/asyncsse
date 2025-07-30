import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { Browser } from "happy-dom"

const browser = new Browser({
  console,
  settings: { fetch: { virtualServers: [{ url: "https://test/", directory: "." }] } },
})

describe("asyncsse demo", () => {
  let page, document, window

  beforeAll(() => vi.useFakeTimers())
  afterAll(() => vi.useRealTimers())

  beforeEach(async () => {
    page = browser.newPage()
    await page.goto("https://test/asyncsse.html")
    await page.waitUntilComplete()
    ;({ document, window } = page.mainFrame)
    window.setTimeout = setTimeout
    window.fetch = window.fetchText
  })

  const run = async (text, fetchType = "text", status) => {
    document.getElementById("input").value = text
    switch (fetchType) {
      case "http":
        window.fetch = () => Promise.resolve(new Response("Error", { status: 500 }))
        break
      case "network":
        window.fetch = () => Promise.reject(new Error("fail"))
        break
      case "abort":
        window.fetch = () =>
          Promise.resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new TextEncoder().encode("data: Start\n\n"))
                  setTimeout(() => controller.error(new Error("aborted")), 10)
                },
              }),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
          )
        break
      case "text200":
        window.fetch = t =>
          Promise.resolve(
            new Response(t, {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            }),
          )
        break
      default:
        window.fetch = window.fetchText
    }
    const cfg = {}
    if (status === "sync") cfg.onResponse = res => (window.syncStatus = res.status)
    if (status === "async")
      cfg.onResponse = async res => {
        await new Promise(r => setTimeout(r, 10))
        window.asyncStatus = res.status
      }
    const p = window.startSSE({}, cfg)
    await Promise.resolve()
    await Promise.resolve()
    if (fetchType === "abort") vi.advanceTimersByTime(10)
    else vi.runAllTimers()
    await Promise.resolve()
    await p
    return JSON.parse(document.getElementById("output").textContent)
  }

  it("success", async () => {
    expect(await run("data: Hello\n\ndata: World\n\n")).toEqual([{ data: "Hello" }, { data: "World" }])
  }, { timeout: 10000 })

  it("HTTP error", async () => {
    expect((await run("", "http"))[0].error).toMatch(/HTTP 500/)
  })

  it("network error", async () => {
    expect((await run("", "network"))[0].error).toMatch(/Failed:/)
  })

  it("aborted connection", async () => {
    const res = await run("", "abort")
    expect(res.at(-1).error).toMatch(/Failed:/)
  })

  it("with options", async () => {
    document.getElementById("input").value = "data: Hello\n\ndata: World\n\n"
    window.fetch = window.fetchText
    const p = window.startSSE({ method: "POST" })
    vi.runAllTimers()
    await p
    expect(JSON.parse(document.getElementById("output").textContent)).toEqual([
      { data: "Hello" },
      { data: "World" },
    ])
  })

  it("empty response", async () => {
    expect(await run(""))
      .toEqual([])
  })

  it("partial event", async () => {
    expect(await run("data: Incomplete\n")).toEqual([{ data: "Incomplete" }])
  })

  it("multiple events in single chunk", async () => {
    const text = "data: Event1\n\ndata: Event2\n\ndata: Event3\n\n"
    expect(await run(text)).toEqual([{ data: "Event1" }, { data: "Event2" }, { data: "Event3" }])
  })

  it("event with multiple fields", async () => {
    const text = "event: update\ndata: MultiField\nid: 1\n\n"
    expect(await run(text)).toEqual([{ event: "update", data: "MultiField", id: "1" }])
  })

  it("comment-only event", async () => {
    const text = ": This is a comment\n\n"
    expect(await run(text)).toEqual([])
  })

  it("event with retry field", async () => {
    const text = "retry: 10000\n\n"
    expect(await run(text)).toEqual([{ retry: "10000" }])
  })

  it("multiple events with mixed fields", async () => {
    const text = "event: update\ndata: Event1\n\nid: 2\ndata: Event2\n\ndata: Event3\n\n"
    expect(await run(text)).toEqual([
      { event: "update", data: "Event1" },
      { id: "2", data: "Event2" },
      { data: "Event3" },
    ])
  })

  it("event with colon in the data", async () => {
    expect(await run("data: key: value\n\n")).toEqual([{ data: "key: value" }])
  })

  it("empty lines within event", async () => {
    const text = "data: Line1\n\ndata: Line2\n\n\ndata: Line3\n\n"
    expect(await run(text)).toEqual([
      { data: "Line1" },
      { data: "Line2" },
      { data: "Line3" },
    ])
  })

  it("field with no value", async () => {
    const text = "data:\nevent:update\nid:1\n\n"
    expect(await run(text)).toEqual([{ data: "", event: "update", id: "1" }])
  })

  it("multiple data fields", async () => {
    const text = "data: Line1\ndata: Line2\ndata: Line3\n\n"
    expect(await run(text)).toEqual([{ data: "Line1\nLine2\nLine3" }])
  })

  it("unknown field", async () => {
    const text = "unknown: value\ndata: Known data\n\n"
    expect(await run(text)).toEqual([{ unknown: "value", data: "Known data" }])
  })

  it("onResponse callback", async () => {
    await run("data: Hello\n\n", "text200", "sync")
    expect(window.syncStatus).toBe(200)
  })

  it("sync and async onResponse callbacks", async () => {
    await run("data: Hello\n\n", "text200", "sync")
    expect(window.syncStatus).toBe(200)
    window.fetch = t =>
      Promise.resolve(new Response(t, { status: 200, headers: { "Content-Type": "text/event-stream" } }))
    document.getElementById("input").value = "data: Hello\n\n"
    const p = window.startSSE({}, { onResponse: async res => { await Promise.resolve(); window.asyncStatus = res.status } })
    vi.runAllTimers()
    await p
    expect(window.asyncStatus).toBe(200)
  }, { timeout: 10000 })

  it("custom fetch implementation", async () => {
    window.fetch = undefined
    const text = "data: Hello\n\ndata: World\n\n"
    document.getElementById("input").value = text
    const p = window.startSSE({}, { fetch: window.fetchText })
    vi.runAllTimers()
    await p
    expect(JSON.parse(document.getElementById("output").textContent)).toEqual([
      { data: "Hello" },
      { data: "World" },
    ])
  })
})
