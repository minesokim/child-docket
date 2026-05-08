// @docket/test-fixtures — barrel export.
//
// Stable fixture data + placeholder binaries for smoke tests, agent eval
// harnesses, and staging environment seeding. NEVER imported into prod
// code paths — see README.

export {
  fixtureTenant,
  fixtureUsers,
  fixtureClients,
  fixtureEngagements,
  fixtureIntakeAnswers,
  fixtureDocuments,
} from './fixtures.js';

export {
  PLACEHOLDER_PNG_BYTES,
  PLACEHOLDER_PDF_BYTES,
  isValidPng,
  isValidPdf,
} from './binaries.js';

// seed.ts is exposed via the './seed' subpath export to keep the main
// barrel free of @docket/db / @docket/storage transitive deps. Test
// authors import only the data shapes from `@docket/test-fixtures`;
// staging-environment seeders import from `@docket/test-fixtures/seed`.
