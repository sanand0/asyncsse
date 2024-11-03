/**
 * asyncSSE yields events when streaming from an SSE endpoint.
 *
 * @param {string | Request} request - The URL or Request object for the SSE endpoint.
 * @param {RequestInit} options - Optional RequestInit object to configure the fetch request.
 * @param {SSEConfig} config - Optional configuration object for the SSE stream.
 * @returns {AsyncGenerator<SSEEvent, void, unknown>} An AsyncGenerator that yields SSEEvent objects.
 *
 * @example
 * for await (const event of asyncSSE("https://example.com/stream", { method: "POST" })) {
 *   console.log(event);
 * }
 */
export async function* asyncSSE(
  request: string | Request,
  options: RequestInit = {},
  config: SSEConfig = {},
): AsyncGenerator<SSEEvent, void, unknown> {
  let response: Response;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let buffer = "";

  try {
    response = await (config.fetch ?? fetch)(request, options);
    if (config.onResponse) await config.onResponse(response);

    if (!response.ok) {
      yield { error: `HTTP ${response.status} ${response.statusText} - ${await response.text()}` };
      return;
    }
    if (!response.body) {
      yield { error: "No response body" };
      return;
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/(?=\r?\n\r?\n)/);
      buffer = events.pop() || "";

      for (const event of events) {
        const parsedEvent = parseEvent(event);
        if (Object.keys(parsedEvent).length > 0) yield parsedEvent;
      }
      if (done) break;
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
    yield { error: `Failed: ${e}` };
  } finally {
    if (reader) {
      try {
        await reader.cancel();
      } catch {} // Ignore errors during reader cancellation
    }
  }
}

const parseEvent = (eventText: string): SSEEvent => {
  const event: SSEEvent = {};
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

    const [field, value] = [line.slice(0, colonIndex), line.slice(colonIndex + 1).trim()];

    if (field === "data") event.data = (event.data || "") + (event.data ? "\n" : "") + value;
    else event[field] = value;
    lastField = field;
  }

  return event;
};

/**
 * Represents an event object returned by the SSE stream.
 * This interface allows for any string key-value pairs, with some common SSE fields explicitly defined.
 */
export interface SSEEvent {
  // The event data. In SSE, this is typically the main payload of the event.
  data?: string;

  // The event type. This can be used to distinguish between different types of events from the same stream.
  event?: string;

  // An error message. This is not a standard SSE field, but is used in this implementation to convey error information.
  error?: string;

  // Allow any other object properties
  [key: string]: string | undefined;
}

/**
 * Configuration options for the SSE stream
 */
export interface SSEConfig {
  /** Custom fetch implementation. Defaults to global fetch if not provided. */
  fetch?: typeof fetch;
  /** Callback function called with the Response object after successful fetch */
  onResponse?: (response: Response) => any;
}
