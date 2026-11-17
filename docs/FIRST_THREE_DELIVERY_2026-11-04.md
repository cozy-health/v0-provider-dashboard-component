# Support/privacy development delivery - 4 November 2026

Added support conversation and privacy-request workspaces, explicit proxy paths, separate navigation capabilities and permission-filtered queue summaries. Existing staff notes/resolve/reopen are reused. Replies and notification retries are separate; stale decisions refresh without losing entered text; privacy decisions require confirmation. Customer exports are not staff downloads.

Validation already passed: strict typecheck (`strict` and `noUncheckedIndexedAccess` retained), all **55 node tests**, development-targeted Next build, and **14 Chromium checks** through the real Next bridge with an isolated synthetic API fixture. Browser coverage includes draft/conflict recovery, idempotency, private notes, notification retry, resolve/reopen, privacy confirmation, keyboard dismissal, revoked access, and 320px/dark/200%-text layouts. Real API/MySQL behavior is independently tested in the API repository.

The browser fixture now uses `ADMIN_PLAYWRIGHT_PATH` (matching existing admin browser scripts), an available loopback port and a separate Next cache per run. This avoids depending on an ignored historical output folder or colliding with another local review server. Use an installed Playwright module entry point; no test runner dependency or lockfile changed.

Hosted release checks must be verified for the exact pushed develop commit. Production unchanged; real staff assignments and live development round trips remain acceptance work. Existing unrelated docs and `tests/admin-integration.mjs` edits are excluded. The full 175-item build register ships in API `docs/BUILD_PLAN.md`.
