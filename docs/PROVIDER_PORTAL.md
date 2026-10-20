# Provider portal (PD-5)

The production surface reads the provider API. There is no demo roster, seeded
library, simulated patient connection, inferred risk level or placeholder PDF.
Test-only fixtures live under `tests/` and run against an isolated local server.

## Configuration

Copy `.env.example` to `.env.local` for local development. For a local Laravel
server, set `PROVIDER_API_URL=http://127.0.0.1:8000/api/v1/provider/` and
`PROVIDER_DASHBOARD_ORIGIN=http://localhost:3000`. Generate a secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

On staging/production, configure these as server environment variables:

| Variable | Value |
| --- | --- |
| `PROVIDER_API_URL` | HTTPS backend URL ending in `/api/v1/provider/` |
| `PROVIDER_DASHBOARD_ORIGIN` | Exact HTTPS dashboard origin, without trailing slash |
| `PROVIDER_SESSION_SECRET` | 64 hexadecimal characters, shared by dashboard replicas |

Never use a `NEXT_PUBLIC_` variable for credentials. Rotating the dashboard secret
invalidates existing browser cookies. Deploy the backend PD-5 token-expiry change
before enabling dashboard sign-in. No migration or new runtime package is needed.
The existing deferred staging requirement remains: create and verify a separate
staging dashboard before enabling real provider login in production.

## Sessions and requests

Next.js route handlers bridge the existing bearer-token API. Login returns the
provider profile to the browser and seals the bearer token in an authenticated
AES-256-GCM cookie. The production cookie is `__Host-cozy-provider`, HttpOnly,
Secure, SameSite Strict and scoped to `/`, with no Domain attribute.
It expires after 30 minutes, matching the backend expiry for tokens named
`cozy-provider-dashboard`. Tokens for existing API clients retain their existing
expiry behavior. Sign-out calls backend logout before clearing the cookie.

The protected root checks cookie authentication and expiry before rendering.
The API rechecks the cookie on every request, and the backend rechecks current
provider identity, active status, patient links and data consent. Auth changes use
a full page navigation to discard client-side patient state. The browser's session
timer uses the actual cookie expiry timestamp; refreshing the page does not
extend the session.

Mutation requests require the exact configured Origin, the `X-Cozy-Request: 1`
header and JSON for POST/PATCH. Only explicit provider routes/methods are allowed.
Query forwarding is limited to pagination, dates and audit filters. Cookies and
arbitrary authorization headers are not forwarded. The browser User-Agent is
forwarded for auditing. Access-log IP addresses identify the dashboard bridge's
network source; client-supplied forwarding headers are not trusted or forwarded.
Backend patient attribution (`user_id`, resource ID, action) is preserved.

All bridge responses are private/no-store. HTTP 401 clears the cookie and prompts
sign-in. Backend 404, validation, throttling, network and server failures receive
visible UI feedback. A failed sign-out retains the session for a retry.

PDF downloads first request a signed URL, verify its origin and expected file
path, then fetch it with the provider credential. Neither the token nor the signed
URL is returned to browser code. The backend checks current link/consent on both
requests and audits issuance/download. Response bytes are downloaded as a PDF.

## Views

- Patients: real first-name-only roster, patient IDs, search, sharing flags and
  detail. Patients initiate linking through My Provider in the mobile app.
- Shared data: separately gated moods, journal summaries and quizzes. Mood
  intensity and trigger/coping charts describe only the current authorized page
  of check-ins, with explicit units and no inferred clinical risk/effectiveness.
  Journal bodies are never requested.
- Notes: consent-gated creation/deletion with persisted API responses.
- Resources: owned library CRUD and patient assignment/removal. Patient
  completion/decline status is displayed from the API.
- Reports: monthly generation from a patient view, paginated report history and
  authorized download. A report invalidated by consent changes needs regeneration.
- Settings: name, practice and IANA timezone updates. Registered email, license
  and verification status are read-only.
- Audit log: provider-only history with patient IDs, resource IDs, actions,
  timestamps, date/action/resource filters and pagination.

Each list has loading, retry/error and empty states. Mutation refreshes reset
pagination to page one. Patient detail rechecks sharing every 30 seconds while
visible and on window focus/visibility changes. Unchanged sharing preserves
unsaved note drafts; changed sharing remounts sections and discards old data.
A revoked link or failed revalidation clears the patient view. Already viewed or
downloaded data cannot be recalled; each subsequent API request is authorized.

## Verification

```sh
npm test
npm run test:integration
npm run lint
npx tsc --noEmit
npm run build
```

The session tests use Node's built-in TypeScript support (Node 24 was verified).
Integration checks start an isolated Next.js development server and API contract
fixtures on random loopback ports; no external provider account is used.
Set `PROVIDER_PLAYWRIGHT_PATH` to an installed Playwright `index.mjs` to also run
browser assertions and save screenshots in the shared workspace `docs/` directory.
Without it, the HTTP/security integration checks run and the browser checks are
explicitly reported as skipped. Test helpers are never imported by the portal.

The implementation uses the Next.js
[cookie and route-handler APIs](https://nextjs.org/docs/app/api-reference/functions/cookies).
