# Dashboard audit — 2026-10-16

## Repairs

- Isolated admin, admin-management, provider and provider-onboarding fixtures now
  use separate Next development caches and temporary TypeScript configurations.
  The existing developer server can remain running. Fixture names are validated,
  and production ignores the fixture configuration.
- Normal lint and type checks exclude the generated fixture caches while still
  checking application and test source. Theme captures from these fixtures go
  under ignored scratch storage instead of changing tracked review artifacts.
- Reporting-period assertions now await the matching metrics response. The admin
  fixture records ranges per endpoint, so a concurrent retention request cannot
  overwrite the usage range. Safety navigation follows the current analytics UI.

## Validation

- 23 Node unit tests passed.
- TypeScript `--noEmit --incremental false` and ESLint both exited 0.
- Admin HTTP/browser integration passed: authentication, CSRF, permissions,
  reporting ranges, suppression, empty/error states, password reset and mobile UI.
- Provider HTTP/browser integration passed: authorized records, notes, assignment,
  signed PDFs, consent withdrawal, revocation, settings and responsive layouts.
- Admin-management browser integration passed: charts, filters, catalog CRUD,
  quiz draft/preview/publication, permissions, themes and mobile navigation.
- Provider-onboarding browser integration passed: registration, empty roster,
  invitation preview, consent acknowledgements, connection and replay errors.

These checks use synthetic local fixtures. They do not certify physical-device
behavior or replace a complete security review of every application path.

## Outstanding upstream development dependency advisory

The production-only npm audit reports zero advisories. The complete audit reports
five high-severity dependency-chain alerts arising from one vulnerability in
`braces` 3.0.3, reached through `eslint-config-next` →
`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describes stack exhaustion from deeply nested brace patterns and currently lists
no patched version. The npm registry also reports 3.0.3 as the latest version.
Do not downgrade Next.js/ESLint to satisfy the audit resolver or suppress this
advisory. Keep lint inputs trusted and update the dependency chain when a patched
compatible release becomes available. This finding remains open; a clean
production audit is not a clean development audit.
