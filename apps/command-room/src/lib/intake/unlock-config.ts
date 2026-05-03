// Pure constants for the PII unlock flow. Lives in a separate file
// (not unlock.ts) because Next.js 15 forbids non-async-function exports
// from a 'use server' file:
//
//   "Only async functions are allowed to be exported in a 'use server' file."
//
// Importing a const from a server-action file resolves to a Server
// Action proxy at runtime, not the actual value — which silently
// breaks anything that uses it (e.g., setTimeout(fn, PROXY) → fires
// immediately because the proxy isn't a number). Keep these here.

export const PII_UNLOCK_DURATION_MS = 15 * 60 * 1000;
