# Provider consent recovery - 2 November 2026

Development only. Required-consent activation and general sign-in enrollment remain paused. This does not certify the whole P03/P04 or app build plan.

The provider dashboard could mount private requests while its consent request failed. The API also permitted provider private endpoints with missing required document acceptance. Both failures were reproduced before repair. The API repair is develop e87acaf14d69dafaa60120e97c13b5108565bef2; its full local 924-test suite and hosted full/MySQL checks passed, and its development API/worker deployments succeeded.

The existing consent notice now gates private children. Unknown/required-unavailable policy and wrong-account/malformed history use the existing loading/retry components. A paused rollout remains usable during optional history failure. Server consent denials reopen required review without logging out. Only recognized recovery codes survive the API bridge, including report authorization and file-fetch failures. Current accepted records remain owner/version scoped.

An unchanged confirmed policy preserves same-account unfinished input during transient refresh errors. Optional notice appearance/dismissal preserves the same workspace. An explicit server denial or invalid identity invalidates confirmation. The existing account boundary and request scope still prevent cross-tab account reuse.

The owner reviewed the before screenshot and approved fixing the mobile header overlap. Branding and controls now occupy separate rows. The existing foreground token also replaces low-contrast orange provider error text: measured contrast increased from 3.18:1 to 17.13:1 in light mode; dark is 20.12:1. The normal-text threshold is from [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). No new palette was introduced.

## Validation

- `npm run typecheck`, `npm test` (52 passed) and `npm run build`: passed after the final source edit, using development configuration locally.
- New `npm run test:provider-consent`: real dashboard/browser with fictional local API fixtures. Covers unknown policy, retry, required acceptance, unpublished/empty documents, wrong owner, malformed history, unchanged-policy refresh failure, retained input, optional notices, paused rollout, server-required recovery, 320px/200% text, actual overlap and rendered text contrast.
- Existing provider integration/theme/navigation and sign-in-protection browser journeys passed after the gate/header changes. Onboarding and shared-journal review/withdrawal/failure/browser-storage checks also passed during this batch. The final error-colour-only edit was rechecked through the focused browser journey and complete CI toolchain.
- Existing protection/journal test fixtures were corrected to match the real consent response/owner contract.
- Hosted dashboard CI and final development deployment must be verified for the pushed commit. Browser fixtures here are local, not hosted or physical-phone acceptance.

## Review images

- [Original header overlap](validation/provider-consent-recovery-2026-11-02/header-before-dark-320-large-text.png)
- [Original light error contrast](validation/provider-consent-recovery-2026-11-02/contrast-before-light-390.png)
- [Current light recovery screen](validation/provider-consent-recovery-2026-11-02/recovery-light-390.png)
- [Current dark 320px / 200% text screen](validation/provider-consent-recovery-2026-11-02/recovery-dark-320-large-text.png)
- [Measured contrast](validation/provider-consent-recovery-2026-11-02/contrast.json)

Broader support/privacy administration, modal keyboard/focus acceptance, optional-notice persistence/copy, remaining core features, phones and operational consent readiness remain in the approved completion plan. Store setup/payments remain last; display native store-returned prices without a fixed USD rate or country picker.
