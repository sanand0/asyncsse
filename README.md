# asyncSSE

[![npm version](https://img.shields.io/npm/v/asyncsse.svg)](https://www.npmjs.com/package/asyncsse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Fetch Server-Sent Events (SSE) as an async iterable.

## Features

- 🚀 Lightweight (<1KB) and dependency-free
- 🔄 Works with any SSE-compatible API
- 🌐 Browser and Node.js compatible
- 📦 Easy to use with ES modules

## Installation

```bash
npm install asyncsse
```

## Usage

### Browser (via CDN)

```html
<script type="module">
  import { asyncSSE } from "https://cdn.jsdelivr.net/npm/asyncsse@1";

  // Example usage
  (async () => {
    for await (const event of asyncSSE("https://api.example.com/sse")) {
      console.log(event);
    }
  })();
</script>
```

### Node.js or bundled projects

```javascript
import { asyncSSE } from "asyncsse";

// Example usage
(async () => {
  for await (const event of asyncSSE("https://api.example.com/sse")) {
    console.log(event);
  }
})();
```

## API

### `asyncSSE(url: string, options?: RequestInit, config?: SSEConfig): AsyncIterable<SSEEvent>`

Fetches Server-Sent Events from the specified URL and returns an async iterable.

- `url`: The URL to fetch SSE from
- `options`: Optional [fetch options](https://developer.mozilla.org/en-US/docs/Web/API/fetch#parameters)
- `config`: Optional configuration object
  - `fetch`: Custom fetch implementation (defaults to global fetch)
  - `onResponse`: Async callback to inspect or modify the Response before streaming begins

Returns an async iterable that yields `SSEEvent` objects.

### Error Handling

When fetch failures or other errors occur during the SSE stream, the iterator will yield an object of the form `{ error: ... }`. You can catch these errors by wrapping your `for await...of` loop in a `try...catch` block.

Here's an example of how to handle these errors:

```javascript
import { asyncSSE } from "asyncsse";

// Example usage
(async () => {
  try {
    for await (const event of asyncSSE("https://api.example.com/sse")) {
      if (event.error) {
        console.error("Error during SSE stream:", event.error);
        // Optionally, break the loop or implement retry logic
        break;
      }
      console.log(event);
    }
  } catch (error) {
    console.error("Failed to connect to SSE stream:", error);
  }
})();
```

## More Examples

Here are a few more examples demonstrating common Server-Sent Event scenarios:

### Handling Events with Multiple Fields

Events can have fields like `event`, `data`, `id`, and `retry`. `asyncSSE` parses these into a single object.

```javascript
import { asyncSSE } from "asyncsse";
import { fetchText } from "asyncsse/fetchtext"; // Assuming fetchText is available

// Simulate an SSE stream with a multi-field event
const sseStream = `
event: userupdate
id: 123
data: {"username": "testuser", "status": "online"}
retry: 5000

data: Simple message
`;

(async () => {
  // Use fetchText for this example; in a real scenario, this would be a URL
  for await (const event of asyncSSE(sseStream, {}, { fetch: fetchText })) {
    console.log(event);
  }
})();
```

This would output:

```
{ event: "userupdate", id: "123", data: '{"username": "testuser", "status": "online"}', retry: "5000" }
{ data: "Simple message" }
```

### Comment Lines

Lines starting with a colon (`:`) are comments and are ignored by the parser. They will not result in an event.

```javascript
import { asyncSSE } from "asyncsse";
import { fetchText } from "asyncsse/fetchtext";

const sseStreamWithComments = `
: This is a comment, it will be ignored
data: First event
: Another comment
event: important
data: Second event
id: 456
`;

(async () => {
  for await (const event of asyncSSE(sseStreamWithComments, {}, { fetch: fetchText })) {
    console.log(event);
  }
})();
```

This would output:

```
{ data: "First event" }
{ event: "important", data: "Second event", id: "456" }
```

### Retry Field

If the server sends a `retry` field, it will be included in the event object. This suggests a reconnection time (in milliseconds) that the client should wait before attempting to reconnect if the connection is lost. `asyncSSE` itself does not automatically handle reconnection based on this value; it simply parses and provides it.

```javascript
import { asyncSSE } from "asyncsse";
import { fetchText } from "asyncsse/fetchtext";

const sseStreamWithRetry = `
retry: 10000
data: Some data
`;

(async () => {
  for await (const event of asyncSSE(sseStreamWithRetry, {}, { fetch: fetchText })) {
    console.log(event);
  }
})();
```

This would output:

```
{ retry: "10000" }
{ data: "Some data" }
```
Note: The SSE specification states that a `retry` field alone doesn't form an event. It's usually sent with data or as a standalone directive that might affect subsequent reconnections. `asyncSSE` will yield it as a property of the next event if it's part of a multi-line event, or as its own object if it's the only thing in a dispatch. The example from `test.js` (`retry: 10000\n\n`) results in `{ retry: "10000" }`. If it was `retry: 10000\ndata: hello\n\n`, the output would be `{ retry: "10000", data: "hello" }`.


## Example: OpenAI Chat Completions

```javascript
import { asyncSSE } from "asyncsse";

const apiKey = "YOUR_OPENAI_API_KEY";
const url = "https://api.openai.com/v1/chat/completions";

const options = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: "gpt-4",
    stream: true,
    messages: [{ role: "user", content: "Hello, world!" }],
  }),
};

const config = {
  onResponse: async (response) => {
    console.log("Requests remaining:", response.headers.get("X-Ratelimit-Remaining-Requests"));
  },
};

// Fetch the stream, event by event
for await (const event of asyncSSE(url, options, config)) {
  console.log(JSON.parse(event.data));
}
```

## Testing with Text Input

You can directly stream SSE events from a text string using the provided `fetchText` helper:

```javascript
import { asyncSSE } from "https://cdn.jsdelivr.net/npm/asyncsse@1";
import { fetchText } from "https://cdn.jsdelivr.net/npm/asyncsse@1/dist/fetchtext.js";

const text = "data: Hello\n\ndata: World\n\n";

// Stream events from text
for await (const event of asyncSSE(text, {}, { fetch: fetchText })) {
  console.log(event);
}
```

This outputs:

```
{ data: "Hello" }
{ data: "World" }
```

This is particularly useful for testing SSE parsing without making actual HTTP requests.

## Changelog

- 1.3.3: Improved documentation for error handling and added more examples.
- 1.3.2: Update repo links
- 1.3.1: Add `fetchText` helper for mocking SSE responses. Add source maps and TypeScript
- 1.2.1: Add `config.fetch` parameter for custom fetch implementations
- 1.1.0: Add `config.onResponse` callback
- 1.0.0: Initial release

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
