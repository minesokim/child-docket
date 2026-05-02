// @docket/ui component barrel.
//
// All component exports are re-surfaced here so consumers import from
// `@docket/ui` (the package barrel) rather than reaching into a specific
// file. Internal grouping is by purpose, not by alphabet:
//
//   layout         Screen, Stack, Row
//   text           Eyebrow, H1, H2, Body
//   buttons        Button, BackButton, IntakeBackButton
//   indicators     ProgressBar, Placeholder, TrustPill
//   media          AvatarSlot, VideoPlaceholder
//   cards          Card, ToggleCard, RadioRowCard, DependentCountCard
//   fields         FieldLabel, TextField, SSNField, EncryptedTextField
//   antonio        AskAntonioBar, AskAntonioChat, AntonioNote
//   intake-frame   SignOutProvider, IntakeRouteFrame, IntakeHeader,
//                  BottomBar, IntakeBottomBar, Footer
//   icons          IncomeIcon (+ IncomeIconKind), HandCheckmark, Wordmark
//   signature      LegalDoc, SignaturePad
//   portal         PortalTabBar (+ PortalTabId)

export * from './layout.js';
export * from './text.js';
export * from './buttons.js';
export * from './indicators.js';
export * from './media.js';
export * from './cards.js';
export * from './fields.js';
export * from './antonio.js';
export * from './intake-frame.js';
export * from './icons.js';
export * from './signature.js';
export * from './portal.js';
