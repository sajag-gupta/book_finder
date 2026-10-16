const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for use in HTML content and attribute values. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Serialises JSON-LD safely for embedding in a <script> element. */
export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
