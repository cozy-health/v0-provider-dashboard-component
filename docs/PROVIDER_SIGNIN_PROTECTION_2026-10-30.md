# Provider sign-in protection - 30 October 2026

Development only. This implements the provider portion of P02; it does not mark the complete app plan finished. The public development SIGNIN_SECURITY_ENABLED flag remains false pending compatible-client rollout and activation/recovery rehearsal.

## Implemented

- Provider login and registration hand off pending email or question checks to the existing server contract. Provisional access/refresh tokens, device proofs, challenge tokens and settings tickets are encrypted in HttpOnly cookies. Browser JSON contains only the current UI step, public questions, delivery status and expiry.
- Three distinct secret-question enrollment, email fallback, expiry, bounded Retry-After feedback, resend cooldown, cancellation, pending-page reload and explicit continuation after saved-state checks. Definite validation errors allow correction. Unknown save outcomes require reconciliation or fresh identity verification.
- Settings require the current password and a fresh email code. The identity prompt is centered, scrollable, supports large text and has a full-size Cancel button. No authenticator app or provider professional-verification workflow was added.
- Public random request scopes bind encrypted credentials, in-flight requests, parsed JSON, PDFs, media URLs and private React views to the account that opened them. Delayed login/logout/refresh responses cannot overwrite a newer account cookie. Captured obsolete cookie names are retired without deleting later-created scopes. Existing legacy encrypted sessions retain a safe compatibility path.
- Switching accounts hides the old view, closes the owned identity popup and removes its password field. Secrets are not written to browser storage. Answers are submitted only to the existing protection endpoint and remain hashed by the API.
- Report downloads and audio recovery respect re-verification. The normal provider allowlist, CSRF, origin validation, payload bounds, consent checks and private/no-store responses remain enforced.

## Validation

- Strict TypeScript and noUncheckedIndexedAccess remain enabled. 46 unit tests passed, including real-bridge/crypto tests and asynchronous browser-scope regressions.
- New browser fixture passed: wrong-code recovery, pending reload, enrollment before private content, centered identity, settings changes without replacing the active session, dark 320px/200 percent text, reachable actions and cross-tab secret cleanup.
- Existing provider onboarding browser fixture passed registration, HttpOnly credentials, empty roster, invitation preview, acknowledgements, changed consent, connection, replay error and responsive themes.
- Existing HTTP/provider browser contract passed authentication, CSRF, bounds, resource CRUD, patient views, notes, assignments, signed PDFs, consent withdrawal, settings, audit, narrow layouts, revocation, draft/published consent and logout. Stale test wording was aligned with the approved Assessment results label; credential visibility assertions distinguish the public nonce from the HttpOnly credential. No behavioral assertions were removed or weakened.
- The measured large-text overflow was reproduced and repaired with bounded grid sizing and responsive spacing, preserving text scaling. Before/after synthetic screenshots are in the workspace docs/validation/provider-protection folder.
- Complete local build passed. Exact remote develop SHA, hosted checks and development deployment are recorded in the workspace delivery report after completion; pending hosted work is not a pass.

## Real owned-inbox acceptance

Two exact Gmail test aliases were added to the development API/worker recipient allowlists, preserving existing recipients and mail safeguards. Both services deployed the same tested API source eda9c769b70ea7df33eb8f55a4cd7fac6a520bba. The normal login router, queue, worker and SMTP transport generated patient/provider verification emails. The owner read both inbox codes and they verified successfully against the live development application.

These operator requests used a process-local flag override inside explicitly development-only CLI acceptance; no public environment activation occurred. Both roles passed identity binding, private denial before enrollment, replay rejection, three-question enrollment, trusted-device reuse, question verification on a new device and reverification after simulated 15-day inactivity on fixture-owned device rows. Both fixtures were disabled and all their credentials revoked. Fixture passwords/challenge capabilities were encrypted while pending and removed from retained acceptance summaries. No codes or credentials belong in Git or reports.

Delivery IDs: patient cf9b6f60-f671-42e2-9aac-faedab90a7bd; provider fa79f9f3-eba5-45ea-98fc-b14fc68822c9. Transport status sent is distinct from inbox proof, which came from the owner returning the test codes. Bounce/webhook outcomes and the full remaining mail matrix are not claimed as verified from these two deliveries.

## Remaining

Complete compatible mobile/provider deployment and controlled public development activation/recovery rehearsal; finish any remaining registration/reset/invitation/resend/bounce inbox cases against the mail matrix; retain safe client-update/signing and final real-phone acceptance. Apple identity/store payment acceptance remains last. P03-P11 and S01 remain governed by COMPLETION_PLAN_2026-10-29.md; ordinary consent readiness, support/privacy, core/device acceptance, Student/institutions, community/provider round trips, approved content/dashboards, push, security/recovery and monitoring are not automatically complete from this batch.

To rerun local browser checks, set PROVIDER_PLAYWRIGHT_PATH to an installed Playwright index.mjs and run npm run test:provider-protection, npm run test:provider-onboarding and npm run test:integration. These browser fixtures use synthetic local backends; they do not send real emails or access real patients.