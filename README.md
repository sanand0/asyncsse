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

### `asyncSSE(url: string, options?: RequestInit): AsyncIterable<SSEEvent>`

Fetches Server-Sent Events from the specified URL and returns an async iterable.

- `url`: The URL to fetch SSE from
- `options`: Optional [fetch options](https://developer.mozilla.org/en-US/docs/Web/API/fetch#parameters)

Returns an async iterable that yields `SSEEvent` objects.

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

// Fetch the stream, event by event
for await (const event of asyncSSE(url, options)) {
  console.log(JSON.parse(event.data));
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
