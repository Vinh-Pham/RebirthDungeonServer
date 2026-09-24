// These optional Nest integrations are deliberately absent from this Worker.
// Fail clearly if a future feature tries to use one; do not silently polyfill it.
throw new Error(
  'This optional Nest integration is not enabled in the Worker build',
);
export {};
