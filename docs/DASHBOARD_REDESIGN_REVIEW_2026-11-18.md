# Dashboard redesign — approved for release

The owner rejected the earlier polish pass as insufficient and requested a substantial redesign. This work is local on `codex/dashboard-redesign-20261118`, based on `f7fc53b0432f0286ea3fcb5de481e8c622dca3ee`. The owner reviewed locally and explicitly approved pushing and deployment on 18 November 2026. This approval supersedes the previous local-only restriction. Hosted checks and production deployment must pass before release closure; unobserved production journeys and accessibility states remain open.

## Guidance and coverage

Used the installed **emil-design-eng** skill, existing Cozy tokens/components and the installed Next.js CSS/client-component documentation. No additional skill installation was necessary for these components. Cross-checked [Carbon table guidance](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) and [WAI-ARIA modal guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Guidance informs implementation; it does not establish a passing accessibility audit.

| Before | After | Why |
| --- | --- | --- |
| Shared header and older sidebar composition | Navy workspace rail, independent top bar, grouped navigation, account footer and mobile sheet | Establish clear navigation and usable content space |
| Settings as one unstructured card | Two-column profile form, separate credentials and security panels, separated action area | Distinguish editable profile details from controlled credentials |
| Audit filters and record text on the canvas | Filter panel, explanatory note and structured activity rows with timestamps | Make history easier to scan and filter |
| Assessment cards with results appended at the bottom | Results inbox alongside an explicit detail/empty pane, score and recommendation hierarchy | Preserve context while reviewing a result |
| Detached messaging blocks, ambiguous initial empty state | Unified thread/conversation workspace, search, loading skeletons and explicit empty states | Keep conversation context and feedback together |
| Message state could outlive its selected conversation | Only the current message owner's records render during a switch; retry restarts message loading | Prevent previous-thread content during pending requests |
| Analytics reused older chart panel hierarchy | Shared panel headers, reporting context, responsive category navigation and existing chart/table exports | Keep navigation, reporting meaning and data together |
| Safety counts presented with little hierarchy | Responsive period cards, distinct suppressed/unavailable/zero values and separate interpretation/privacy guidance | Avoid implying unavailable or protected data is zero |
| Published article list and editor used generic containers | Library panel, category/read-time list metadata, editorial section hierarchy and action divider | Separate selection, writing and publication review |
| Users were a generic value grid | Identity avatar/name/account grouping, readable status labels and structured account details | Make account identification and review clearer |
| Restrictions form and queues stacked across the full page | Responsive form/queue columns and structured decisions/appeals | Reduce form sprawl and keep queues visible |
| Navigation used a default scrollbar; logout was 36px | Thin stable native scrollbar and 44px logout control | Improve long-menu behavior and touch access |
| Incomplete successful report response could crash rendering | Runtime envelope checks with a retryable error | Do not interpret an invalid report as a valid empty/zero result |

Existing API routes, roles, consent guards, native confirmations and dialog dismissal policies remain in use. No database or backend contract changes were made.

## Verification

- 69 unit tests pass, including malformed report envelopes and suppressed/unavailable/zero distinctions.
- Strict TypeScript checks and optimized Next.js build pass; strict and noUncheckedIndexedAccess remain enabled.
- ESLint passes for the affected source files without disabled rules.
- All three release-workflow suites pass locally: admin, admin-management and provider. Tests cover authentication/reset, authorization/CSRF, charts, list/filter actions, resource CRUD, assessments, consent withdrawal, settings persistence, audit filters, narrow navigation, logout and document-consent behavior. Added a held-response conversation-switch regression.
- Theme captures/checks cover listed provider panels at 320/390/768/1440 and listed admin pages at 320/375/390/768/1024/1440. Automated checks assert document overflow, navigation focus/dismissal and theme behavior. This is not a full manual accessibility or all-state acceptance claim.
- Reviewed generated desktop captures of Settings, Messages, Analytics, Safety and restrictions. Owner subsequently approved release of the local candidate.
- Direct browser access is unavailable for this chat; native Chrome accessibility reads timed out twice. Existing isolated browser test suites generated screenshots independently. Do not claim an authenticated production visual review from this run.
- Graphify status is stale; refresh fails with `Graphify workspace: dashboard: development-only policy requires develop`. Source/import/caller checks were used instead. Graph verification remains blocked.

Evidence logs and captures are under `scratch/redesign-*-validation.log`, `scratch/redesign-build.log`, `scratch/redesign-typecheck.log`, `scratch/redesign-lint.log` and `scratch/theme-review/`. The first provider browser assertion referenced old markup; it was updated to assert the same patient count in its containing section. The next run exposed a timezone label including help text; the input now has a stable accessible name and associated description. The initial admin restriction empty-state assertion referenced old punctuation; it now checks the new heading. No tests were skipped and no assertions for privacy, navigation, roles or persistence were weakened.

## Local review

- Admin: `http://127.0.0.1:3100/admin/login`, `operator@example.test` / `fixture-only`.
- Provider: `http://127.0.0.1:3101/login`, `provider@example.test` / `test-password`.
- Both use isolated, in-memory synthetic fixtures. Do not enter production credentials. Local content edits do not change production. Some first-pass errors came from missing local conversation/moderation fixture endpoints; those review responses are now supplied. Sample article/resource content supports visual review and is not approved clinical content.
- A visible sample-data banner is enabled only in development when an integration fixture is selected. No production verification status changed.

Remaining: owner feedback and approval; populated/error/offline/busy/long-content states beyond the exercised tests; full manual keyboard/screen-reader/200%-zoom review; verified-provider production journeys and other launch gates. This local design pass does not close those gates or authorize a push.
