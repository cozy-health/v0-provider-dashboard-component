# Admin refinement: overview, comparisons and review

This pass remains local-first. Open `http://localhost:3000/admin` with the credentials in [local setup](ADMIN_LOCAL_PREVIEW.md).

## Behavior

- Overview puts current totals and registration/activity charts above compact operational queues. Usage and cohort retention live in Analytics; old `/admin/usage` and `/admin/retention` links redirect to their corresponding views.
- Analytics tabs and periods are reflected in URLs. Filtering uses the Next.js native-history integration, avoiding unnecessary server page reloads; every data request still requires existing admin authorization.
- Queue links open the exact report or support request via `?record=ID`, regardless of list pagination. Closing retains list filters. Missing and denied records have a return-to-list action. Support saves use a content version plus existing timestamps/status to reject stale edits, including edits in the same second.
- Pending reports, Overdue reports and Open support are built-in presets. This browser remembers only valid status, numeric community ID and overdue selections. Search text, review contents, account identities and record IDs are not stored as preferences.
- Each data section identifies its last successful refresh separately from its publication date. Empty recent activity and uninstrumented resolution statistics use compact messages.

## Published comparisons and CSV

Comparisons read the immediately previous stored monthly release for the same reporting range. They do not reconstruct missing reports or query historic raw records. Both date windows are shown when available. A missing/suppressed value or a zero previous denominator produces no percentage. Existing immutable release payloads are preserved.

The local database may have no previous monthly release; the truthful result is "No previous published release for comparison." It is not replaced with invented history. Backend tests exercise two explicit synthetic published releases.

Chart CSV downloads use only aggregate values already returned to an authorized analytics reader. Files contain publication/window metadata, units and explicit suppressed/unavailable labels. Hidden values remain hidden and spreadsheet formula prefixes are neutralized. Individual account records, queue content, notes and report snapshots are excluded.

## API and migration

- Additive `comparison` metadata on insights and feature-usage responses; existing `meta` and `data` fields remain compatible.
- Protected `GET /api/v1/admin/reports/{id}` and `/support/{id}` return authorized review details. Report responses exclude snapshots and author identifiers; missing targets remain distinguishable from missing reports.
- The operational summary adds overdue counts, oldest open support age and median resolution times for each queue over the last 30 days. These fields require moderation permission.
- Migration `2026_10_16_000001_add_admin_resolution_timestamps` adds nullable indexed `resolved_at` columns to reports/support. Existing history stays null. Resolution transitions set the timestamp; note edits preserve it; reopening support clears it. Medians exclude untimed history.
- Apply the migration before rolling out these API changes in a future deployment. It has already been applied to the isolated local preview database only.

## Verification

- Full backend suite: 618 tests passed using `php -d extension=gd vendor/bin/pest --compact`.
- Admin-focused regression: 58 tests passed.
- Frontend unit tests: 19 passed, including CSV escaping and suppression preservation.
- ESLint, TypeScript and the production build passed (`npm run build`).
- With the local API and dashboard running and `ADMIN_PLAYWRIGHT_PATH` configured, run `npm run test:admin-refinement`. It verifies hierarchy, downloads, deep links, remembered filters, stale-save recovery, legacy redirects, dark/light themes and widths down to 320px.
- Screenshots are under `docs/validation/admin-refinement/`.

Deployment remains deferred for local review.
