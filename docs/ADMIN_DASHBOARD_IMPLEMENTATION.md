# Cozy admin dashboard implementation

The six approved phases are implemented in the dashboard, Laravel API, and mobile workspace. Production deployment and production database migrations have not been performed.

## Phase checkpoints

| Phase | Implemented capability |
| --- | --- |
| 1 | Cozy brand palette, self-hosted Outfit, Light/Dark/System themes, responsive admin navigation, Dashboard and Datacenter graphs, preserved analytics pages |
| 2 | Scoped management credentials, audited consumer-account management, transactional email previews, queue tests, delivery tracking and provider webhook correlation |
| 3 | Mood/expression/trigger/coping catalogs, aggregate rankings, historical label aliases, mobile catalog cache, expression selection and coping helpfulness |
| 4 | Quiz editor, JSON template/import, preview, isolated drafts, validated publication and immutable definition versions |
| 5 | Community/group management, anonymous moderation, membership removal, support queues, daily challenges and mobile progress |
| 6 | Package management and mobile display, current subscription records, recorded status history and subscription-change graphs |

## Reporting semantics

- Analytics use frozen monthly releases ending at the first UTC day of the current month. Filters select the preceding 7, 30, or 90 days; they do not display live current-month wellness activity.
- Counts are rounded down to multiples of five. Small contributor groups and related breakdowns are withheld. Unknown/free-text trigger labels, notes, journal bodies and quiz answers are never read into these reports.
- User Triggers and User Coping Mechanisms remain aggregate views. The Users module exposes basic account administration rather than wellness histories.
- Average intensity is strength of feeling, not a positive mood score. Device distribution counts eligible registered devices, not distinct people.
- Pending-report counts refer to retained support and community reports in the selected release window. Queue management pages show current operational records.
- Sales, emergency calls and completed mindfulness sessions remain unavailable without verified sources. Purchasing and refunds remain deferred.
- Subscription event history starts when this instrumentation is deployed. Existing current subscription records are available, but historical transitions are not fabricated.

## Deployment order

1. Apply the two `2026_10_14` Laravel migrations through the normal deployment migration process. The catalogs retired by an earlier migration are recreated; current `mood_entries` remain the check-in source.
2. Deploy the API before the dashboard and mobile changes. Keep existing admin origin, API URL, session secret, HTTPS, mail queue and authenticated Brevo webhook configuration.
3. Deploy the dashboard and sign in again to obtain a scoped management session. Older analytics credentials remain restricted and show analytics navigation only.
4. Deploy the mobile build. Catalogs refresh over the authenticated wellness API and remain cached offline. Challenges require connectivity for enrollment and task completion.
5. Retain existing community/quiz feature gates; content administration does not bypass app readiness or assessment validation.

Do not roll back schema after accepting new content without preserving drafts, challenge progress, audit records, delivery history and expression selections. These new tables contain operational data.

## Validation

- Full Laravel suite: 568 tests passed. The final admin-focused regression run also passed after migration and validation refinements.
- Dashboard production build, TypeScript, ESLint and Node tests passed.
- Browser fixtures exercise charts, reporting filters, Light/Dark/System selection and persistence, catalog create/edit/archive, quiz preview/draft/publish, denied permissions, mobile navigation and horizontal overflow.
- Flutter analysis passed for affected files. Twelve focused tests passed for catalog caching, challenge requests, mood parsing and old/new storage compatibility.
- Browser fixtures use local HTTP servers and synthetic records. They do not contact deployed APIs or send real emails.

Run browser checks with `ADMIN_PLAYWRIGHT_PATH` pointing to an installed Playwright entrypoint, using `npm run test:admin` and `npm run test:admin-management` in the dashboard project.

Preview screenshots use synthetic data: [light](validation/admin-phases/dashboard-light.png), [dark](validation/admin-phases/dashboard-dark.png), [mobile](validation/admin-phases/dashboard-mobile.png).

Monitor API and publication failures, email queue depth/age, terminal delivery failures, tracking-unavailable warnings, and unresolved support/community reports after rollout. Operational test emails require an explicit admin action and are limited to three per hour.

### Corrected brand and appearance policy

Light mode uses white (#FFFFFF) backgrounds and dark mode uses black (#000000). Both themes share exact blue #0460D8, green #00BC4C, orange #F25C05, and yellow #F2CB05 accents and graph series. Admin inherits the same web tokens; mobile only restores saved accents from this palette. Neutral borders and readable black/white foregrounds distinguish controls without navy surfaces or lightened brand substitutions.

### Friendly admin presentation

Navigation is grouped into Overview, People & Wellness, Community, and Operations, with meaningful Lucide icons for every destination. Analytics panels and management headers share rounded brand-accent icon badges, neutral surfaces, and clearer spacing. Management actions retain text labels alongside decorative icons; search, loading, empty, and error states provide guidance. Permission filtering, reporting privacy, API behavior, and the exact Light/Dark/System palette are preserved.

The admin management browser check verifies navigation icons and grouping, keyboard focus and Escape dismissal, theme colors, management actions, and mobile overflow. Additional synthetic previews: [quiz management](validation/admin-phases/quiz-management-light.png) and [mobile navigation](validation/admin-phases/navigation-mobile.png).
