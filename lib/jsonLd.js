// JSON-LD aman di dalam <script> — escape '<' (anti '</script>') + U+2028/U+2029.
export function jsonLdHtml(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
