/**
 * Creates a mock fetch Response that streams the provided text as SSE events
 *
 * @param {string} text - The SSE formatted text to stream
 * @returns {Promise<Response>}A Promise that resolves to a mock Response object
 *
 * @example
 * const text = "data: Hello\n\ndata: World\n\n";
 * const events = asyncSSE(text, {}, { fetch: fetchText });
 */
export const fetchText = async (text: string): Promise<Response> =>
  ({
    ok: true,
    body: {
      getReader: () => ({
        read: async () => ({
          value: new TextEncoder().encode(text),
          done: true,
        }),
        cancel: async () => {},
      }),
    } as ReadableStream,
  }) as Response;
