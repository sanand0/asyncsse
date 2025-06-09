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
    for await (const { data, error } of asyncSSE("https://api.example.com/sse")) {
      if (error) throw new Error(error);
      console.log(data);
    }
  })();
</script>
```

### Node.js or bundled projects

```javascript
import { asyncSSE } from "asyncsse";

// Example usage
(async () => {
  for await (const { data, error } of asyncSSE("https://api.example.com/sse")) {
    if (error) throw new Error(error);
    console.log(data);
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

Events can have fields like `event`, `data`, `id`, and `retry` like this:

```
event: userupdate
id: 123
data: {"username": "testuser", "status": "online"}
retry: 5000

data: Simple message
```

`asyncSSE` parses these into a single object.

```javascript
(async () => {
  for await (const event of asyncSSE(sseStream, {})) {
    console.log(event.event, event.data, event.id, event.retry);
  }
})();
```

This would output:

```
{ event: "userupdate", id: "123", data: '{"username": "testuser", "status": "online"}', retry: "5000" }
{ data: "Simple message" }
```

**Comment lines** with a colon (`:`) are comments and are ignored by the parser. They will not result in an event.

```
: This is a comment, it will be ignored
data: First event
: Another comment
event: important
data: Second event
id: 456
```

This would output:

```
{ data: "First event" }
{ event: "important", data: "Second event", id: "456" }
```

**`retry` fields** suggest a reconnection time (in milliseconds). `asyncSSE` itself does not automatically handle reconnection based on this value; it simply parses and provides it. Wait for this duration and reconnect if the connection is lost.

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
for await (const { data, error } of asyncSSE(url, options, config)) {
  if (error) throw new Error(error);
  console.log(JSON.parse(data));
}
```

## Tests

You can run the tests using Deno:

```bash
deno test --allow-net
```

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
