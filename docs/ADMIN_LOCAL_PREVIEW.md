# Latest admin refinement

See [overview and review refinement](ADMIN_REFINEMENT.md) for the current navigation, comparisons, CSV exports, direct review links, queue timing and latest verification. Local setup below is unchanged.

﻿# Local admin overview and analytics

The admin opens at `http://localhost:3000/admin`. It uses the local Laravel API and a dedicated SQLite database, never production data.

## Run

From the dashboard project:

1. `npm run setup:admin-preview` creates ignored local configuration, migrates `cozy-health-api-main/storage/admin-preview.sqlite`, and seeds synthetic records. Repeating it preserves review edits.
2. In one terminal, `npm run dev:admin-api` starts Laravel on `127.0.0.1:8000` with the isolated configuration.
3. In another terminal, `npm run dev -- --hostname localhost --port 3000` starts the dashboard.
4. Sign in with `admin@cozy.local` / `CozyLocal!Review2026`. These credentials exist only in the guarded local fixture.

The setup script preserves an existing dashboard `.env.local`; check its admin URL/origin if you already use another local configuration. Use `localhost:3000` in the browser to match CSRF origin verification. Laravel's `--no-reload` flag is intentional: it preserves the isolated database environment in its server child process.

## What changed

- Overview: permission-scoped current totals, prioritized report/support queues, recent administrative changes, registration/activity charts, usage bars, and retention.
- Analytics: Growth & Engagement, Wellness, and Participation tabs; chart data tables; keyboard navigation; independent loading/error states.
- Decorative heading/card icon badges removed. Navigation and functional controls retain small icons. White/black themes and exact Cozy accent colors remain.
- Existing `/admin/overview` redirects to `/admin`. Detailed reports remain under `/admin/datacenter`, Usage, Retention, and Safety.
- Operational totals are current, while wellness reports use existing immutable monthly releases. The date selector does not change cohort retention or current totals.
- Management requests omit empty search parameters, fixing Laravel validation failures on initial page loads. Reports/support have status filters; posts/members accept community ID filters.
- Saved support notes are returned for editing. Status fields use validated choices. Resolved reports offer viewing without repeat decisions; missing targets can be dismissed.
- Management, analytics, and session checks use independent rate-limit counters with their original limits. Browsing management pages no longer consumes the session-check budget.
- The worker listens to `email` and the configured default queue. No database migration was added for this redesign.

## Local mail capture

The isolated configuration uses Laravel's **log mailer**. Mail is captured in `cozy-health-api-main/storage/logs/laravel.log`; no email is sent externally. Process local queued mail with `php artisan --env=admin-preview queue:work database --queue=email,default --stop-when-empty`. Reset codes in local mail logs are private test artifacts and must not be committed.

The preview seeder refuses non-local environments and databases other than SQLite `admin-preview.sqlite`. Fixture accounts are synthetic but are not marked demo, because analytics intentionally excludes demo records.

## Checks

- `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`.
- Backend: `php artisan test --filter=Admin`. On this Windows CLI, run the full suite with `php -d extension=gd vendor/bin/pest --compact` so the installed GD extension is enabled in the actual test process.
- With both local servers running, set `ADMIN_PLAYWRIGHT_PATH` to an installed Playwright `index.mjs`, then run `npm run test:admin-local`. This is the actual Laravel integration check, not a mocked backend. It respects existing API throttling.
- `npm run test:admin-mail` verifies real local queue processing, captured email, and password reset without sending external email.
- Existing `test:admin` and `test:admin-management` use isolated contract fixtures.
- Browser screenshots are saved to `docs/validation/admin-local/`.

## Data semantics and limits

Consumer totals count non-demo consumer accounts excluding deleted accounts, including inactive accounts. Active subscription totals count active records whose expiry has not passed; they do not represent payments. Recent activity excludes read-only audits, actor identity, target identifiers, changed values, and private content. Each section respects the token's existing capabilities.

Published analytics retain cohort suppression, rounding, fixed ranges, and the current-month exclusion. Missing/suppressed values are not plotted as zero. Wellness counts describe recorded choices, not clinical outcomes. Sales, emergency calls, and completed mindfulness sessions remain unsupported rather than fabricated.

Design references: [Carbon dashboards](https://www.carbondesignsystem.com/building-blocks/data-visualization/dashboards) and [Atlassian data visualization colors](https://atlassian.design/foundations/color/data-visualization-color). Existing Cozy tokens and Recharts are used; no additional design framework.

This work is for local review. Hosted deployment has not been performed.

## Verification record

Production build, full ESLint, TypeScript, and 17 frontend unit tests passed. The full backend suite passed 611 tests with GD enabled; the final admin regression passed 53 tests, including missing-target moderation and independent rate-limit budgets. Local browser checks cover actual Laravel-backed catalog edits/archival, quiz publication, saved support notes, resolved report viewing, independent API failures, session redirects, and responsive charts. Local email capture and password reset passed.
