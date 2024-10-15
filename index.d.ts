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
 * asyncSSE yields events when streaming from an SSE endpoint.
 *
 * @param request - The URL or Request object for the SSE endpoint.
 * @param options - Optional RequestInit object to configure the fetch request.
 * @returns An AsyncGenerator that yields SSEEvent objects.
 *
 * @example
 * for await (const event of asyncSSE("https://example.com/stream", { method: "POST" })) {
 *   console.log(event);
 * }
 */
export function asyncSSE(request: string | Request, options?: RequestInit): AsyncGenerator<SSEEvent, void, unknown>;
