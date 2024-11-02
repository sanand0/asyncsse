import { asyncSSE } from "./index.js";

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  throw new Error(
    message || `Expected:\n${JSON.stringify(expected, null, 2)}. Actual:\n${JSON.stringify(actual, null, 2)}`
  );
}

Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  switch (url.pathname) {
    case "/success":
      return new Response("data: Hello\n\ndata: World\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/error":
      return new Response("Error occurred", { status: 500 });
    case "/abort":
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data: Start\n\n"));
            // Flush the data before simulating the aborted connection
            setTimeout(() => {
              controller.error(new Error("Connection aborted"));
            }, 0);
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } }
      );
    case "/empty":
      return new Response("", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/partial":
      return new Response("data: Incomplete\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/multiple":
      return new Response("data: Event1\n\ndata: Event2\n\ndata: Event3\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/multifield":
      return new Response("event: update\ndata: MultiField\nid: 1\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/comment":
      return new Response(": This is a comment\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/retry":
      return new Response("retry: 10000\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/mixed":
      return new Response("event: update\ndata: Event1\n\nid: 2\ndata: Event2\n\ndata: Event3\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/colon":
      return new Response("data: key: value\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/empty-lines":
      return new Response("data: Line1\n\ndata: Line2\n\n\ndata: Line3\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/field-no-value":
      return new Response("data:\nevent:update\nid:1\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/multiple-data":
      return new Response("data: Line1\ndata: Line2\ndata: Line3\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    case "/unknown-field":
      return new Response("unknown: value\ndata: Known data\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    default:
      return new Response("Not found", { status: 404 });
  }
});

Deno.test("asyncSSE - success case", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/success`));
  assertEquals(events, [{ data: "Hello" }, { data: "World" }]);
});

Deno.test("asyncSSE - HTTP error", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/error`));
  assertEquals(events, [{ error: "HTTP 500 Internal Server Error - Error occurred" }]);
});

Deno.test("asyncSSE - network error", async () => {
  const events = await Array.fromAsync(asyncSSE("http://non-existent-url"));
  assertEquals(events.length, 1);
  assertEquals(events[0].error.startsWith("Failed:"), true);
});

Deno.test("asyncSSE - aborted connection", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/abort`));
  assertEquals(events[0], { data: "Start" });
  assertEquals(events[1].error.startsWith("Failed:"), true);
});

Deno.test("asyncSSE - with options", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/success`, { method: "POST" }));
  assertEquals(events, [{ data: "Hello" }, { data: "World" }]);
});

Deno.test("asyncSSE - empty response", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/empty`));
  assertEquals(events, []);
});

Deno.test("asyncSSE - partial event", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/partial`));
  assertEquals(events, [{ data: "Incomplete" }]);
});

Deno.test("asyncSSE - multiple events in single chunk", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/multiple`));
  assertEquals(events, [{ data: "Event1" }, { data: "Event2" }, { data: "Event3" }]);
});

Deno.test("asyncSSE - event with multiple fields", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/multifield`));
  assertEquals(events, [{ event: "update", data: "MultiField", id: "1" }]);
});

Deno.test("asyncSSE - comment-only event", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/comment`));
  assertEquals(events, []);
});

Deno.test("asyncSSE - event with retry field", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/retry`));
  assertEquals(events, [{ retry: "10000" }]);
});

Deno.test("asyncSSE - multiple events with mixed fields", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/mixed`));
  assertEquals(events, [{ event: "update", data: "Event1" }, { id: "2", data: "Event2" }, { data: "Event3" }]);
});

Deno.test("asyncSSE - event with colon in the data", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/colon`));
  assertEquals(events, [{ data: "key: value" }]);
});

Deno.test("asyncSSE - empty lines within event", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/empty-lines`));
  assertEquals(events, [{ data: "Line1" }, { data: "Line2" }, { data: "Line3" }]);
});

Deno.test("asyncSSE - field with no value", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/field-no-value`));
  assertEquals(events, [{ data: "", event: "update", id: "1" }]);
});

Deno.test("asyncSSE - multiple data fields", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/multiple-data`));
  assertEquals(events, [{ data: "Line1\nLine2\nLine3" }]);
});

Deno.test("asyncSSE - unknown field", async () => {
  const events = await Array.fromAsync(asyncSSE(`${BASE_URL}/unknown-field`));
  assertEquals(events, [{ unknown: "value", data: "Known data" }]);
});

Deno.test("asyncSSE - onResponse callback", async () => {
  let responseStatus = 0;
  const config = {
    onResponse: async (response) => {
      responseStatus = response.status;
    },
  };

  await Array.fromAsync(asyncSSE(`${BASE_URL}/success`, {}, config));
  assertEquals(responseStatus, 200);
});

Deno.test("asyncSSE - sync and async onResponse callbacks", async () => {
  // Test synchronous callback
  let syncStatus = 0;
  const syncConfig = {
    onResponse: (response) => {
      syncStatus = response.status;
    },
  };
  await Array.fromAsync(asyncSSE(`${BASE_URL}/success`, {}, syncConfig));
  assertEquals(syncStatus, 200);

  // Test asynchronous callback
  let asyncStatus = 0;
  const asyncConfig = {
    onResponse: async (response) => {
      await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async work
      asyncStatus = response.status;
    },
  };
  await Array.fromAsync(asyncSSE(`${BASE_URL}/success`, {}, asyncConfig));
  assertEquals(asyncStatus, 200);
});
