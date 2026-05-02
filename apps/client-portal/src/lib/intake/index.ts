// Re-export the intake server actions so callers can import from
// `@/lib/intake` instead of remembering which file each action lives in.
//
// Each module is its own `'use server'` boundary; this index file is
// just a barrel re-export. Next.js bundles all the actions correctly
// regardless of how they're surfaced here.

export { getOrCreateIntakeAnswers, type IntakeBundle } from './read';
export { saveIntakeField, type SaveIntakeFieldResult } from './write';
export { revealIntakeField, type RevealIntakeFieldResult } from './reveal';
export { completeIntake } from './complete';
export { recordIntakeSignature } from './sign';
export { resolveClient, getOrCreateClient, type AuthedClient, type AuthResolution } from './auth';
