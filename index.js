/**
 * asyncSSE yields events when streaming from an SSE endpoint.
 *
 * @param {Request} request
 * @param {RequestInit} options
 * @returns {AsyncGenerator<Record<string, string>, void, unknown>}
 *
 * @example
 * for await (const event of asyncSSE("https://example.com/stream", { method: "POST" })) {
 *   console.log(event);
 * }
 */
export async function* asyncSSE(request, options = {}) {
  let response, reader;
  let buffer = "";

  try {
    response = await fetch(request, options);
    if (!response.ok) {
      yield {
        error: `HTTP ${response.status} ${response.statusText} - ${await response.text()}`,
      };
      return;
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();

    const parseEvent = (eventText) => {
      const event = {};
      let lastField = "";

      for (const line of eventText.split("\n")) {
        // Ignore comment lines, i.e. if the line starts with ':"
        if (line.startsWith(":")) continue;

        // If the line does not contain a colon, append it to the last field
        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) {
          if (lastField) event[lastField] += "\n" + line;
          continue;
        }

        const [field, value] = [
          line.slice(0, colonIndex),
          line.slice(colonIndex + 1).trim(),
        ];

        if (field === "data")
          event.data = (event.data || "") + (event.data ? "\n" : "") + value;
        else event[field] = value;
        lastField = field;
      }

      return event;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/(?=\r?\n\r?\n)/);
      buffer = events.pop() || "";

      for (const event of events) {
        const parsedEvent = parseEvent(event);
        if (Object.keys(parsedEvent).length > 0) yield parsedEvent;
      }
    }
    if (buffer.trim()) {
      const parsedEvent = parseEvent(buffer.trim());
      if (Object.keys(parsedEvent).length > 0) yield parsedEvent;
    }
  } catch (e) {
    if (buffer.trim()) {
      const parsedEvent = parseEvent(buffer.trim());
      if (Object.keys(parsedEvent).length > 0) yield parsedEvent;
    }
    yield { error: `Failed: ${e.name} ${e.message}` };
  } finally {
    if (reader) {
      try {
        await reader.cancel();
      } catch {} // Ignore errors during reader cancellation
    }
  }
}
