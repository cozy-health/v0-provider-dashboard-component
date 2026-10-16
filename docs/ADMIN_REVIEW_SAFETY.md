# Admin review safety fixes

This local change addresses the first seven audit findings. Deployment remains deferred.

## Behavior

- Users is read-only. View shows account name, email, activation/verification status and registration date. Both the dashboard proxy and Laravel routes reject admin account edits and deletion. Consumer self-service account routes remain intact.
- Moderation compares the reviewed content version inside a transaction. Stale decisions return 409 and the dialog offers Reload. The refreshed content and status must be reviewed before resubmitting.
- Publishing/removing content through a report resolves all pending reports against the same content and audits each affected report. Dismissal resolves only the selected report. Republishing removed content requires confirmation in both the UI and API.
- Community and challenge descriptions are required on create/update. Their forms show the requirement and field-specific validation errors.
- Quiz imports validate metadata, questions, options, scoring bands and coverage before replacing the draft. Invalid imports preserve existing work. Archived quizzes expose a read-only preview including scoring, without editing, saving, publication or archive controls.
- Report review includes reason, content type/status, submission/deadline timestamps, overdue state, resolution timestamp when applicable and the content update time. Anonymous author identifiers and report snapshots remain excluded. Missing content can only be dismissed; resolved reports have no decision controls.

## API contract

- Removed admin `PUT /users/{id}` and `DELETE /users/{id}`.
- Added protected `GET /community/{posts|comments}/{uuid}` for conflict recovery. List/detail responses include opaque `version` tokens; report details include `target.version` when content exists.
- `PUT /community/{posts|comments}/{uuid}` requires `expected_version`. Report publish/remove decisions also require `expected_version`; dismissal does not. Missing versions return 422 and mismatches return 409.
- Transitioning removed content to published additionally requires `confirm_republish: true`.
- No new migration is required for this pass. The earlier resolution-timestamp migration remains a prerequisite. Roll out matching backend/frontend versions together in a future deployment.

## Verification

- `php artisan test --filter=Admin`: 63 tests passed, including read-only user access, session preservation, stale edits, related-report resolution, confirmation and description validation.
- Full backend regression: `php -d extension=gd vendor/bin/pest --compact` passed 623 tests (4,402 assertions). GD is required by the avatar-upload tests.
- `node --test tests/*.test.mjs`: 23 tests passed, including quiz-import validation and rejection of admin user mutation paths.
- ESLint, TypeScript and production build passed.
- With the isolated local API/dashboard running and `ADMIN_PLAYWRIGHT_PATH` configured, run `npm run test:admin-review-safety`. It authenticates locally, then intercepts management requests with synthetic fixtures; no management writes reach the preview database. It checks all seven UI fixes and responsive report review.
- Preview screenshots are under `docs/validation/admin-review-safety/`.

Pagination, filter-loading behavior, unused analytics requests, support replies and quiz restoration are outside this pass.
